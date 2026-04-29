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
    topK: number = parseInt(process.env.RAG_TOP_K_RETRIEVAL || '50', 10),
    // ✅ threshold=0.0 → return ALL chunks. nomic-embed-text similarity scores
    // are too low with short queries to use any positive threshold reliably.
    similarityThreshold: number = parseFloat(process.env.RAG_SIMILARITY_THRESHOLD || '0.0')
  ) {
    this.topK = topK;
    this.similarityThreshold = similarityThreshold;
    console.log(`[RAG Pipeline] Initialized with topK=${topK}, threshold=${similarityThreshold}`);
  }

  async processPDFContent(
    pdfContent: ExtractedPDFContent,
    imageMap?: Map<number, string[]>
  ): Promise<RAGContext> {
    try {
      console.log(`[RAG Pipeline] Processing PDF: ${pdfContent.fileName}`);
      const ragId = uuidv4();
      const documentName = pdfContent.fileName;

      const pageImageMap = new Map<number, string[]>();
      for (const page of pdfContent.pages) {
        const imageIds = page.images.map((img) => img.id);
        if (imageIds.length > 0) {
          pageImageMap.set(page.pageNumber, imageIds);
        }
      }

      const fullText = pdfContent.pages
        .map((p) => `=== PAGE ${p.pageNumber} ===\n${p.text}`)
        .join('\n\n');

      console.log(`[RAG Pipeline] Full text length: ${fullText.length} chars`);
      console.log(`[RAG Pipeline] First 500 chars of fullText: ${fullText.substring(0, 500)}`);

      const chunkedDoc = chunkingService.chunkDocument(
        pdfContent.id,
        documentName,
        fullText,
        pageImageMap
      );

      console.log(`[RAG Pipeline] Created ${chunkedDoc.chunks.length} chunks`);

      if (chunkedDoc.chunks.length === 0) {
        throw new Error('No text chunks produced — PDF may have no extractable text.');
      }

      const embeddings = await this.generateEmbeddingsForChunks(chunkedDoc.chunks);

      const vectorIndex: VectorIndex[] = chunkedDoc.chunks.map((chunk, index) => ({
        chunkId: chunk.id,
        embedding: embeddings[index],
        text: chunk.text,
        documentId: pdfContent.id,
        pageNumber: chunk.metadata.pageNumber,
        chunkIndex: chunk.metadata.chunkIndex,
        relatedImages: chunk.metadata.relatedImages,
      }));

      chunkedDoc.chunks.forEach((chunk, index) => {
        chunk.embedding = embeddings[index];
      });

      const ragContext: RAGContext = {
        id: ragId,
        documentId: pdfContent.id,
        documentName,
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
      console.log(`[RAG Pipeline] Stored context with ID: ${ragId}`);
      console.log(`[RAG Pipeline] Done: ${ragContext.chunks.length} chunks indexed`);

      return ragContext;
    } catch (error) {
      console.error('[RAG Pipeline] Error processing PDF:', error);
      throw error;
    }
  }

  private async generateEmbeddingsForChunks(chunks: TextChunk[]): Promise<number[][]> {
    const texts = chunks.map((c) => c.text);
    try {
      const embeddings = await ollamaService.generateEmbeddings(texts);
      console.log(`[RAG Pipeline] Generated ${embeddings.length} embeddings`);
      return embeddings;
    } catch (error) {
      console.error('[RAG Pipeline] Error generating embeddings:', error);
      throw error;
    }
  }

  async retrieveContext(ragContextId: string, query: string): Promise<RetrievalResult> {
    try {
      const ragContext = this.ragContexts.get(ragContextId);
      if (!ragContext) {
        console.error(`[RAG Pipeline] Context not found for ID: ${ragContextId}`);
        console.error(`[RAG Pipeline] Available IDs: ${Array.from(this.ragContexts.keys()).join(', ')}`);
        throw new Error(`RAG context not found: ${ragContextId}`);
      }

      console.log(`[RAG Pipeline] Found context: ${ragContext.chunks.length} chunks`);

      // ─────────────────────────────────────────────────────────────────────
      // STRATEGY: Always return ALL chunks for website generation.
      // Website content needs ALL information from the document:
      // department name, HOD name, phone, address, achievements, programs —
      // ALL of it matters. We don't filter by semantic relevance here.
      // ─────────────────────────────────────────────────────────────────────
      let selected: (VectorIndex & { similarity: number })[];

      try {
        const queryEmbedding = await ollamaService.generateEmbedding(query);
        const withScores = ragContext.vectorIndex.map((item) => ({
          ...item,
          similarity: ollamaService.cosineSimilarity(queryEmbedding, item.embedding),
        }));

        // Sort by similarity but take ALL chunks (topK=50 by default covers everything)
        selected = withScores
          .sort((a, b) => b.similarity - a.similarity)
          .filter((item) => item.similarity >= this.similarityThreshold)
          .slice(0, this.topK);

        console.log(`[RAG Pipeline] Similarity retrieval: ${selected.length} chunks`);
      } catch (embErr) {
        console.warn('[RAG Pipeline] Embedding query failed, using all chunks:', embErr);
        selected = [];
      }

      // Always fallback to all chunks if selection is empty
      if (selected.length === 0) {
        console.log('[RAG Pipeline] Using all chunks (fallback)');
        selected = ragContext.vectorIndex
          .map((item) => ({ ...item, similarity: 1.0 }))
          .sort((a, b) => a.pageNumber - b.pageNumber || a.chunkIndex - b.chunkIndex);
      }

      const contextLines: string[] = [];
      const relatedImages = new Set<string>();
      const retrievedChunks: TextChunk[] = [];

      for (const item of selected) {
        contextLines.push(`[Page ${item.pageNumber}]\n${item.text}`);
        item.relatedImages?.forEach((img) => relatedImages.add(img));
        const chunk = ragContext.chunks.find((c) => c.id === item.chunkId);
        if (chunk) retrievedChunks.push(chunk);
      }

      const fullContext = contextLines.join('\n\n');
      console.log(`[RAG Pipeline] Context assembled: ${selected.length} chunks, ${fullContext.length} chars`);
      console.log(`[RAG Pipeline] Context preview: ${fullContext.substring(0, 400)}`);

      return {
        chunks: retrievedChunks,
        similarity: selected.map((i) => i.similarity),
        images: Array.from(relatedImages),
        context: fullContext,
      };
    } catch (error) {
      console.error('[RAG Pipeline] Error retrieving context:', error);
      throw error;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // buildAugmentedPrompt
  //
  // This is what Claude actually receives as the user message.
  // It must:
  //   1. Present the full PDF text prominently at the top
  //   2. Give very explicit instructions to use real data
  //   3. Match the output format expected by codeGeneration.service.ts parser
  //      (===PAGE_NAME:xxx=== / ===HTML=== / ===END HTML=== / ===END PAGE===)
  // ─────────────────────────────────────────────────────────────────────────
  buildAugmentedPrompt(originalPrompt: string, ragContext: string, images: string[]): string {
    const contextSection = ragContext && ragContext.trim().length > 0
      ? `════════════════════════════════════════════════════════
COMPLETE CONTENT EXTRACTED FROM UPLOADED PDF DOCUMENT:
════════════════════════════════════════════════════════
${ragContext}
════════════════════════════════════════════════════════

`
      : '';

    return `${contextSection}USER REQUEST: ${originalPrompt}

════════════════════════════════════════════════════════
MANDATORY INSTRUCTIONS — VIOLATION IS NOT ACCEPTABLE:
════════════════════════════════════════════════════════

YOU MUST USE THE REAL DATA FROM THE PDF ABOVE:
• Every person's name mentioned → display it in the website
• Every phone number → show it on the Contact page
• Every email address → show it on the Contact page  
• Every physical address → show it on the Contact page
• Every achievement/award → list it on an Achievements page
• Every program/course/activity → list it
• The organization/department name → use it in <h1> and <title>
• Head of Department / Principal / Director name → show in hero section
• DO NOT write "Lorem ipsum", "Name Here", "+91 XXXXXXXXXX", or any placeholder
• Every single section must contain REAL text from the PDF above

PAGES TO GENERATE (minimum 4):
1. home — hero with org name, tagline, key highlights
2. about — detailed description from document content
3. achievements — ALL achievements, awards, milestones from document
4. contact — REAL phone, email, address from document

OUTPUT FORMAT (follow exactly):

===PAGE_NAME:home===
===HTML===
[Complete standalone HTML page with embedded <style> tags]
===END HTML===
===END PAGE===

===PAGE_NAME:about===
===HTML===
[Complete standalone HTML page with embedded <style> tags]
===END HTML===
===END PAGE===

[continue for each page]

NAVIGATION: Each page must have a nav bar. For preview navigation use:
onclick="parent.switchPage('pageid')" on nav links.

Generate the complete website now using the PDF content above.`;
  }

  getRAGContext(ragContextId: string): RAGContext | undefined {
    return this.ragContexts.get(ragContextId);
  }

  listRAGContexts(): RAGContext[] {
    return Array.from(this.ragContexts.values());
  }

  deleteRAGContext(ragContextId: string): boolean {
    return this.ragContexts.delete(ragContextId);
  }

  clearAllContexts(): void {
    this.ragContexts.clear();
  }

  getStats() {
    const contexts = Array.from(this.ragContexts.values());
    return {
      activeContexts: this.ragContexts.size,
      totalChunks: contexts.reduce((s, c) => s + c.metadata.totalChunks, 0),
      totalWords: contexts.reduce((s, c) => s + c.metadata.totalWords, 0),
      totalImages: contexts.reduce((s, c) => s + c.imageIds.length, 0),
    };
  }
}

export const ragPipelineService = new RAGPipelineService();
