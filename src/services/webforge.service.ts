import {
  GenerationRequest,
  GenerationResponse,
  ProcessedDocument,
  RAGContextData,
  GeneratedCode,
} from '@/types';
import { intentClassificationService } from './intentClassification.service';
import { designRecommendationService } from './designRecommendation.service';
import { documentProcessingService } from './documentProcessing.service';
import { codeGenerationService } from './codeGeneration.service';
import { qualityScoringService } from './qualityScoring.service';
import { ragPipelineService } from './rag/ragPipeline.service';

/**
 * Main orchestration service that coordinates the entire WebForge AI pipeline
 */
export class WebForgeService {
  /**
   * Execute the complete WebForge AI pipeline with optional RAG context
   */
  async generateWebsite(request: GenerationRequest): Promise<GenerationResponse> {
    const startTime = Date.now();

    try {
      console.log('🚀 Starting WebForge AI generation pipeline...');

      // Step 1: Retrieve RAG context if provided
      let ragContext: RAGContextData | undefined;
      let augmentedPrompt = request.prompt;
      let ragRetrievalResult;

      if (request.ragContextId) {
        console.log('📚 Step 1/6: Retrieving RAG context...');
        try {
          ragContext = ragPipelineService.getRAGContext(request.ragContextId);

          if (ragContext) {
            console.log(
              `RAG context found: ${ragContext.metadata.totalChunks} chunks, ${ragContext.imageIds.length} images`
            );

            // Retrieve relevant chunks for the prompt
            ragRetrievalResult = await ragPipelineService.retrieveContext(
              request.ragContextId,
              request.prompt
            );

            console.log(
              `Retrieved ${ragRetrievalResult.chunks.length} relevant chunks for augmentation`
            );

            // Build augmented prompt
            augmentedPrompt = ragPipelineService.buildAugmentedPrompt(
              request.prompt,
              ragRetrievalResult.context,
              ragRetrievalResult.images
            );

            console.log('✓ Prompt augmented with RAG context');
          }
        } catch (ragError) {
          console.warn('⚠ RAG context retrieval failed, continuing without RAG:', ragError);
        }
      } else {
        console.log('📄 Step 1/6: Processing uploaded documents...');
      }

      // Step 2: Classify user intent (using augmented prompt if available)
      console.log('🎯 Step 2/6: Classifying user intent...');
      const intent = await intentClassificationService.classifyIntent(augmentedPrompt);
      console.log(`Intent identified: ${intent.primaryIntent} (${(intent.confidence * 100).toFixed(0)}% confidence)`);

      // Step 3: Generate design recommendations
      console.log('🎨 Step 3/6: Generating design recommendations...');
      const design = await designRecommendationService.generateDesignRecommendations(intent);
      console.log(`Design system created with ${design.components.length} components`);

      // Apply user design preferences if provided
      if (request.designPreferences) {
        Object.assign(design, request.designPreferences);
        console.log('Applied user design preferences');
      }

      // Step 4: Generate website code (Claude/Anthropic API)
      console.log('💻 Step 4/6: Generating website code with Claude...');
      const code = await codeGenerationService.generateWebsite(
        intent,
        design,
        [],
        augmentedPrompt // Pass augmented prompt for better code generation
      );

      // Log code generation stats based on new multi-page format
      if (code.pages && code.pages.length > 0) {
        const totalHtmlLength = code.pages.reduce((sum, page) => sum + page.html.length, 0);
        const totalCssLength = code.pages.reduce((sum, page) => sum + (page.css?.length || 0), 0);
        console.log(
          `Code generated: ${code.pages.length} pages, ${totalHtmlLength} chars HTML total, ${totalCssLength} chars CSS total`
        );
      } else if (code.html) {
        // Fallback for legacy single-page format
        console.log(
          `Code generated: ${code.html.length} chars HTML, ${code.css?.length || 0} chars CSS`
        );
      }

      // Step 5: Evaluate code quality
      console.log('✅ Step 5/6: Evaluating code quality...');
      const quality = await qualityScoringService.evaluateCode(code);
      console.log(`Quality score: ${quality.overall}/100`);

      // Step 6: Prepare response
      console.log('📦 Step 6/6: Preparing response...');
      const processingTime = Date.now() - startTime;
      console.log(`✨ Pipeline completed in ${(processingTime / 1000).toFixed(2)}s`);

      return {
        success: true,
        intent,
        design,
        code,
        quality,
        ragContext,
        augmentedPrompt: request.ragContextId ? augmentedPrompt : undefined,
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

  /**
   * Generate website with streaming updates
   */
  async *generateWebsiteStream(request: GenerationRequest) {
    try {
      // Step 1: Intent Classification
      yield { step: 'intent', status: 'processing', message: 'Analyzing your request...' };
      const intent = await intentClassificationService.classifyIntent(request.prompt);
      yield { step: 'intent', status: 'complete', data: intent };

      // Step 2: Design Recommendations
      yield { step: 'design', status: 'processing', message: 'Creating design system...' };
      const design = await designRecommendationService.generateDesignRecommendations(intent);
      yield { step: 'design', status: 'complete', data: design };

      // Step 3: Code Generation (with streaming)
      yield { step: 'code', status: 'processing', message: 'Generating website code...' };
      
      let htmlBuffer = '';
      let cssBuffer = '';
      let jsBuffer = '';

      for await (const chunk of codeGenerationService.generateWebsiteStream(
        intent,
        design
      )) {
        if (chunk.type === 'html') htmlBuffer += chunk.content;
        else if (chunk.type === 'css') cssBuffer += chunk.content;
        else if (chunk.type === 'javascript') jsBuffer += chunk.content;

        yield { 
          step: 'code', 
          status: 'streaming', 
          data: { 
            html: htmlBuffer, 
            css: cssBuffer, 
            javascript: jsBuffer 
          } 
        };
      }

      const code: GeneratedCode = {
        pages: [], // Empty array for compatibility
        html: htmlBuffer,
        css: cssBuffer,
        javascript: jsBuffer,
        framework: 'vanilla' as const,
      };

      yield { step: 'code', status: 'complete', data: code };

      // Step 4: Quality Evaluation
      yield { step: 'quality', status: 'processing', message: 'Evaluating code quality...' };
      const quality = await qualityScoringService.evaluateCode(code);
      yield { step: 'quality', status: 'complete', data: quality };

      // Complete
      yield { 
        step: 'complete', 
        status: 'complete', 
        message: 'Website generated successfully!',
        data: { intent, design, code, quality }
      };
    } catch (error) {
      yield { 
        step: 'error', 
        status: 'error', 
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Refine an existing website based on feedback
   */
  async refineWebsite(
    currentCode: GenerationResponse,
    feedback: string
  ): Promise<GenerationResponse> {
    const startTime = Date.now();

    try {
      if (!currentCode.code) {
        throw new Error('No existing code to refine');
      }

      console.log('🔄 Refining website based on feedback...');

      // Refine the code
      const refinedCode = await codeGenerationService.refineCode(
        currentCode.code,
        feedback
      );

      // Re-evaluate quality
      const quality = await qualityScoringService.evaluateCode(refinedCode);

      return {
        success: true,
        intent: currentCode.intent,
        design: currentCode.design,
        code: refinedCode,
        quality,
        processingTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Refinement failed',
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Update design preferences and regenerate
   */
  async updateDesign(
    currentGeneration: GenerationResponse,
    designFeedback: string
  ): Promise<GenerationResponse> {
    try {
      if (!currentGeneration.design || !currentGeneration.intent) {
        throw new Error('Missing design or intent data');
      }

      // Refine design recommendations
      const updatedDesign = await designRecommendationService.refineRecommendations(
        currentGeneration.design,
        designFeedback
      );

      // Regenerate code with new design
      const code = await codeGenerationService.generateWebsite(
        currentGeneration.intent,
        updatedDesign
      );

      // Evaluate quality
      const quality = await qualityScoringService.evaluateCode(code);

      return {
        success: true,
        intent: currentGeneration.intent,
        design: updatedDesign,
        code,
        quality,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Design update failed',
      };
    }
  }
}

export const webForgeService = new WebForgeService();
