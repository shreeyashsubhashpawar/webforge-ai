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
  // ✅ FIX: Lower threshold so chunks actually pass — nomic-embed-text
  // rarely scores above 0.4 with short queries. 0.0 = return all, rely on topK.
  private similarityThreshold: number;

  constructor(
    topK: number = parseInt(process.env.RAG_TOP_K_RETRIEVAL || '10', 10),
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

      // Build fullText using === PAGE N === format — matches chunking.ts splitter regex
      const fullText = pdfContent.pages
        .map((p) => `=== PAGE ${p.pageNumber} ===\n${p.text}`)
        .join('\n\n');

      console.log(`[RAG Pipeline] Chunking document... (${fullText.length} chars, ${pdfContent.pages.length} pages)`);

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

      console.log(`[RAG Pipeline] Generating embeddings for ${chunkedDoc.chunks.length} chunks...`);
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
      if (!ragContext) throw new Error(`RAG context not found: ${ragContextId}`);

      console.log(`[RAG Pipeline] Retrieving context for: "${query.substring(0, 60)}"`);

      // ─────────────────────────────────────────────────────────────────────
      // STRATEGY: For website generation, we want ALL document content,
      // not just semantically similar chunks. Department names, phone numbers,
      // addresses, achievements — all of it matters regardless of query.
      //
      // So we: (1) try cosine similarity retrieval, (2) if too few chunks
      // pass, fall back to returning ALL chunks sorted by page order.
      // This guarantees PDF content always reaches Claude.
      // ─────────────────────────────────────────────────────────────────────

      let selected: (VectorIndex & { similarity: number })[] = [];

      try {
        const queryEmbedding = await ollamaService.generateEmbedding(query);
        const similarities = ragContext.vectorIndex.map((item) => ({
          ...item,
          similarity: ollamaService.cosineSimilarity(queryEmbedding, item.embedding),
        }));

        selected = similarities
          .sort((a, b) => b.similarity - a.similarity)
          .filter((item) => item.similarity >= this.similarityThreshold)
          .slice(0, this.topK);

        console.log(`[RAG Pipeline] Similarity retrieval: ${selected.length} chunks (threshold: ${this.similarityThreshold})`);
      } catch (embErr) {
        console.warn('[RAG Pipeline] Embedding failed, using all chunks:', embErr);
      }

      // Fallback: if no chunks retrieved, use ALL chunks sorted by page
      if (selected.length === 0) {
        console.log('[RAG Pipeline] Fallback: returning all chunks sorted by page');
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

      console.log(`[RAG Pipeline] Final context: ${selected.length} chunks, ~${contextLines.join('\n\n').length} chars`);

      return {
        chunks: retrievedChunks,
        similarity: selected.map((i) => i.similarity),
        images: Array.from(relatedImages),
        context: contextLines.join('\n\n'),
      };
    } catch (error) {
      console.error('[RAG Pipeline] Error retrieving context:', error);
      throw error;
    }
  }

  /**
   * Build the augmented prompt that Claude will receive.
   *
   * ✅ FIX: The original prompt was too generic. It didn't tell Claude to
   * extract and display specific data (names, phone numbers, achievements,
   * addresses). Now it explicitly instructs Claude to use every piece of
   * information from the document as actual website content.
   */
  buildAugmentedPrompt(originalPrompt: string, ragContext: string, images: string[]): string {
    let augmented = '';

    augmented += `You are an expert web developer. Your job is to build a complete, real website using the ACTUAL CONTENT extracted from the uploaded PDF document below.\n\n`;

    if (ragContext && ragContext.trim().length > 0) {
      augmented += `════════════════════════════════════════════════
DOCUMENT CONTENT (extracted from uploaded PDF)
════════════════════════════════════════════════
${ragContext}
════════════════════════════════════════════════\n\n`;
    }

    augmented += `USER'S WEBSITE REQUEST:\n${originalPrompt}\n\n`;

    augmented += `════════════════════════════════════════════════
CRITICAL INSTRUCTIONS — YOU MUST FOLLOW ALL OF THESE:
════════════════════════════════════════════════

1. USE REAL DATA FROM THE DOCUMENT:
   - Extract and display ALL actual names, phone numbers, email addresses, physical addresses
   - Show ALL real achievements, milestones, and accomplishments from the document
   - Include ALL department names, faculty names, HOD/PD names mentioned
   - Display ALL programs, courses, activities listed
   - Show ALL statistics, years, numbers mentioned in the document
   - DO NOT invent placeholder data (e.g. "John Doe", "+91 XXXXXXXXXX", "lorem ipsum")
   - Every section of the website MUST contain real content from the document

2. WEBSITE STRUCTURE:
   - Create multiple pages: Home, About, Achievements, Faculty/Team, Contact, etc.
   - The hero/header section MUST show the real organization/department name from the document
   - Contact page MUST show the actual phone, email, address from the document
   - About page MUST describe the real department/organization using document content

3. DESIGN:
   - Professional, modern design appropriate to the organization type
   - Fully responsive (mobile + desktop)
   - Consistent navigation across all pages

Now generate the complete website using the document content above.\n`;

    return augmented;
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
    console.log('[RAG Pipeline] Cleared all RAG contexts');
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
