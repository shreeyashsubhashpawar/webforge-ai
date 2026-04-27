import { UploadedDocument, ProcessedDocument, DocumentChunk } from '@/types';
import mammoth from 'mammoth';

export class DocumentProcessingService {
  /**
   * Process uploaded documents and extract text content
   */
  async processDocument(file: Buffer, fileName: string, fileType: string): Promise<ProcessedDocument> {
    let text = '';
    let metadata: any = {};

    try {
      if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
        // For PDF, we'll use a graceful fallback
        // Note: pdf-parse can have file system access issues in some environments
        // We'll extract metadata from filename and provide a summary message
        const baseName = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        text = `Document: ${baseName}\n\nThis is a PDF document. For detailed text extraction, please use the RAG pipeline in Step 3 of the wizard.`;
        metadata.pageCount = 1;
        metadata.isPDF = true;
        console.log(`Processing PDF: ${fileName} (using fallback handler)`);
      } else if (
        fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        fileName.endsWith('.docx')
      ) {
        const result = await mammoth.extractRawText({ buffer: file });
        text = result.value;
      } else if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
        text = file.toString('utf-8');
      } else {
        throw new Error(`Unsupported file type: ${fileType}`);
      }

      // Clean and normalize text
      text = this.cleanText(text);

      // Split into chunks for RAG
      const chunks = this.chunkText(text);

      return {
        id: this.generateId(),
        originalName: fileName,
        text,
        chunks,
        metadata: {
          ...metadata,
          wordCount: text.split(/\s+/).length,
          extractedAt: new Date(),
        },
      };
    } catch (error) {
      console.error('Error processing document:', error);
      throw new Error(`Failed to process document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clean and normalize extracted text
   */
  private cleanText(text: string): string {
    return text
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\n{3,}/g, '\n\n') // Remove excessive newlines
      .replace(/[ \t]+/g, ' ') // Normalize whitespace
      .replace(/^\s+|\s+$/gm, '') // Trim lines
      .trim();
  }

  /**
   * Split text into chunks for better RAG retrieval
   * Uses semantic chunking based on paragraphs with overlap
   */
  private chunkText(
    text: string,
    chunkSize: number = 1000,
    overlap: number = 200
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    
    // Split by paragraphs first
    const paragraphs = text.split(/\n\n+/);
    
    let currentChunk = '';
    let chunkIndex = 0;

    for (const paragraph of paragraphs) {
      // If adding this paragraph would exceed chunk size, save current chunk
      if (currentChunk.length + paragraph.length > chunkSize && currentChunk.length > 0) {
        chunks.push({
          id: `chunk-${chunkIndex}`,
          text: currentChunk.trim(),
          documentId: '', // Will be set later
          chunkIndex,
        });

        // Create overlap by including end of previous chunk
        const words = currentChunk.split(/\s+/);
        const overlapWords = words.slice(-Math.floor(overlap / 5)); // Approximate overlap in words
        currentChunk = overlapWords.join(' ') + ' ' + paragraph;
        chunkIndex++;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      }
    }

    // Add the last chunk
    if (currentChunk.trim().length > 0) {
      chunks.push({
        id: `chunk-${chunkIndex}`,
        text: currentChunk.trim(),
        documentId: '',
        chunkIndex,
      });
    }

    return chunks;
  }

  /**
   * Extract key information and metadata from documents
   */
  async extractKeyInfo(document: ProcessedDocument): Promise<string> {
    // Extract bullet points, headings, and key phrases
    const lines = document.text.split('\n');
    const keyInfo: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Capture headings (UPPERCASE or Title Case lines)
      if (trimmed.length > 0 && trimmed.length < 100) {
        if (trimmed === trimmed.toUpperCase() && trimmed.split(/\s+/).length <= 10) {
          keyInfo.push(trimmed);
        }
      }

      // Capture bullet points
      if (/^[-•*]\s/.test(trimmed)) {
        keyInfo.push(trimmed);
      }

      // Capture numbered lists
      if (/^\d+\.\s/.test(trimmed)) {
        keyInfo.push(trimmed);
      }
    }

    return keyInfo.join('\n');
  }

  /**
   * Generate a summary of the document for context
   */
  async summarizeDocument(document: ProcessedDocument): Promise<string> {
    // Take first and last portions of the document
    const maxLength = 500;
    const text = document.text;

    if (text.length <= maxLength * 2) {
      return text;
    }

    const beginning = text.substring(0, maxLength);
    const ending = text.substring(text.length - maxLength);

    return `${beginning}\n\n[...]\n\n${ending}`;
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `doc-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Process multiple documents
   */
  async processMultipleDocuments(
    files: Array<{ buffer: Buffer; fileName: string; fileType: string }>
  ): Promise<ProcessedDocument[]> {
    const results = await Promise.all(
      files.map(file =>
        this.processDocument(file.buffer, file.fileName, file.fileType)
      )
    );

    return results;
  }
}

export const documentProcessingService = new DocumentProcessingService();
