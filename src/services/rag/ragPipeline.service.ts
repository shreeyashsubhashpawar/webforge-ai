import { v4 as uuidv4 } from 'uuid';
import { ChunkedDocument, TextChunk, chunkingService } from '@/lib/rag/chunking';
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
    topK: number = parseInt(process.env.RAG_TOP_K_RETRIEVAL || '5', 10),
    similarityThreshold: number = parseFloat(process.env.RAG_SIMILARITY_THRESHOLD || '0.3')
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

      console.log(`[RAG Pipeline] Retrieving context for: "${query.substring(0, 50)}..."`);

      const queryEmbedding = await ollamaService.generateEmbedding(query);

      const similarities = ragContext.vectorIndex.map((item) => ({
        ...item,
        similarity: ollamaService.cosineSimilarity(queryEmbedding, item.embedding),
      }));

      const sorted = similarities
        .sort((a, b) => b.similarity - a.similarity)
        .filter((item) => item.similarity >= this.similarityThreshold)
        .slice(0, this.topK);

      console.log(`[RAG Pipeline] Retrieved ${sorted.length} chunks (threshold: ${this.similarityThreshold})`);

      const contextLines: string[] = [];
      const relatedImages = new Set<string>();
      const retrievedChunks: TextChunk[] = [];

      for (const item of sorted) {
        contextLines.push(`[Page ${item.pageNumber}, Chunk ${item.chunkIndex}]\n${item.text}`);
        item.relatedImages?.forEach((img) => relatedImages.add(img));
        const chunk = ragContext.chunks.find((c) => c.id === item.chunkId);
        if (chunk) retrievedChunks.push(chunk);
      }

      return {
        chunks: retrievedChunks,
        similarity: sorted.map((i) => i.similarity),
        images: Array.from(relatedImages),
        context: contextLines.join('\n\n'),
      };
    } catch (error) {
      console.error('[RAG Pipeline] Error retrieving context:', error);
      throw error;
    }
  }

  buildAugmentedPrompt(originalPrompt: string, ragContext: string, images: string[]): string {
    let augmented = 'You are a professional web developer creating a website based on provided information.\n\n';
    if (ragContext) {
      augmented += '=== INFORMATION FROM UPLOADED DOCUMENT ===\n' + ragContext + '\n\n';
    }
    if (images.length > 0) {
      augmented += `=== AVAILABLE IMAGES (${images.length} total) ===\n`;
      images.forEach((img, i) => { augmented += `${i + 1}. Image reference: ${img}\n`; });
      augmented += '\nInclude these images in the website where relevant.\n\n';
    }
    augmented += '=== USER REQUIREMENTS ===\n' + originalPrompt;
    augmented += '\n\n=== INSTRUCTIONS ===\nCreate a professional website that incorporates all the information and images provided above.\n';
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
