import { NextRequest, NextResponse } from 'next/server';
import { webForgeService } from '@/services/webforge.service';
import { GenerationRequest } from '@/types';

// ✅ FIX: was 60 — Next.js was killing the request before Claude finished.
// Full pipeline takes ~120s: RAG retrieval + intent + design + Claude generation + quality.
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body: GenerationRequest = await request.json();

    if (!body.prompt || body.prompt.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Prompt is required' },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'Anthropic API key not configured' },
        { status: 500 }
      );
    }

    console.log('Received generation request:', {
      promptLength: body.prompt.length,
      hasDocuments: !!body.documents && body.documents.length > 0,
      hasPreferences: !!body.designPreferences,
      // ✅ Log ragContextId so we can confirm it's arriving
      ragContextId: body.ragContextId || 'NONE',
    });

    const result = await webForgeService.generateWebsite(body);

    if (!result.success) {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in generation endpoint:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
