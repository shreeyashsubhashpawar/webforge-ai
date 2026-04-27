import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface ExtractedImage {
  id: string;
  pageNumber: number;
  base64?: string;
  localPath?: string;
  metadata: {
    width?: number;
    height?: number;
    extractedAt: Date;
  };
}

export interface ExtractedPage {
  pageNumber: number;
  text: string;
  images: ExtractedImage[];
  metadata: {
    fontSize?: number;
    fontFamily?: string;
  };
}

export interface ExtractedPDFContent {
  id: string;
  fileName: string;
  pages: ExtractedPage[];
  metadata: {
    totalPages: number;
    totalImages: number;
    extractedAt: Date;
    fileSize: number;
  };
}

export class PDFExtractorService {
  private uploadDir: string;
  private imageDir: string;

  constructor(uploadDir: string = process.env.UPLOAD_DIR || 'public/uploads') {
    this.uploadDir = uploadDir;
    this.imageDir = path.join(uploadDir, 'images');
  }

  async extractFromPDF(filePath: string): Promise<ExtractedPDFContent> {
    try {
      console.log(`[PDF Extractor] Processing: ${filePath}`);

      const fileBuffer = await fs.readFile(filePath);
      const fileName = path.basename(filePath);

      // Use pdf-parse internal lib path to bypass the top-level
      // readFileSync('test/data/05-versions-space.pdf') bug in pdf-parse/index.js
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pdfParse = require('pdf-parse/lib/pdf-parse.js');
      const parsed = await pdfParse(fileBuffer);

      const totalPages: number = parsed.numpages || 1;
      const fullText: string = parsed.text || '';

      console.log(`[PDF Extractor] pdf-parse: ${totalPages} pages, ${fullText.length} chars`);

      const pages = this.splitIntoPages(fullText, totalPages);
      pages.forEach((p) =>
        console.log(`[PDF Extractor] Page ${p.pageNumber}: ${p.text.length} chars`)
      );

      const extractedContent: ExtractedPDFContent = {
        id: uuidv4(),
        fileName,
        pages,
        metadata: {
          totalPages: pages.length,
          totalImages: 0,
          extractedAt: new Date(),
          fileSize: fileBuffer.length,
        },
      };

      console.log(`[PDF Extractor] Complete: ${pages.length} pages extracted`);
      return extractedContent;
    } catch (error) {
      console.error('[PDF Extractor] Error:', error);
      throw new Error(
        `Failed to extract PDF content: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private splitIntoPages(fullText: string, totalPages: number): ExtractedPage[] {
    if (!fullText || fullText.trim().length === 0) {
      return [{
        pageNumber: 1,
        text: '(no text content extracted)',
        images: [],
        metadata: { fontSize: 12, fontFamily: 'Arial' },
      }];
    }

    // pdf-parse emits \f (form-feed) between pages for most PDFs
    const byFormFeed = fullText
      .split('\f')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const segments =
      byFormFeed.length >= 1 && byFormFeed.length <= totalPages + 3
        ? byFormFeed
        : this.splitEvenly(fullText, totalPages);

    return segments.map((text, index) => ({
      pageNumber: index + 1,
      text: text.trim(),
      images: [],
      metadata: { fontSize: 12, fontFamily: 'Arial' },
    }));
  }

  private splitEvenly(text: string, numPages: number): string[] {
    if (numPages <= 1) return [text];
    const chunkSize = Math.ceil(text.length / numPages);
    const chunks: string[] = [];
    for (let i = 0; i < numPages; i++) {
      const chunk = text.slice(i * chunkSize, (i + 1) * chunkSize).trim();
      if (chunk.length > 0) chunks.push(chunk);
    }
    return chunks;
  }

  async saveExtractedImages(_content: ExtractedPDFContent): Promise<void> {
    console.log('[PDF Extractor] Image saving skipped (text-only extraction)');
  }

  getFullText(content: ExtractedPDFContent): string {
    return content.pages
      .map((p) => `--- Page ${p.pageNumber} ---\n${p.text}`)
      .join('\n\n');
  }

  getStructuredText(content: ExtractedPDFContent): string {
    return content.pages
      .map((p) => `\n=== PAGE ${p.pageNumber} ===\n${p.text}`)
      .join('\n');
  }
}

export const pdfExtractorService = new PDFExtractorService();
