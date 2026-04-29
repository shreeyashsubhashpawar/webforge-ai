import { v4 as uuidv4 } from 'uuid';
import { TextChunk, chunkingService } from '@/lib/rag/chunking';
import { ollamaService } from './ollama.service';
import { ExtractedPDFContent } from './pdfExtractor.service';

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

export class RAGPipelineService {
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

      // Log the actual text being stored — this is how we verify PDF content is captured
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

      // Log sample chunks to verify content
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

      this.ragContexts.set(ragId, ragContext);
      console.log(`[RAG Pipeline] ✅ Stored context ID: ${ragId} (${this.ragContexts.size} total contexts)`);
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
    const ragContext = this.ragContexts.get(ragContextId);

    if (!ragContext) {
      const available = Array.from(this.ragContexts.keys()).join(', ') || 'none';
      console.error(`[RAG Pipeline] ❌ Context NOT found: "${ragContextId}"`);
      console.error(`[RAG Pipeline] Available context IDs: ${available}`);
      throw new Error(`RAG context not found: ${ragContextId}. Available: ${available}`);
    }

    console.log(`[RAG Pipeline] ✅ Context found: ${ragContext.chunks.length} chunks`);

    // ─────────────────────────────────────────────────────────────────────
    // For website generation we want ALL content from the document.
    // Don't filter by similarity — a department name on page 1 is just as
    // important as an achievement on page 5, regardless of query.
    // ─────────────────────────────────────────────────────────────────────
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

      console.log(`[RAG Pipeline] Similarity retrieval: ${selected.length} chunks selected`);
    } catch (err) {
      console.warn('[RAG Pipeline] Embedding failed, using all chunks:', err);
      selected = [];
    }

    // Always fallback to ALL chunks if nothing selected
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

    console.log(`[RAG Pipeline] Building augmented prompt. Context length: ${ragContext?.length || 0}`);

    const contextBlock = hasContext
      ? `════════════════════════════════════════════════════════════
CONTENT EXTRACTED FROM UPLOADED PDF — USE THIS AS YOUR DATA SOURCE:
════════════════════════════════════════════════════════════
${ragContext}
════════════════════════════════════════════════════════════

`
      : '';

    const augmented = `${contextBlock}USER REQUEST: ${originalPrompt}

════════════════════════════════════════════════════════════
MANDATORY INSTRUCTIONS:
════════════════════════════════════════════════════════════

${hasContext ? `THE WEBSITE MUST CONTAIN THIS REAL INFORMATION FROM THE PDF:
• Organization/Department name → use as the main heading (h1) and page title
• All person names (HOD, Principal, Director, faculty) → display in relevant sections
• All phone numbers → show on Contact page
• All email addresses → show on Contact page
• All physical addresses → show on Contact page
• All achievements, awards, rankings → list on Achievements page
• All programs, courses, departments → list on About page
• All statistics, numbers, years → include in relevant sections
• DO NOT invent placeholder names, numbers, or addresses
• EVERY section of EVERY page must contain real text from the PDF above

` : ''}Generate EXACTLY 4 complete pages:
1. home — hero section with real org name, key highlights from document
2. about — full description using real document content  
3. achievements — ALL real achievements/awards/milestones listed
4. contact — REAL phone, email, address from document

OUTPUT FORMAT (exact):

===PAGE_NAME:home===
===HTML===
[Complete HTML document with embedded CSS and JS]
===END HTML===
===END PAGE===

===PAGE_NAME:about===
===HTML===
[Complete HTML document]
===END HTML===
===END PAGE===

===PAGE_NAME:achievements===
===HTML===
[Complete HTML document]
===END HTML===
===END PAGE===

===PAGE_NAME:contact===
===HTML===
[Complete HTML document]
===END HTML===
===END PAGE===`;

    console.log(`[RAG Pipeline] Augmented prompt length: ${augmented.length} chars`);
    console.log(`[RAG Pipeline] Prompt preview (first 600):\n${augmented.substring(0, 600)}`);

    return augmented;
  }

  getRAGContext(ragContextId: string): RAGContext | undefined {
    const ctx = this.ragContexts.get(ragContextId);
    if (!ctx) {
      console.warn(`[RAG Pipeline] getRAGContext: ID "${ragContextId}" not found. Available: ${Array.from(this.ragContexts.keys()).join(', ') || 'none'}`);
    }
    return ctx;
  }

  listRAGContexts(): RAGContext[] { return Array.from(this.ragContexts.values()); }
  deleteRAGContext(id: string): boolean { return this.ragContexts.delete(id); }
  clearAllContexts(): void { this.ragContexts.clear(); }

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
