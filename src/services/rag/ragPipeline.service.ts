import { v4 as uuidv4 } from 'uuid';
import { TextChunk, chunkingService } from '@/lib/rag/chunking';
import { ollamaService } from './ollama.service';
import { ExtractedPDFContent } from './pdfExtractor.service';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export interface VectorIndex {
  chunkId: string;
  embedding: number[];
  text: string;
  documentId: string;
  pageNumber: number;
  chunkIndex: number;
  relatedImages?: string[];
}

export interface RAGContext {
  id: string;
  documentId: string;
  documentName: string;
  chunks: TextChunk[];
  vectorIndex: VectorIndex[];
  imageIds: string[];
  metadata: {
    createdAt: Date;
    totalChunks: number;
    totalWords: number;
  };
}

export interface RetrievalResult {
  chunks: TextChunk[];
  similarity: number[];
  images: string[];
  context: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT CAUSE FIX:
//
// Next.js App Router compiles each API route into a SEPARATE server bundle.
// /api/rag/process and /api/generate each get their own module instances.
// A singleton Map in ragPipelineService is NOT shared between them — they are
// literally different JavaScript processes/contexts.
//
// So context stored during /api/rag/process is INVISIBLE to /api/generate.
// Log evidence: "Available: none" even though context was just stored.
//
// FIX: Persist RAG context as a JSON file on disk in /tmp/rag-contexts/.
// Both routes read/write the same filesystem path → shared state.
// ─────────────────────────────────────────────────────────────────────────────

const RAG_CONTEXT_DIR = join(process.cwd(), 'tmp', 'rag-contexts');

async function ensureDir() {
  if (!existsSync(RAG_CONTEXT_DIR)) {
    await mkdir(RAG_CONTEXT_DIR, { recursive: true });
  }
}

async function saveContextToDisk(context: RAGContext): Promise<void> {
  await ensureDir();
  const filePath = join(RAG_CONTEXT_DIR, `${context.id}.json`);
  await writeFile(filePath, JSON.stringify(context), 'utf-8');
  console.log(`[RAG Pipeline] 💾 Context saved to disk: ${filePath}`);
}

async function loadContextFromDisk(ragContextId: string): Promise<RAGContext | null> {
  await ensureDir();
  const filePath = join(RAG_CONTEXT_DIR, `${ragContextId}.json`);
  try {
    const raw = await readFile(filePath, 'utf-8');
    const context = JSON.parse(raw) as RAGContext;
    console.log(`[RAG Pipeline] 📂 Context loaded from disk: ${filePath}`);
    return context;
  } catch (err) {
    console.warn(`[RAG Pipeline] Could not load context from disk: ${filePath}`, err);
    return null;
  }
}

export class RAGPipelineService {
  // Keep in-memory cache as fast path
  private ragContexts: Map<string, RAGContext> = new Map();
  private topK: number;
  private similarityThreshold: number;

  constructor(
    topK: number = parseInt(process.env.RAG_TOP_K_RETRIEVAL || '100', 10),
    similarityThreshold: number = parseFloat(process.env.RAG_SIMILARITY_THRESHOLD || '0.0')
  ) {
    this.topK = topK;
    this.similarityThreshold = similarityThreshold;
    console.log(`[RAG Pipeline] Initialized: topK=${topK}, threshold=${similarityThreshold}`);
  }

  async processPDFContent(pdfContent: ExtractedPDFContent): Promise<RAGContext> {
    try {
      console.log(`[RAG Pipeline] Processing: ${pdfContent.fileName}`);
      const ragId = uuidv4();

      const fullText = pdfContent.pages
        .map((p) => `=== PAGE ${p.pageNumber} ===\n${p.text}`)
        .join('\n\n');

      console.log(`[RAG Pipeline] Total text: ${fullText.length} chars`);
      console.log(`[RAG Pipeline] Text sample (first 800 chars):\n${fullText.substring(0, 800)}`);

      const pageImageMap = new Map<number, string[]>();
      for (const page of pdfContent.pages) {
        const ids = page.images.map((img: any) => img.id);
        if (ids.length > 0) pageImageMap.set(page.pageNumber, ids);
      }

      const chunkedDoc = chunkingService.chunkDocument(
        pdfContent.id,
        pdfContent.fileName,
        fullText,
        pageImageMap
      );

      console.log(`[RAG Pipeline] Created ${chunkedDoc.chunks.length} chunks`);
      if (chunkedDoc.chunks.length === 0) {
        throw new Error('No chunks produced. PDF may have no extractable text.');
      }
      console.log(`[RAG Pipeline] Chunk 0 preview: ${chunkedDoc.chunks[0]?.text?.substring(0, 200)}`);

      const embeddings = await this.generateEmbeddingsForChunks(chunkedDoc.chunks);

      const vectorIndex: VectorIndex[] = chunkedDoc.chunks.map((chunk, i) => ({
        chunkId: chunk.id,
        embedding: embeddings[i],
        text: chunk.text,
        documentId: pdfContent.id,
        pageNumber: chunk.metadata.pageNumber,
        chunkIndex: chunk.metadata.chunkIndex,
        relatedImages: chunk.metadata.relatedImages,
      }));

      chunkedDoc.chunks.forEach((chunk, i) => { chunk.embedding = embeddings[i]; });

      const ragContext: RAGContext = {
        id: ragId,
        documentId: pdfContent.id,
        documentName: pdfContent.fileName,
        chunks: chunkedDoc.chunks,
        vectorIndex,
        imageIds: chunkedDoc.imageIds,
        metadata: {
          createdAt: new Date(),
          totalChunks: chunkedDoc.chunks.length,
          totalWords: chunkedDoc.metadata.totalWordCount,
        },
      };

      // ✅ Store in memory AND on disk
      this.ragContexts.set(ragId, ragContext);
      await saveContextToDisk(ragContext);

      console.log(`[RAG Pipeline] ✅ Stored context ID: ${ragId} (memory + disk)`);
      return ragContext;
    } catch (error) {
      console.error('[RAG Pipeline] Error:', error);
      throw error;
    }
  }

  private async generateEmbeddingsForChunks(chunks: TextChunk[]): Promise<number[][]> {
    const texts = chunks.map((c) => c.text);
    console.log(`[RAG Pipeline] Generating embeddings for ${texts.length} chunks...`);
    const embeddings = await ollamaService.generateEmbeddings(texts);
    console.log(`[RAG Pipeline] Generated ${embeddings.length} embeddings`);
    return embeddings;
  }

  async retrieveContext(ragContextId: string, query: string): Promise<RetrievalResult> {
    // ✅ Try memory first, then fall back to disk
    let ragContext = this.ragContexts.get(ragContextId);

    if (!ragContext) {
      console.log(`[RAG Pipeline] Not in memory, loading from disk: ${ragContextId}`);
      ragContext = await loadContextFromDisk(ragContextId) ?? undefined;
      if (ragContext) {
        // Cache it in memory for future calls
        this.ragContexts.set(ragContextId, ragContext);
        console.log(`[RAG Pipeline] ✅ Loaded from disk and cached in memory`);
      }
    }

    if (!ragContext) {
      console.error(`[RAG Pipeline] ❌ Context not found anywhere: ${ragContextId}`);
      throw new Error(`RAG context not found: ${ragContextId}. Please re-upload your PDF.`);
    }

    console.log(`[RAG Pipeline] ✅ Context found: ${ragContext.chunks.length} chunks`);

    // Return ALL chunks — for website generation we want all document content
    let selected: (VectorIndex & { similarity: number })[];

    try {
      const queryEmbedding = await ollamaService.generateEmbedding(query);
      selected = ragContext.vectorIndex
        .map((item) => ({
          ...item,
          similarity: ollamaService.cosineSimilarity(queryEmbedding, item.embedding),
        }))
        .sort((a, b) => b.similarity - a.similarity)
        .filter((item) => item.similarity >= this.similarityThreshold)
        .slice(0, this.topK);

      console.log(`[RAG Pipeline] Similarity retrieval: ${selected.length} chunks`);
    } catch (err) {
      console.warn('[RAG Pipeline] Embedding query failed, using all chunks:', err);
      selected = [];
    }

    if (selected.length === 0) {
      console.log('[RAG Pipeline] Using ALL chunks (full-document fallback)');
      selected = ragContext.vectorIndex
        .map((item) => ({ ...item, similarity: 1.0 }))
        .sort((a, b) => a.pageNumber - b.pageNumber || a.chunkIndex - b.chunkIndex);
    }

    const contextParts: string[] = [];
    const images = new Set<string>();
    const chunks: TextChunk[] = [];

    for (const item of selected) {
      contextParts.push(`[Page ${item.pageNumber}]\n${item.text}`);
      item.relatedImages?.forEach((img) => images.add(img));
      const chunk = ragContext.chunks.find((c) => c.id === item.chunkId);
      if (chunk) chunks.push(chunk);
    }

    const context = contextParts.join('\n\n');
    console.log(`[RAG Pipeline] Context assembled: ${selected.length} chunks, ${context.length} chars`);
    console.log(`[RAG Pipeline] Context sample:\n${context.substring(0, 600)}`);

    return {
      chunks,
      similarity: selected.map((i) => i.similarity),
      images: Array.from(images),
      context,
    };
  }

  buildAugmentedPrompt(originalPrompt: string, ragContext: string, images: string[]): string {
    const hasContext = ragContext && ragContext.trim().length > 0;

    console.log(`[RAG Pipeline] Building augmented prompt. RAG context length: ${ragContext?.length || 0} chars`);

    const contextBlock = hasContext
      ? `════════════════════════════════════════════════════════════
CONTENT EXTRACTED FROM UPLOADED PDF — THIS IS YOUR DATA SOURCE:
════════════════════════════════════════════════════════════
${ragContext}
════════════════════════════════════════════════════════════

`
      : '';

    const prompt = `${contextBlock}USER REQUEST: ${originalPrompt}

════════════════════════════════════════════════════════════
MANDATORY INSTRUCTIONS:
════════════════════════════════════════════════════════════

${hasContext ? `USE ONLY REAL DATA FROM THE PDF ABOVE — MANDATORY:
• Organization/Company name from document → use as <h1> and <title>
• All person names, roles, designations → display in relevant sections
• All phone numbers → show on Contact page
• All email addresses → show on Contact page
• All physical addresses / office locations → show on Contact page
• All achievements, awards, certifications → list on Achievements page
• All services, products, capabilities → list on Services/About page
• All statistics (employees, offices, years, countries) → use in hero/about
• Timeline / history if present → show as visual timeline
• DO NOT invent any names, numbers, or placeholder data
• EVERY section must contain REAL text from the PDF above

` : ''}Generate EXACTLY 4 complete pages:
1. home — hero with real company name, tagline, key stats from document
2. about — full company description using real document content
3. services — ALL real services/products/capabilities listed
4. contact — REAL phone, email, address from document

OUTPUT FORMAT (follow exactly):

===PAGE_NAME:home===
===HTML===
[Complete HTML document with ALL CSS embedded in <style> tags]
===END HTML===
===END PAGE===

===PAGE_NAME:about===
===HTML===
[Complete HTML document]
===END HTML===
===END PAGE===

===PAGE_NAME:services===
===HTML===
[Complete HTML document]
===END HTML===
===END PAGE===

===PAGE_NAME:contact===
===HTML===
[Complete HTML document]
===END HTML===
===END PAGE===`;

    console.log(`[RAG Pipeline] Augmented prompt length: ${prompt.length} chars`);
    return prompt;
  }

  getRAGContext(ragContextId: string): RAGContext | undefined {
    return this.ragContexts.get(ragContextId);
  }

  listRAGContexts(): RAGContext[] {
    return Array.from(this.ragContexts.values());
  }

  deleteRAGContext(id: string): boolean {
    return this.ragContexts.delete(id);
  }

  clearAllContexts(): void {
    this.ragContexts.clear();
  }

  getStats() {
    const all = Array.from(this.ragContexts.values());
    return {
      activeContexts: this.ragContexts.size,
      totalChunks: all.reduce((s, c) => s + c.metadata.totalChunks, 0),
      totalWords: all.reduce((s, c) => s + c.metadata.totalWords, 0),
      totalImages: all.reduce((s, c) => s + c.imageIds.length, 0),
    };
  }
}

export const ragPipelineService = new RAGPipelineService();
