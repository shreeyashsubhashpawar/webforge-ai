import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { mkdir } from 'fs/promises';
import { pdfExtractorService } from '@/services/rag/pdfExtractor.service';
import { ragPipelineService } from '@/services/rag/ragPipeline.service';
import { ollamaService } from '@/services/rag/ollama.service';

export const maxDuration = 60;

/**
 * POST /api/rag/process
 * Process a PDF file through the RAG pipeline
 * Accepts file data as base64 data URL or binary in the request body
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[RAG API] Processing PDF for RAG pipeline...');

    // Parse FormData with file
    let fileName: string;
    let fileBuffer: Buffer;
    let filePath: string;

    try {
      const formData = await request.formData();
      const file = formData.get('file') as File;

      if (!file) {
        console.error('[RAG API] No file in FormData');
        return NextResponse.json(
          { success: false, error: 'No file uploaded' },
          { status: 400 }
        );
      }

      fileName = file.name;
      console.log('[RAG API] Received file:', {
        name: fileName,
        size: file.size,
        type: file.type,
      });

      // Convert File to Buffer
      const arrayBuffer = await file.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
      console.log('[RAG API] Converted file to buffer:', fileBuffer.length, 'bytes');
    } catch (error) {
      console.error('[RAG API] Failed to parse FormData:', error);
      return NextResponse.json(
        { success: false, error: 'Invalid file format - must be Form Data' },
        { status: 400 }
      );
    }

    // Create temp directory if doesn't exist
    const uploadsDir = join(process.cwd(), 'public', 'uploads');
    try {
      await mkdir(uploadsDir, { recursive: true });
    } catch (error) {
      console.warn('[RAG API] Could not create uploads directory:', error);
    }

    // Write file to temp location
    filePath = join(uploadsDir, `${Date.now()}_${fileName}`);
    
    try {
      await writeFile(filePath, fileBuffer);
      console.log('[RAG API] File saved to:', filePath, 'Size:', fileBuffer.length);
    } catch (error) {
      console.error('[RAG API] Failed to save file:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to save uploaded file' },
        { status: 500 }
      );
    }

    // Step 1: Check Ollama health
    const ollamaHealthy = await ollamaService.healthCheck();
    if (!ollamaHealthy) {
      return NextResponse.json(
        {
          success: false,
          error: 'Ollama service is not available. Ensure Ollama is running on localhost:11434',
        },
        { status: 503 }
      );
    }

    // Step 2: Extract PDF content
    console.log('[RAG API] Extracting PDF content...');
    let pdfContent;
    try {
      pdfContent = await pdfExtractorService.extractFromPDF(filePath);
    } catch (error) {
      console.error('[RAG API] PDF extraction failed:', error);
      return NextResponse.json(
        {
          success: false,
          error: `PDF extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
        { status: 400 }
      );
    }

    // Step 3: Process through RAG pipeline
    console.log('[RAG API] Processing through RAG pipeline...');
    let ragContext;
    try {
      ragContext = await ragPipelineService.processPDFContent(pdfContent);
    } catch (error) {
      console.error('[RAG API] RAG processing failed:', error);
      return NextResponse.json(
        {
          success: false,
          error: `RAG processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
        { status: 400 }
      );
    }

    // Step 4: Save any extracted images
    try {
      await pdfExtractorService.saveExtractedImages(pdfContent);
    } catch (error) {
      console.warn('[RAG API] Warning: Failed to save images:', error);
      // Continue even if image saving fails
    }

    console.log('[RAG API] RAG processing complete');

    return NextResponse.json({
      success: true,
      ragContextId: ragContext.id,
      stats: {
        pages: pdfContent.metadata.totalPages,
        chunks: ragContext.metadata.totalChunks,
        words: ragContext.metadata.totalWords,
        images: ragContext.imageIds.length,
      },
      message: `Processed ${pdfContent.metadata.totalPages} pages, created ${ragContext.metadata.totalChunks} chunks`,
    });
  } catch (error) {
    console.error('[RAG API] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}
