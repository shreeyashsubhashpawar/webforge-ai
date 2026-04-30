import {
  GenerationRequest,
  GenerationResponse,
  ProcessedDocument,
  RAGContextData,
  GeneratedCode,
  WebPage,
} from '@/types';
import { intentClassificationService } from './intentClassification.service';
import { designRecommendationService } from './designRecommendation.service';
import { documentProcessingService } from './documentProcessing.service';
import { codeGenerationService } from './codeGeneration.service';
import { qualityScoringService } from './qualityScoring.service';
import { ragPipelineService } from './rag/ragPipeline.service';
import { claudeService } from './claude.service';

export class WebForgeService {
  async generateWebsite(request: GenerationRequest): Promise<GenerationResponse> {
    const startTime = Date.now();

    try {
      console.log('🚀 Starting WebForge AI generation pipeline...');

      // ── Step 1: Retrieve RAG context ─────────────────────────────────────
      let ragRetrievalResult;
      let ragContextData: RAGContextData | undefined;
      let documentContext = '';

      if (request.ragContextId) {
        console.log('📚 Step 1/6: Retrieving RAG context...');
        try {
          // getRAGContext for response metadata
          ragContextData = ragPipelineService.getRAGContext(request.ragContextId) as any;

          // retrieveContext loads from disk if not in memory
          ragRetrievalResult = await ragPipelineService.retrieveContext(
            request.ragContextId,
            request.prompt
          );

          documentContext = ragRetrievalResult.context;
          console.log(`✓ RAG context retrieved: ${ragRetrievalResult.chunks.length} chunks, ${documentContext.length} chars`);
        } catch (ragError) {
          console.warn('⚠ RAG retrieval failed:', ragError);
        }
      } else {
        console.log('📄 Step 1/6: No RAG context provided');
      }

      // ── Step 2: Intent classification ────────────────────────────────────
      console.log('🎯 Step 2/6: Classifying user intent...');
      const intent = await intentClassificationService.classifyIntent(request.prompt);
      console.log(`Intent: ${intent.primaryIntent} (${(intent.confidence * 100).toFixed(0)}%)`);

      // ── Step 3: Design recommendations ───────────────────────────────────
      console.log('🎨 Step 3/6: Generating design recommendations...');
      const design = await designRecommendationService.generateDesignRecommendations(intent);
      console.log(`Design system: ${design.components.length} components`);

      if (request.designPreferences) {
        Object.assign(design, request.designPreferences);
        console.log('Applied user design preferences');
      }

      // ── Step 4: Generate website code ────────────────────────────────────
      console.log('💻 Step 4/6: Generating website code with Claude...');

      let code: GeneratedCode;

      if (documentContext && documentContext.trim().length > 0) {
        // ✅ GENERATE PAGES ONE AT A TIME to avoid token limit truncation.
        // A full 4-page website exceeds 8192 tokens. We call Claude 4 times,
        // once per page, each with the full document context. This guarantees
        // every page is complete and contains real PDF data.
        console.log('[WebForge] RAG context available — generating pages individually');
        code = await this.generatePagesIndividually(request.prompt, documentContext, design);
      } else {
        console.log('[WebForge] No RAG context — standard generation');
        const augmented = ragRetrievalResult
          ? ragPipelineService.buildAugmentedPrompt(request.prompt, '', [])
          : request.prompt;
        code = await codeGenerationService.generateWebsite(intent, design, [], augmented);
      }

      if (code.pages && code.pages.length > 0) {
        const totalHtml = code.pages.reduce((s, p) => s + p.html.length, 0);
        console.log(`Code generated: ${code.pages.length} pages, ${totalHtml} chars total`);
      }

      // ── Step 5: Quality evaluation ────────────────────────────────────────
      console.log('✅ Step 5/6: Evaluating code quality...');
      const quality = await qualityScoringService.evaluateCode(code);
      console.log(`Quality score: ${quality.overall}/100`);

      // ── Step 6: Prepare response ──────────────────────────────────────────
      console.log('📦 Step 6/6: Preparing response...');
      const processingTime = Date.now() - startTime;
      console.log(`✨ Pipeline completed in ${(processingTime / 1000).toFixed(2)}s`);

      return {
        success: true,
        intent,
        design,
        code,
        quality,
        ragContext: ragContextData,
        augmentedPrompt: request.ragContextId ? '[RAG-augmented]' : undefined,
        processingTime,
      };
    } catch (error) {
      console.error('❌ Error in WebForge pipeline:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        processingTime: Date.now() - startTime,
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // generatePagesIndividually
  //
  // Calls Claude once per page. Each call gets:
  //   - The full document context
  //   - The user's original prompt
  //   - Which page to generate (home / about / services / contact)
  //
  // This avoids the max_tokens truncation that kills multi-page generation.
  // ─────────────────────────────────────────────────────────────────────────
  private async generatePagesIndividually(
    userPrompt: string,
    documentContext: string,
    design: any
  ): Promise<GeneratedCode> {
    const pageDefinitions = [
      {
        id: 'home',
        name: 'Home',
        instruction: 'Generate the HOME page. Include: hero section with the REAL company/organization name from the document, tagline, key statistics (employees, offices, years in operation), and a navigation bar linking to all 4 pages.',
      },
      {
        id: 'about',
        name: 'About',
        instruction: 'Generate the ABOUT page. Include: full company history/description using REAL content from the document, mission/vision if present, leadership team names if mentioned, and a navigation bar.',
      },
      {
        id: 'services',
        name: 'Services',
        instruction: 'Generate the SERVICES page. List ALL real services, products, capabilities, or departments mentioned in the document as cards or sections. Include a navigation bar.',
      },
      {
        id: 'contact',
        name: 'Contact',
        instruction: 'Generate the CONTACT page. Show ALL real phone numbers, email addresses, and office locations/addresses from the document. Include a navigation bar.',
      },
    ];

    const systemPrompt = `You are an expert web developer. Generate a SINGLE complete HTML page.

RULES:
1. Output ONLY ONE complete HTML document — start with <!DOCTYPE html> end with </html>
2. ALL CSS must be embedded inside <style> tags in the <head>
3. ALL JavaScript must be embedded inside <script> tags
4. Navigation links use: onclick="parent.switchPage('pageid'); return false;" href="#"
5. The page must be visually professional: gradients, cards, shadows, responsive
6. USE ONLY REAL DATA from the document — no placeholders, no lorem ipsum
7. Output ONLY the HTML document — no explanations, no markdown, no code fences`;

    const pages: WebPage[] = [];
    const navPageList = pageDefinitions.map(p => p.id).join(', ');

    for (const pageDef of pageDefinitions) {
      console.log(`[WebForge] Generating page: ${pageDef.name}...`);

      const pagePrompt = `════════════════════════════════════════
DOCUMENT CONTENT (source of all real data):
════════════════════════════════════════
${documentContext}
════════════════════════════════════════

USER REQUEST: ${userPrompt}

TASK: ${pageDef.instruction}

Navigation pages available: ${navPageList}
Use onclick="parent.switchPage('${pageDef.id === 'home' ? 'about' : pageDef.id}'); return false;" pattern for nav links.

Design colors:
- Primary: ${design.colorPalette?.primary || '#2563eb'}
- Secondary: ${design.colorPalette?.secondary || '#1e40af'}  
- Accent: ${design.colorPalette?.accent || '#f59e0b'}

Output a single complete HTML page now. Start with <!DOCTYPE html>`;

      try {
        const response = await claudeService.sendMessage(
          [{ role: 'user', content: pagePrompt }],
          {
            systemPrompt,
            temperature: 0.3,
            maxTokens: 8192,
          }
        );

        // Clean the response — remove any markdown fences
        let html = response
          .replace(/^```html\n?/i, '')
          .replace(/^```\n?/, '')
          .replace(/\n?```$/, '')
          .trim();

        // Ensure it starts with a doctype
        if (!html.toLowerCase().startsWith('<!doctype')) {
          const doctypeIdx = html.toLowerCase().indexOf('<!doctype');
          if (doctypeIdx > 0) {
            html = html.substring(doctypeIdx);
          }
        }

        console.log(`[WebForge] Page "${pageDef.name}" generated: ${html.length} chars`);

        pages.push({
          id: pageDef.id,
          name: pageDef.name,
          title: pageDef.name,
          html,
          css: '',
          javascript: '',
          route: `/${pageDef.id}`,
        });
      } catch (err) {
        console.error(`[WebForge] Failed to generate page "${pageDef.name}":`, err);
        // Add error page so the user sees something
        pages.push({
          id: pageDef.id,
          name: pageDef.name,
          title: pageDef.name,
          html: `<!DOCTYPE html><html><head><title>${pageDef.name}</title>
<style>body{font-family:sans-serif;padding:2rem;background:#1e293b;color:#fff}
.err{background:#ef4444;padding:1rem;border-radius:8px}</style></head>
<body><div class="err">⚠️ Failed to generate ${pageDef.name} page. Error: ${err instanceof Error ? err.message : 'Unknown'}</div></body></html>`,
          css: '',
          javascript: '',
          route: `/${pageDef.id}`,
        });
      }
    }

    const files = pages.map((page, idx) => ({
      name: idx === 0 ? 'index.html' : `${page.id}.html`,
      type: 'html' as const,
      content: page.html,
      path: idx === 0 ? 'index.html' : `${page.id}.html`,
    }));

    return {
      pages,
      website: { files, mainFile: 'index.html', framework: 'vanilla' },
      framework: 'vanilla',
      dependencies: [],
    };
  }

  async *generateWebsiteStream(request: GenerationRequest) {
    try {
      yield { step: 'intent', status: 'processing', message: 'Analyzing your request...' };
      const intent = await intentClassificationService.classifyIntent(request.prompt);
      yield { step: 'intent', status: 'complete', data: intent };

      yield { step: 'design', status: 'processing', message: 'Creating design system...' };
      const design = await designRecommendationService.generateDesignRecommendations(intent);
      yield { step: 'design', status: 'complete', data: design };

      yield { step: 'code', status: 'processing', message: 'Generating website code...' };
      const code = await codeGenerationService.generateWebsite(intent, design);
      yield { step: 'code', status: 'complete', data: code };

      yield { step: 'quality', status: 'processing', message: 'Evaluating code quality...' };
      const quality = await qualityScoringService.evaluateCode(code);
      yield { step: 'quality', status: 'complete', data: quality };

      yield { step: 'complete', status: 'complete', message: 'Done!', data: { intent, design, code, quality } };
    } catch (error) {
      yield { step: 'error', status: 'error', message: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async refineWebsite(currentCode: GenerationResponse, feedback: string): Promise<GenerationResponse> {
    const startTime = Date.now();
    try {
      if (!currentCode.code) throw new Error('No existing code to refine');
      const refinedCode = await codeGenerationService.refineCode(currentCode.code, feedback);
      const quality = await qualityScoringService.evaluateCode(refinedCode);
      return { success: true, intent: currentCode.intent, design: currentCode.design, code: refinedCode, quality, processingTime: Date.now() - startTime };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Refinement failed', processingTime: Date.now() - startTime };
    }
  }

  async updateDesign(currentGeneration: GenerationResponse, designFeedback: string): Promise<GenerationResponse> {
    try {
      if (!currentGeneration.design || !currentGeneration.intent) throw new Error('Missing design or intent');
      const updatedDesign = await designRecommendationService.refineRecommendations(currentGeneration.design, designFeedback);
      const code = await codeGenerationService.generateWebsite(currentGeneration.intent, updatedDesign);
      const quality = await qualityScoringService.evaluateCode(code);
      return { success: true, intent: currentGeneration.intent, design: updatedDesign, code, quality };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Design update failed' };
    }
  }
}

export const webForgeService = new WebForgeService();
