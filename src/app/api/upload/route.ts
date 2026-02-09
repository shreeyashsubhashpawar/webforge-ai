import { NextRequest, NextResponse } from 'next/server';
import { documentProcessingService } from '@/services/documentProcessing.service';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export const maxDuration = 30;

const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads');

/**
 * POST /api/upload
 * Handle document uploads
 */
export async function POST(request: NextRequest) {
  try {
    // Ensure upload directory exists
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No files uploaded' },
        { status: 400 }
      );
    }

    const processedFiles = [];

    for (const file of files) {
      try {
        // Validate file type
        const allowedTypes = [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain',
        ];

        if (!allowedTypes.includes(file.type) && !file.name.match(/\.(pdf|docx|txt)$/i)) {
          console.warn(`Skipping unsupported file type: ${file.type}`);
          continue;
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          console.warn(`File too large: ${file.name} (${file.size} bytes)`);
          continue;
        }

        // Read file buffer
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Save file to disk
        const fileName = `${Date.now()}-${file.name}`;
        const filePath = join(UPLOAD_DIR, fileName);
        await writeFile(filePath, buffer);

        // Process the document
        const processed = await documentProcessingService.processDocument(
          buffer,
          file.name,
          file.type
        );

        processedFiles.push({
          id: processed.id,
          name: file.name,
          type: file.type,
          size: file.size,
          wordCount: processed.metadata.wordCount,
          pageCount: processed.metadata.pageCount,
          uploadedAt: new Date().toISOString(),
          filePath: `/uploads/${fileName}`,
        });
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
      }
    }

    if (processedFiles.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No files could be processed' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      files: processedFiles,
      count: processedFiles.length,
    });
  } catch (error) {
    console.error('Error in upload endpoint:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      },
      { status: 500 }
    );
  }
}
