import { v4 as uuidv4 } from 'uuid';

export interface ChunkMetadata {
  pageNumber: number;
  chunkIndex: number;
  relatedImages?: string[];
  section?: string;
  wordCount: number;
}

export interface TextChunk {
  id: string;
  text: string;
  metadata: ChunkMetadata;
  embedding?: number[];
}

export interface ChunkedDocument {
  id: string;
  originalName: string;
  chunks: TextChunk[];
  imageIds: string[];
  metadata: {
    totalChunks: number;
    totalWordCount: number;
    chunkSize: number;
    overlapSize: number;
  };
}

export class ChunkingService {
  private chunkSize: number;   // in tokens (~4 chars per token)
  private overlapSize: number; // in tokens
  private readonly tokensPerWord: number = 1.3;

  constructor(
    chunkSize: number = parseInt(process.env.RAG_CHUNK_SIZE || '500', 10),
    overlapSize: number = parseInt(process.env.RAG_CHUNK_OVERLAP || '50', 10)
  ) {
    this.chunkSize = chunkSize;
    // ── CRITICAL FIX ─────────────────────────────────────────────────────────
    // Overlap MUST be strictly less than chunkSize, otherwise startPos can
    // move backwards → infinite loop → heap out of memory.
    // Cap overlap at 20% of chunkSize as a hard safety limit.
    this.overlapSize = Math.min(overlapSize, Math.floor(chunkSize * 0.2));
    // ─────────────────────────────────────────────────────────────────────────
  }

  private tokensToChars(tokens: number): number {
    return Math.ceil(tokens * 4);
  }

  private charsToTokens(chars: number): number {
    return Math.ceil(chars / 4);
  }

  private chunkText(
    text: string,
    pageNumber: number,
    relatedImages: string[] = []
  ): TextChunk[] {
    const chunks: TextChunk[] = [];

    if (!text || text.trim().length === 0) {
      return chunks;
    }

    const cleanText = text.replace(/\s+/g, ' ').trim();
    const chunkCharSize = this.tokensToChars(this.chunkSize);
    const overlapCharSize = this.tokensToChars(this.overlapSize);

    // Sanity: overlapCharSize must always be < chunkCharSize
    const safeOverlap = Math.min(overlapCharSize, Math.floor(chunkCharSize * 0.2));

    let startPos = 0;
    let chunkIndex = 0;
    let iterations = 0;
    const maxIterations = Math.ceil(cleanText.length / Math.max(chunkCharSize - safeOverlap, 1)) + 10;

    while (startPos < cleanText.length) {
      // ── Safety valve: bail out if something is very wrong ──────────────────
      iterations++;
      if (iterations > maxIterations) {
        console.warn(`[Chunking] Safety limit hit at page ${pageNumber}, breaking loop`);
        break;
      }
      // ───────────────────────────────────────────────────────────────────────

      let endPos = Math.min(startPos + chunkCharSize, cleanText.length);

      // Try to break on a word boundary (only if not already at end)
      if (endPos < cleanText.length) {
        const lastSpace = cleanText.lastIndexOf(' ', endPos);
        if (lastSpace > startPos + Math.floor(chunkCharSize / 2)) {
          endPos = lastSpace;
        }
      }

      const chunkText = cleanText.substring(startPos, endPos).trim();

      if (chunkText.length > 0) {
        const wordCount = chunkText.split(/\s+/).length;
        chunks.push({
          id: uuidv4(),
          text: chunkText,
          metadata: {
            pageNumber,
            chunkIndex,
            relatedImages: relatedImages.length > 0 ? relatedImages : undefined,
            wordCount,
          },
        });
        chunkIndex++;
      }

      // ── CRITICAL: always advance by at least 1 character ──────────────────
      // Old code: startPos = endPos - overlapCharSize
      // If overlapCharSize >= (endPos - startPos), startPos goes backwards → ∞ loop
      const nextStart = endPos - safeOverlap;
      startPos = Math.max(nextStart, startPos + 1); // guaranteed forward progress
      // ───────────────────────────────────────────────────────────────────────
    }

    return chunks;
  }

  chunkDocument(
    documentId: string,
    documentName: string,
    structuredText: string,
    pageImageMap: Map<number, string[]>,
    imageData?: Array<{ pageNumber: number; id: string }>
  ): ChunkedDocument {
    const chunks: TextChunk[] = [];
    const allImageIds = new Set<string>();

    // Split on === PAGE N === markers (written by ragPipeline.service.ts)
    const pageTexts = structuredText.split(/=== PAGE \d+ ===/);

    pageTexts.forEach((pageText, index) => {
      if (pageText.trim().length === 0) return;

      const pageNumber = index + 1;
      const relatedImages = pageImageMap.get(pageNumber) || [];
      relatedImages.forEach((imgId) => allImageIds.add(imgId));

      const pageChunks = this.chunkText(pageText, pageNumber, relatedImages);
      chunks.push(...pageChunks);
    });

    // If the split produced nothing (edge case: no === PAGE === markers),
    // chunk the whole text as page 1.
    if (chunks.length === 0 && structuredText.trim().length > 0) {
      console.warn('[Chunking] No page markers found — chunking entire text as page 1');
      const fallback = this.chunkText(structuredText, 1, []);
      chunks.push(...fallback);
    }

    const totalWordCount = chunks.reduce((sum, chunk) => sum + chunk.metadata.wordCount, 0);

    const chunkedDoc: ChunkedDocument = {
      id: documentId,
      originalName: documentName,
      chunks,
      imageIds: Array.from(allImageIds),
      metadata: {
        totalChunks: chunks.length,
        totalWordCount,
        chunkSize: this.chunkSize,
        overlapSize: this.overlapSize,
      },
    };

    console.log(
      `[Chunking] '${documentName}': ${chunks.length} chunks, ${totalWordCount} words, ${allImageIds.size} images`
    );

    return chunkedDoc;
  }

  chunkSimpleText(text: string, maxChunks: number = 1): TextChunk[] {
    const chunkSize = Math.max(this.tokensToChars(this.chunkSize), text.length);
    const chunk = text.substring(0, chunkSize);
    const wordCount = chunk.split(/\s+/).length;
    return [
      {
        id: uuidv4(),
        text: chunk,
        metadata: { pageNumber: 1, chunkIndex: 0, wordCount },
      },
    ];
  }

  getChunkStats(chunks: TextChunk[]) {
    const totalWords = chunks.reduce((sum, c) => sum + c.metadata.wordCount, 0);
    const avgChunkSize = chunks.length > 0 ? totalWords / chunks.length : 0;
    const minChunkSize = chunks.length > 0 ? Math.min(...chunks.map((c) => c.metadata.wordCount)) : 0;
    const maxChunkSize = chunks.length > 0 ? Math.max(...chunks.map((c) => c.metadata.wordCount)) : 0;
    return {
      totalChunks: chunks.length,
      totalWords,
      averageChunkSize: avgChunkSize,
      minChunkSize,
      maxChunkSize,
      estimatedTokens: Math.ceil(totalWords * this.tokensPerWord),
    };
  }
}

export const chunkingService = new ChunkingService();
