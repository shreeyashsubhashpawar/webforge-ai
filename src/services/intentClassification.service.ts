import { claudeService } from './claude.service';
import { IntentClassification } from '@/types';

const INTENT_CLASSIFICATION_PROMPT = `You are an expert web design analyst. Analyze the user's request and classify their intent for website generation.

Your task is to:
1. Identify the PRIMARY intent (type of website they want)
2. Extract design preferences from their description
3. List specific requirements and features they mention
4. Assign a confidence score (0-1)

Return your analysis in this EXACT JSON format:
{
  "primaryIntent": "landing-page" | "portfolio" | "blog" | "ecommerce" | "dashboard" | "documentation" | "custom",
  "confidence": 0.0-1.0,
  "designPreferences": {
    "style": "modern" | "minimal" | "corporate" | "creative" | "playful",
    "colorScheme": "description or hex codes",
    "layout": "single-page" | "multi-page",
    "components": ["list", "of", "required", "components"]
  },
  "extractedRequirements": ["requirement1", "requirement2", ...]
}

Examples of components: "hero section", "contact form", "image gallery", "testimonials", "pricing table", "navigation menu", "footer", etc.

Examples:
- "I need a modern portfolio site" → primaryIntent: "portfolio", style: "modern"
- "Create a landing page for my SaaS product with pricing" → primaryIntent: "landing-page", components: ["hero section", "pricing table"]
- "Build me a blog with dark mode" → primaryIntent: "blog", colorScheme: "dark theme"

Be specific and extract as much detail as possible from the user's request.`;

export class IntentClassificationService {
  /**
   * Classify user's intent from their prompt using Claude
   */
  async classifyIntent(userPrompt: string): Promise<IntentClassification> {
    try {
      const response = await claudeService.sendMessage(
        [
          {
            role: 'user',
            content: `Analyze this website request: "${userPrompt}"`,
          },
        ],
        {
          systemPrompt: INTENT_CLASSIFICATION_PROMPT,
          temperature: 0.3, // Lower temperature for more consistent classification
          maxTokens: 1500,
        }
      );

      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to parse intent classification response');
      }

      const classification: IntentClassification = JSON.parse(jsonMatch[0]);

      // Validate the classification
      this.validateClassification(classification);

      return classification;
    } catch (error) {
      console.error('Error in intent classification:', error);
      
      // Return a default classification on error
      return this.getDefaultClassification(userPrompt);
    }
  }

  /**
   * Validate that the classification has required fields
   */
  private validateClassification(classification: any): void {
    if (!classification.primaryIntent) {
      throw new Error('Missing primaryIntent in classification');
    }
    if (typeof classification.confidence !== 'number') {
      throw new Error('Missing or invalid confidence score');
    }
    if (!classification.designPreferences) {
      throw new Error('Missing designPreferences');
    }
  }

  /**
   * Get a default classification when AI classification fails
   */
  private getDefaultClassification(prompt: string): IntentClassification {
    // Simple keyword-based fallback
    const lowerPrompt = prompt.toLowerCase();
    
    let primaryIntent: IntentClassification['primaryIntent'] = 'custom';
    if (lowerPrompt.includes('portfolio')) primaryIntent = 'portfolio';
    else if (lowerPrompt.includes('landing') || lowerPrompt.includes('saas')) primaryIntent = 'landing-page';
    else if (lowerPrompt.includes('blog')) primaryIntent = 'blog';
    else if (lowerPrompt.includes('ecommerce') || lowerPrompt.includes('shop')) primaryIntent = 'ecommerce';
    else if (lowerPrompt.includes('dashboard') || lowerPrompt.includes('admin')) primaryIntent = 'dashboard';
    else if (lowerPrompt.includes('docs') || lowerPrompt.includes('documentation')) primaryIntent = 'documentation';

    return {
      primaryIntent,
      confidence: 0.5,
      designPreferences: {
        style: 'modern',
        components: ['header', 'main content', 'footer'],
      },
      extractedRequirements: [prompt],
    };
  }

  /**
   * Refine intent based on uploaded documents
   */
  async refineIntentWithDocuments(
    baseIntent: IntentClassification,
    documentSummary: string
  ): Promise<IntentClassification> {
    const refinementPrompt = `Given the initial intent classification and document content, refine the requirements.

Initial Classification:
${JSON.stringify(baseIntent, null, 2)}

Document Content Summary:
${documentSummary.substring(0, 2000)}

Update the extractedRequirements and components based on the document content. Return the updated JSON.`;

    try {
      const response = await claudeService.prompt(
        refinementPrompt,
        INTENT_CLASSIFICATION_PROMPT
      );

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('Error refining intent:', error);
    }

    return baseIntent;
  }
}

export const intentClassificationService = new IntentClassificationService();
