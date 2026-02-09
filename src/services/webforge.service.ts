import { GenerationRequest, GenerationResponse, ProcessedDocument } from '@/types';
import { intentClassificationService } from './intentClassification.service';
import { designRecommendationService } from './designRecommendation.service';
import { documentProcessingService } from './documentProcessing.service';
import { codeGenerationService } from './codeGeneration.service';
import { qualityScoringService } from './qualityScoring.service';

/**
 * Main orchestration service that coordinates the entire WebForge AI pipeline
 */
export class WebForgeService {
  /**
   * Execute the complete WebForge AI pipeline
   */
  async generateWebsite(request: GenerationRequest): Promise<GenerationResponse> {
    const startTime = Date.now();

    try {
      console.log('🚀 Starting WebForge AI generation pipeline...');

      // Step 1: Process uploaded documents (if any)
      console.log('📄 Step 1/5: Processing uploaded documents...');
      let processedDocuments: ProcessedDocument[] = [];
      
      if (request.documents && request.documents.length > 0) {
        // In a real implementation, you would load the actual file buffers
        // For now, we'll skip this step in the service
        console.log(`Found ${request.documents.length} documents to process`);
      }

      // Step 2: Classify user intent
      console.log('🎯 Step 2/5: Classifying user intent...');
      const intent = await intentClassificationService.classifyIntent(request.prompt);
      console.log(`Intent identified: ${intent.primaryIntent} (${(intent.confidence * 100).toFixed(0)}% confidence)`);

      // Refine intent with document context if available
      if (processedDocuments.length > 0) {
        const docSummary = processedDocuments
          .map(d => d.text.substring(0, 500))
          .join('\n\n');
        const refinedIntent = await intentClassificationService.refineIntentWithDocuments(
          intent,
          docSummary
        );
        console.log('Intent refined with document context');
      }

      // Step 3: Generate design recommendations
      console.log('🎨 Step 3/5: Generating design recommendations...');
      const design = await designRecommendationService.generateDesignRecommendations(intent);
      console.log(`Design system created with ${design.components.length} components`);

      // Apply user design preferences if provided
      if (request.designPreferences) {
        Object.assign(design, request.designPreferences);
        console.log('Applied user design preferences');
      }

      // Step 4: Generate website code
      console.log('💻 Step 4/5: Generating website code...');
      const code = await codeGenerationService.generateWebsite(
        intent,
        design,
        processedDocuments
      );
      console.log(`Code generated: ${code.html.length} chars HTML, ${code.css.length} chars CSS`);

      // Step 5: Evaluate code quality
      console.log('✅ Step 5/5: Evaluating code quality...');
      const quality = await qualityScoringService.evaluateCode(code);
      console.log(`Quality score: ${quality.overall}/100`);

      const processingTime = Date.now() - startTime;
      console.log(`✨ Pipeline completed in ${(processingTime / 1000).toFixed(2)}s`);

      return {
        success: true,
        intent,
        design,
        code,
        quality,
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

      const code = {
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
