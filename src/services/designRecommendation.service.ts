import { claudeService } from './claude.service';
import { IntentClassification, DesignRecommendation } from '@/types';

const DESIGN_RECOMMENDATION_PROMPT = `You are an expert UI/UX designer. Based on the user's intent and requirements, recommend a complete design system.

Your task is to provide:
1. Component recommendations with priority
2. A cohesive color palette
3. Typography choices
4. Clear reasoning for your decisions

Return your recommendations in this EXACT JSON format:
{
  "framework": "react" | "vanilla",
  "components": [
    {
      "name": "Component Name",
      "type": "header" | "hero" | "features" | "testimonials" | "footer" | "gallery" | "form" | "custom",
      "description": "Brief description of the component",
      "priority": 1-10 (higher is more important)
    }
  ],
  "colorPalette": {
    "primary": "#hex",
    "secondary": "#hex",
    "accent": "#hex",
    "background": "#hex",
    "text": "#hex"
  },
  "typography": {
    "headingFont": "Font name from Google Fonts",
    "bodyFont": "Font name from Google Fonts"
  },
  "reasoning": "Explanation of why these choices fit the requirements"
}

Consider:
- The website's purpose and target audience
- Modern design trends and best practices
- Accessibility and readability
- Brand consistency`;

export class DesignRecommendationService {
  /**
   * Generate design recommendations based on intent classification
   */
  async generateDesignRecommendations(
    intent: IntentClassification
  ): Promise<DesignRecommendation> {
    try {
      const prompt = `Generate design recommendations for a website with the following characteristics:

Primary Intent: ${intent.primaryIntent}
Design Style: ${intent.designPreferences.style}
Required Components: ${intent.designPreferences.components.join(', ')}
Requirements: ${intent.extractedRequirements.join(', ')}

Provide a complete design system including components, colors, and typography.`;

      const response = await claudeService.sendMessage(
        [{ role: 'user', content: prompt }],
        {
          systemPrompt: DESIGN_RECOMMENDATION_PROMPT,
          temperature: 0.5,
          maxTokens: 2000,
        }
      );

      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to parse design recommendations');
      }

      const recommendations: DesignRecommendation = JSON.parse(jsonMatch[0]);

      // Validate and enhance recommendations
      this.validateRecommendations(recommendations);
      this.enhanceRecommendations(recommendations, intent);

      return recommendations;
    } catch (error) {
      console.error('Error generating design recommendations:', error);
      return this.getDefaultRecommendations(intent);
    }
  }

  /**
   * Validate design recommendations
   */
  private validateRecommendations(recommendations: any): void {
    if (!recommendations.components || !Array.isArray(recommendations.components)) {
      throw new Error('Invalid components in recommendations');
    }
    if (!recommendations.colorPalette) {
      throw new Error('Missing color palette');
    }
    if (!recommendations.typography) {
      throw new Error('Missing typography');
    }
  }

  /**
   * Enhance recommendations with additional context
   */
  private enhanceRecommendations(
    recommendations: DesignRecommendation,
    intent: IntentClassification
  ): void {
    // Sort components by priority
    recommendations.components.sort((a, b) => b.priority - a.priority);

    // Ensure essential components are included
    const essentialComponents = ['header', 'footer'];
    for (const essential of essentialComponents) {
      if (!recommendations.components.find(c => c.type === essential)) {
        recommendations.components.push({
          name: essential.charAt(0).toUpperCase() + essential.slice(1),
          type: essential as any,
          description: `Essential ${essential} component`,
          priority: 5,
        });
      }
    }
  }

  /**
   * Get default recommendations based on intent
   */
  private getDefaultRecommendations(intent: IntentClassification): DesignRecommendation {
    const colorPalettes: Record<string, any> = {
      'landing-page': {
        primary: '#3b82f6',
        secondary: '#8b5cf6',
        accent: '#ec4899',
        background: '#ffffff',
        text: '#1f2937',
      },
      portfolio: {
        primary: '#0ea5e9',
        secondary: '#06b6d4',
        accent: '#f59e0b',
        background: '#fafafa',
        text: '#111827',
      },
      blog: {
        primary: '#6366f1',
        secondary: '#a855f7',
        accent: '#f43f5e',
        background: '#ffffff',
        text: '#374151',
      },
      ecommerce: {
        primary: '#10b981',
        secondary: '#059669',
        accent: '#f59e0b',
        background: '#f9fafb',
        text: '#111827',
      },
    };

    return {
      framework: 'react',
      components: [
        {
          name: 'Navigation Header',
          type: 'header',
          description: 'Responsive navigation with logo and menu',
          priority: 10,
        },
        {
          name: 'Hero Section',
          type: 'hero',
          description: 'Eye-catching hero with headline and CTA',
          priority: 9,
        },
        {
          name: 'Features Section',
          type: 'features',
          description: 'Showcase key features or benefits',
          priority: 8,
        },
        {
          name: 'Footer',
          type: 'footer',
          description: 'Footer with links and contact info',
          priority: 7,
        },
      ],
      colorPalette:
        colorPalettes[intent.primaryIntent] || colorPalettes['landing-page'],
      typography: {
        headingFont: 'Inter',
        bodyFont: 'Inter',
      },
      reasoning: `Default design system for ${intent.primaryIntent} with modern, clean aesthetics.`,
    };
  }

  /**
   * Refine recommendations based on user feedback
   */
  async refineRecommendations(
    currentRecommendations: DesignRecommendation,
    userFeedback: string
  ): Promise<DesignRecommendation> {
    const prompt = `Current design recommendations:
${JSON.stringify(currentRecommendations, null, 2)}

User feedback: "${userFeedback}"

Update the design recommendations based on the feedback. Maintain the JSON format.`;

    try {
      const response = await claudeService.sendMessage(
        [{ role: 'user', content: prompt }],
        {
          systemPrompt: DESIGN_RECOMMENDATION_PROMPT,
          temperature: 0.5,
        }
      );

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('Error refining recommendations:', error);
    }

    return currentRecommendations;
  }
}

export const designRecommendationService = new DesignRecommendationService();
