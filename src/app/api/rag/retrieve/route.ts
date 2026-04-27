import { NextRequest, NextResponse } from 'next/server';
import { ragPipelineService } from '@/services/rag/ragPipeline.service';

export const maxDuration = 30;

/**
 * POST /api/rag/retrieve
 * Retrieve relevant context from RAG for a given query
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ragContextId, query } = body;

    if (!ragContextId || !query) {
      return NextResponse.json(
        { success: false, error: 'Missing ragContextId or query' },
        { status: 400 }
      );
    }

    console.log('[RAG Retrieve API] Retrieving context for query:', query.substring(0, 50));

    // Retrieve relevant context
    const retrievalResult = await ragPipelineService.retrieveContext(ragContextId, query);

    return NextResponse.json({
      success: true,
      context: retrievalResult.context,
      relevantChunks: retrievalResult.chunks.length,
      images: retrievalResult.images,
      similarities: retrievalResult.similarity,
      message: `Retrieved ${retrievalResult.chunks.length} relevant chunks`,
    });
  } catch (error) {
    console.error('[RAG Retrieve API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: `Context retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/rag/retrieve
 * Get RAG pipeline statistics
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');

    if (action === 'stats') {
      const stats = ragPipelineService.getStats();
      return NextResponse.json({
        success: true,
        stats,
      });
    }

    if (action === 'contexts') {
      const contexts = ragPipelineService.listRAGContexts();
      return NextResponse.json({
        success: true,
        contexts: contexts.map((ctx) => ({
          id: ctx.id,
          documentName: ctx.documentName,
          chunks: ctx.metadata.totalChunks,
          words: ctx.metadata.totalWords,
          images: ctx.imageIds.length,
          createdAt: ctx.metadata.createdAt,
        })),
      });
    }

    return NextResponse.json(
      { success: false, error: 'Unknown action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[RAG API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}
