import { claudeService } from './claude.service';
import {
  IntentClassification,
  DesignRecommendation,
  GeneratedCode,
  ProcessedDocument,
} from '@/types';

const CODE_GENERATION_SYSTEM_PROMPT = `You are an expert full-stack web developer specializing in creating clean, modern, production-ready websites.

Your task is to generate complete, functional website code based on the provided requirements.

IMPORTANT GUIDELINES:
1. Generate COMPLETE, production-ready code - not snippets or placeholders
2. Include ALL necessary HTML structure, CSS styling, and JavaScript functionality
3. Use modern, responsive design patterns
4. Follow web accessibility standards (WCAG 2.1)
5. Include proper semantic HTML5 elements
6. Write clean, well-commented code
7. Use CSS Grid and Flexbox for layouts
8. Ensure mobile-first responsive design
9. Include all necessary meta tags and SEO elements
10. Make the site fully functional without external dependencies where possible

OUTPUT FORMAT:
Return your response in this exact format:

===HTML===
[Complete HTML code here]
===END HTML===

===CSS===
[Complete CSS code here]
===END CSS===

===JAVASCRIPT===
[Complete JavaScript code here - or leave empty if not needed]
===END JAVASCRIPT===

Do not include any explanations or markdown - only the code within the delimiters.`;

export class CodeGenerationService {
  /**
   * Generate complete website code based on all inputs
   */
  async generateWebsite(
    intent: IntentClassification,
    design: DesignRecommendation,
    documents?: ProcessedDocument[]
  ): Promise<GeneratedCode> {
    try {
      // Build the context from documents
      const documentContext = this.buildDocumentContext(documents);

      // Create the generation prompt
      const prompt = this.buildGenerationPrompt(intent, design, documentContext);

      // Call Claude to generate code
      const response = await claudeService.sendMessage(
        [{ role: 'user', content: prompt }],
        {
          systemPrompt: CODE_GENERATION_SYSTEM_PROMPT,
          temperature: 0.4,
          maxTokens: 8000,
        }
      );

      // Parse the generated code
      const code = this.parseGeneratedCode(response);

      return code;
    } catch (error) {
      console.error('Error generating website code:', error);
      throw new Error(`Code generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Build context from uploaded documents
   */
  private buildDocumentContext(documents?: ProcessedDocument[]): string {
    if (!documents || documents.length === 0) {
      return '';
    }

    let context = '\n\nRELEVANT CONTENT FROM UPLOADED DOCUMENTS:\n\n';

    for (const doc of documents) {
      context += `Document: ${doc.originalName}\n`;
      
      // Use first few chunks or summary
      const contentPreview = doc.text.substring(0, 2000);
      context += contentPreview + '\n\n';

      if (doc.text.length > 2000) {
        context += '[... document continues ...]\n\n';
      }
    }

    return context;
  }

  /**
   * Build the complete generation prompt
   */
  private buildGenerationPrompt(
    intent: IntentClassification,
    design: DesignRecommendation,
    documentContext: string
  ): string {
    return `Generate a complete, production-ready website with the following specifications:

PRIMARY PURPOSE: ${intent.primaryIntent}
DESIGN STYLE: ${intent.designPreferences.style}
CONFIDENCE: ${(intent.confidence * 100).toFixed(0)}%

DESIGN SYSTEM:
- Color Palette:
  * Primary: ${design.colorPalette.primary}
  * Secondary: ${design.colorPalette.secondary}
  * Accent: ${design.colorPalette.accent}
  * Background: ${design.colorPalette.background}
  * Text: ${design.colorPalette.text}
- Typography:
  * Headings: ${design.typography.headingFont}
  * Body: ${design.typography.bodyFont}

REQUIRED COMPONENTS (in order of priority):
${design.components
  .map(
    (c, i) =>
      `${i + 1}. ${c.name} (${c.type}) - ${c.description} [Priority: ${c.priority}]`
  )
  .join('\n')}

SPECIFIC REQUIREMENTS:
${intent.extractedRequirements.map((req, i) => `${i + 1}. ${req}`).join('\n')}

LAYOUT: ${intent.designPreferences.layout || 'single-page'}
${documentContext}

TECHNICAL REQUIREMENTS:
- Use semantic HTML5
- Mobile-first responsive design
- Accessibility (ARIA labels where needed)
- Fast loading (optimize images, minimize dependencies)
- Cross-browser compatibility
- Include favicon and meta tags
- Smooth scrolling between sections
- Professional animations (subtle, not excessive)

Generate the COMPLETE website code now. Make it pixel-perfect and production-ready.`;
  }

  /**
   * Parse the generated code from Claude's response
   */
  private parseGeneratedCode(response: string): GeneratedCode {
    const html = this.extractSection(response, 'HTML');
    const css = this.extractSection(response, 'CSS');
    const javascript = this.extractSection(response, 'JAVASCRIPT');

    if (!html) {
      throw new Error('Failed to extract HTML from generated code');
    }

    return {
      html: this.cleanCode(html),
      css: this.cleanCode(css),
      javascript: this.cleanCode(javascript),
      framework: 'vanilla',
      dependencies: this.extractDependencies(html, css, javascript),
    };
  }

  /**
   * Extract a code section from the response
   */
  private extractSection(response: string, sectionName: string): string {
    const startMarker = `===${sectionName}===`;
    const endMarker = `===END ${sectionName}===`;

    const startIndex = response.indexOf(startMarker);
    const endIndex = response.indexOf(endMarker);

    if (startIndex === -1 || endIndex === -1) {
      return '';
    }

    return response
      .substring(startIndex + startMarker.length, endIndex)
      .trim();
  }

  /**
   * Clean up generated code
   */
  private cleanCode(code: string): string {
    return code
      .replace(/```html\n?/g, '')
      .replace(/```css\n?/g, '')
      .replace(/```javascript\n?/g, '')
      .replace(/```js\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
  }

  /**
   * Extract external dependencies from the code
   */
  private extractDependencies(html: string, css: string, js: string): string[] {
    const dependencies: string[] = [];

    // Check for Google Fonts
    const fontMatch = html.match(/fonts\.googleapis\.com\/css\?family=([^"']+)/);
    if (fontMatch) {
      dependencies.push(`Google Fonts: ${fontMatch[1]}`);
    }

    // Check for CDN scripts
    const scriptMatches = html.matchAll(/src=["']https:\/\/cdn\.[^"']+["']/g);
    for (const match of scriptMatches) {
      dependencies.push(match[0]);
    }

    return dependencies;
  }

  /**
   * Generate code incrementally with streaming
   */
  async *generateWebsiteStream(
    intent: IntentClassification,
    design: DesignRecommendation,
    documents?: ProcessedDocument[]
  ): AsyncGenerator<{ type: 'html' | 'css' | 'javascript' | 'complete'; content: string }> {
    const documentContext = this.buildDocumentContext(documents);
    const prompt = this.buildGenerationPrompt(intent, design, documentContext);

    let currentSection: 'html' | 'css' | 'javascript' | null = null;
    let buffer = '';

    for await (const chunk of claudeService.streamMessage(
      [{ role: 'user', content: prompt }],
      {
        systemPrompt: CODE_GENERATION_SYSTEM_PROMPT,
        temperature: 0.4,
        maxTokens: 8000,
      }
    )) {
      buffer += chunk;

      // Detect section markers
      if (buffer.includes('===HTML===')) {
        currentSection = 'html';
        buffer = buffer.split('===HTML===')[1] || '';
      } else if (buffer.includes('===CSS===')) {
        currentSection = 'css';
        buffer = buffer.split('===CSS===')[1] || '';
      } else if (buffer.includes('===JAVASCRIPT===')) {
        currentSection = 'javascript';
        buffer = buffer.split('===JAVASCRIPT===')[1] || '';
      }

      // Stream content for current section
      if (currentSection && chunk) {
        yield { type: currentSection, content: chunk };
      }
    }

    yield { type: 'complete', content: 'Generation complete' };
  }

  /**
   * Refine generated code based on user feedback
   */
  async refineCode(
    currentCode: GeneratedCode,
    feedback: string
  ): Promise<GeneratedCode> {
    const prompt = `I have generated website code, but the user wants changes.

CURRENT CODE:
HTML:
${currentCode.html.substring(0, 1000)}...

CSS:
${currentCode.css.substring(0, 1000)}...

USER FEEDBACK: "${feedback}"

Generate the COMPLETE updated code incorporating the feedback. Use the same output format.`;

    const response = await claudeService.sendMessage(
      [{ role: 'user', content: prompt }],
      {
        systemPrompt: CODE_GENERATION_SYSTEM_PROMPT,
        temperature: 0.5,
      }
    );

    return this.parseGeneratedCode(response);
  }
}

export const codeGenerationService = new CodeGenerationService();
