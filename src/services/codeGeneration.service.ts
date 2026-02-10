import { claudeService } from './claude.service';
import {
  IntentClassification,
  DesignRecommendation,
  GeneratedCode,
  ProcessedDocument,
  WebPage,
} from '@/types';

const CODE_GENERATION_SYSTEM_PROMPT = `You are an expert full-stack web developer specializing in creating clean, modern, production-ready websites.

Your task is to generate complete, functional multi-page website code based on the provided requirements.

CRITICAL OUTPUT FORMAT REQUIREMENTS:
Your response MUST follow this exact format with NO deviations:

===PAGE_NAME:page_name_here===
===HTML===
[Complete HTML for this page - include <html>, <head>, <body> tags. Do NOT reference external stylesheets - inline or embed all CSS]
===END HTML===

===CSS===
[Complete CSS for this page - ALL styling needed, use advanced selectors, animations, transitions, gradients, shadows]
===END CSS===

===JAVASCRIPT===
[Complete JavaScript for interactivity - or leave blank if not needed]
===END JAVASCRIPT===

===END PAGE===

Repeat the above block for each page (SEPARATE BY PAGE_NAME blocks).

KEY CSS REQUIREMENTS:
1. Use modern CSS Grid and Flexbox for layouts
2. Include CSS variables (custom properties) for colors, spacing, typography
3. Add subtle animations and transitions (hover effects, smooth scrolling)
4. Use CSS gradients for backgrounds
5. Include box-shadows, borders, and advanced styling
6. Responsive design with media queries (@media queries for mobile, tablet, desktop)
7. Professional typography with font-family stacks
8. Proper spacing, padding, margins throughout
9. Hover states, active states, focus states
10. Color transitions and smooth effects

IMPORTANT GUIDELINES:
1. Generate COMPLETE, production-ready code - not snippets
2. Create SEPARATE pages for different sections (Home, About, Services, Contact, etc.)
3. Each page should have proper HTML structure with semantic elements
4. Make CSS comprehensive and production-quality
5. Include mobile-first responsive design (CSS media queries)
6. Follow web accessibility standards (WCAG 2.1) with proper ARIA labels
7. Write clean, well-commented code
8. Ensure full functionality without external CDN dependencies
9. Include navigation links between pages using proper href="#/page-name" or page-id patterns
10. Make the site fully self-contained with all assets embedded or inline

EXAMPLE OUTPUT STRUCTURE FOR 2 PAGES:
===PAGE_NAME:home===
===HTML===
<!DOCTYPE html>
...full home page HTML...
===END HTML===
===CSS===
...full home page CSS with media queries...
===END CSS===
===JAVASCRIPT===
...home page JS...
===END JAVASCRIPT===
===END PAGE===

===PAGE_NAME:about===
===HTML===
<!DOCTYPE html>
...full about page HTML...
===END HTML===
===CSS===
...full about page CSS...
===END CSS===
===JAVASCRIPT===
...about page JS...
===END JAVASCRIPT===
===END PAGE===`;

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
    return `Generate a complete, production-ready MULTI-PAGE website with the following specifications:

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

PAGE STRUCTURE:
Create MULTIPLE pages (2-4 pages minimum) such as:
- Home/Landing page (hero section, main features)
- About/Services page (details and information)
- Contact/Gallery page (interaction or showcase)
- Additional pages based on purpose

Each page MUST have:
1. Complete HTML with proper structure
2. Comprehensive CSS with media queries for responsive design
3. JavaScript for interactivity (if needed)
4. Proper CSS styling (gradients, shadows, animations, transitions)
5. Navigation links between pages
6. Same design system applied consistently

${documentContext}

TECHNICAL REQUIREMENTS:
- Use semantic HTML5 for each page
- Mobile-first responsive design with media queries
- Accessibility (ARIA labels, semantic HTML)
- Professional animations and transitions
- Hover effects and interactive elements
- Cross-browser compatibility
- Advanced CSS: Grid, Flexbox, custom properties, gradients, shadows
- Self-contained with all CSS inline or embedded
- Navigation bar on every page linking to all other pages

Generate the COMPLETE multi-page website code now. Make it pixel-perfect and production-ready.`;
  }

  /**
   * Parse the generated code from Claude's response (multi-page format)
   */
  private parseGeneratedCode(response: string): GeneratedCode {
    const pages = this.extractPages(response);
    
    console.log('Claude response length:', response.length);
    console.log('Extracted pages:', pages.length);
    
    if (pages.length === 0) {
      console.error('Failed to extract pages. Response preview:', response.substring(0, 500));
      throw new Error('Failed to extract HTML from generated code');
    }

    return {
      pages,
      framework: 'vanilla',
      dependencies: this.extractDependencies(
        pages.map(p => p.html).join('\n'),
        pages.map(p => p.css || '').join('\n'),
        pages.map(p => p.javascript || '').join('\n')
      ),
    };
  }

  /**
   * Extract all pages from the response
   */
  private extractPages(response: string): WebPage[] {
    const pages: WebPage[] = [];
    const pagePattern = /===PAGE_NAME:([^=]+)===[\s\S]*?===END PAGE===/g;
    let match;

    while ((match = pagePattern.exec(response)) !== null) {
      const pageName = match[0].match(/===PAGE_NAME:([^=]+)===/)?.[1]?.trim() || 'page';
      const pageContent = match[0];

      const html = this.extractSection(pageContent, 'HTML');
      const css = this.extractSection(pageContent, 'CSS');
      const javascript = this.extractSection(pageContent, 'JAVASCRIPT');

      if (html) {
        pages.push({
          id: pageName.toLowerCase().replace(/\s+/g, '-'),
          name: pageName,
          title: pageName,
          html: this.cleanCode(html),
          css: this.cleanCode(css),
          javascript: this.cleanCode(javascript),
          route: `/${pageName.toLowerCase().replace(/\s+/g, '-')}`,
        });
      }
    }

    // Fallback: if no pages found with new format, try single-page format for backwards compatibility
    if (pages.length === 0) {
      const html = this.extractSectionCompat(response, 'HTML');
      const css = this.extractSectionCompat(response, 'CSS');
      const javascript = this.extractSectionCompat(response, 'JAVASCRIPT');

      if (html) {
        pages.push({
          id: 'index',
          name: 'Home',
          title: 'Home',
          html: this.cleanCode(html),
          css: this.cleanCode(css),
          javascript: this.cleanCode(javascript),
          route: '/',
        });
      }
    }

    return pages;
  }

  /**
   * Extract a code section from the response
   */
  private extractSection(response: string, sectionName: string): string {
    // Try exact marker format first
    const startMarker = `===${sectionName}===`;
    let startIndex = response.indexOf(startMarker);

    if (startIndex === -1) {
      // Try with spaces: === HTML ===
      const altStartMarker = `=== ${sectionName} ===`;
      startIndex = response.indexOf(altStartMarker);
      if (startIndex !== -1) {
        // Look for next section marker as end boundary
        const nextSectionIndex = this.findNextSectionMarker(response, startIndex + altStartMarker.length);
        if (nextSectionIndex !== -1) {
          return response.substring(startIndex + altStartMarker.length, nextSectionIndex).trim();
        }
      }
      return '';
    }

    // Found startMarker, now find the end
    const contentStart = startIndex + startMarker.length;

    // Try to find the exact END marker first
    const endMarker = `===END ${sectionName}===`;
    let endIndex = response.indexOf(endMarker, contentStart);

    if (endIndex === -1) {
      // If no END marker, look for the next section marker (===HTML=== or ===CSS=== or ===JAVASCRIPT===)
      endIndex = this.findNextSectionMarker(response, contentStart);
    }

    if (endIndex === -1) {
      // If still no end found, take from start to end of response
      return response.substring(contentStart).trim();
    }

    return response.substring(contentStart, endIndex).trim();
  }

  /**
   * Extract a code section (backwards compatibility for single-page responses)
   */
  private extractSectionCompat(response: string, sectionName: string): string {
    // For backwards compatibility with older format
    return this.extractSection(response, sectionName);
  }

  /**
   * Find the next section marker (===*===) starting from a given position
   */
  private findNextSectionMarker(response: string, fromIndex: number): number {
    const sectionMarkers = ['===HTML===', '===CSS===', '===JAVASCRIPT===', '===END HTML===', '===END CSS===', '===END JAVASCRIPT==='];
    
    let nearestIndex = -1;
    
    for (const marker of sectionMarkers) {
      const index = response.indexOf(marker, fromIndex);
      if (index !== -1 && (nearestIndex === -1 || index < nearestIndex)) {
        nearestIndex = index;
      }
    }
    
    return nearestIndex;
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
