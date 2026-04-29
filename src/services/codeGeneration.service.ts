import { claudeService } from './claude.service';
import {
  IntentClassification,
  DesignRecommendation,
  GeneratedCode,
  GeneratedFile,
  GeneratedWebsite,
  ProcessedDocument,
  WebPage,
} from '@/types';

// ✅ FIX: System prompt now explicitly instructs Claude to use real document data.
// The original system prompt had no mention of extracting actual content —
// it only asked for "production-ready code", which Claude defaulted to placeholder data.
const CODE_GENERATION_SYSTEM_PROMPT = `You are an expert full-stack web developer specializing in creating complete, production-ready websites.

When given document content extracted from a PDF, you MUST use the REAL data from that document in the website.
- Real names → put them in the HTML, not placeholders
- Real phone numbers → display them, not "XXX-XXXX"  
- Real addresses → show them, not "123 Main St"
- Real achievements → list them as actual bullet points
- Real department/organization names → use in headings and titles
- NEVER use lorem ipsum or placeholder text when real content was provided

OUTPUT FORMAT — follow exactly, no deviations:

===PAGE_NAME:page_name_here===
===HTML===
[Complete HTML body content]
===END HTML===

===CSS===
[Complete CSS with responsive design]
===END CSS===

===JAVASCRIPT===
[JavaScript or leave blank]
===END JAVASCRIPT===

===END PAGE===

Repeat for each page. Generate 3-5 pages minimum.

CSS REQUIREMENTS:
- CSS Grid and Flexbox layouts
- CSS variables for colors, spacing
- Smooth animations and transitions
- Gradients, shadows, hover effects
- Responsive with media queries
- Professional typography`;

export class CodeGenerationService {
  /**
   * Generate complete website code based on all inputs
   */
  async generateWebsite(
    intent: IntentClassification,
    design: DesignRecommendation,
    documents?: ProcessedDocument[],
    augmentedPrompt?: string
  ): Promise<GeneratedCode> {
    try {
      // ✅ FIX: When augmentedPrompt is provided (RAG context exists), use it DIRECTLY
      // as the full prompt. The original code was using augmentedPrompt correctly,
      // but the augmentedPrompt itself was too generic (see ragPipeline fix).
      const prompt = augmentedPrompt
        ? augmentedPrompt
        : this.buildGenerationPrompt(intent, design, this.buildDocumentContext(documents));

      console.log(
        `[CodeGen] Generating website with ${augmentedPrompt ? 'RAG-augmented' : 'standard'} prompt`
      );
      console.log(`[CodeGen] Prompt length: ${prompt.length} chars`);

      const response = await claudeService.sendMessage(
        [{ role: 'user', content: prompt }],
        {
          systemPrompt: CODE_GENERATION_SYSTEM_PROMPT,
          temperature: 0.3, // Lower = more faithful to instructions
          maxTokens: 8000,
        }
      );

      const code = this.parseGeneratedCode(response);
      return code;
    } catch (error) {
      console.error('Error generating website code:', error);
      throw new Error(`Code generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private buildDocumentContext(documents?: ProcessedDocument[]): string {
    if (!documents || documents.length === 0) return '';
    let context = '\n\nRELEVANT CONTENT FROM UPLOADED DOCUMENTS:\n\n';
    for (const doc of documents) {
      context += `Document: ${doc.originalName}\n`;
      context += doc.text.substring(0, 3000) + '\n\n';
      if (doc.text.length > 3000) context += '[... document continues ...]\n\n';
    }
    return context;
  }

  private buildGenerationPrompt(
    intent: IntentClassification,
    design: DesignRecommendation,
    documentContext: string
  ): string {
    return `Generate a complete, production-ready MULTI-PAGE website with the following specifications:

PRIMARY PURPOSE: ${intent.primaryIntent}
DESIGN STYLE: ${intent.designPreferences.style}

DESIGN SYSTEM:
- Primary Color: ${design.colorPalette.primary}
- Secondary Color: ${design.colorPalette.secondary}
- Accent: ${design.colorPalette.accent}
- Background: ${design.colorPalette.background}
- Headings Font: ${design.typography.headingFont}
- Body Font: ${design.typography.bodyFont}

COMPONENTS:
${design.components.map((c, i) => `${i + 1}. ${c.name} (${c.type}) - ${c.description}`).join('\n')}

REQUIREMENTS:
${intent.extractedRequirements.map((req, i) => `${i + 1}. ${req}`).join('\n')}

${documentContext}

Generate 3-5 pages. Make it production-ready and responsive.`;
  }

  private parseGeneratedCode(response: string): GeneratedCode {
    const pages = this.extractPages(response);

    console.log('Claude response length:', response.length);
    console.log('Extracted pages:', pages.length);

    if (pages.length === 0) {
      console.error('Failed to extract pages. Response preview:', response.substring(0, 500));
      throw new Error('Failed to extract HTML from generated code');
    }

    const files: Array<{ name: string; type: 'html' | 'css' | 'javascript'; content: string; path: string }> = [];
    const cssContents: string[] = [];
    const jsContents: string[] = [];

    pages.forEach((page) => {
      files.push({
        name: `${page.id}.html`,
        type: 'html',
        content: this.createFullHtmlFile(page, pages),
        path: `/pages/${page.id}.html`,
      });
      if (page.css) cssContents.push(page.css);
      if (page.javascript) jsContents.push(page.javascript);
    });

    if (cssContents.length > 0) {
      files.push({
        name: 'styles.css',
        type: 'css',
        content: this.combineAndOrganizeCSS(cssContents),
        path: '/styles.css',
      });
    }

    if (jsContents.length > 0) {
      files.push({
        name: 'script.js',
        type: 'javascript',
        content: this.combineAndOrganizeJS(jsContents),
        path: '/script.js',
      });
    }

    const website: GeneratedWebsite = {
      files,
      mainFile: 'pages/index.html',
      framework: 'vanilla',
    };

    return {
      pages,
      website,
      framework: 'vanilla',
      dependencies: this.extractDependencies(
        pages.map((p) => p.html).join('\n'),
        cssContents.join('\n'),
        jsContents.join('\n')
      ),
    };
  }

  private createFullHtmlFile(page: WebPage, allPages: WebPage[]): string {
    const bodyMatch = page.html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const bodyContent = bodyMatch ? bodyMatch[1] : page.html;

    const navLinks = allPages
      .map((p) => `      <a href="${p.id}.html" class="nav-link">${p.name}</a>`)
      .join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${page.title}</title>
    <link rel="stylesheet" href="/styles.css">
</head>
<body>
    <nav class="main-nav">
${navLinks}
    </nav>

${bodyContent}

    <script src="/script.js"><\/script>
</body>
</html>`;
  }

  private combineAndOrganizeCSS(cssContents: string[]): string {
    return `/* Generated Styles */
:root {
  --transition-duration: 0.3s;
  --border-radius: 8px;
}

${cssContents.join('\n\n/* ===== */\n\n')}`;
  }

  private combineAndOrganizeJS(jsContents: string[]): string {
    return `// Generated Script
document.addEventListener('DOMContentLoaded', function() {
  initializePageScripts();
});

function initializePageScripts() {
  ${jsContents.map((js, i) => `// Page ${i + 1} scripts\n  (function() {\n    ${js.split('\n').join('\n    ')}\n  })();`).join('\n\n  ')}
}

function navigateToPage(pageId) {
  window.location.href = pageId + '.html';
}`;
  }

  private extractPages(response: string): WebPage[] {
    const pages: WebPage[] = [];
    const pagePattern = /===PAGE_NAME:([^=]+)===[\\s\S]*?===END PAGE===/g;
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

    if (pages.length === 0) {
      const html = this.extractSection(response, 'HTML');
      const css = this.extractSection(response, 'CSS');
      const javascript = this.extractSection(response, 'JAVASCRIPT');
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

  private extractSection(response: string, sectionName: string): string {
    const startMarker = `===${sectionName}===`;
    let startIndex = response.indexOf(startMarker);

    if (startIndex === -1) {
      const altStartMarker = `=== ${sectionName} ===`;
      startIndex = response.indexOf(altStartMarker);
      if (startIndex !== -1) {
        const nextSectionIndex = this.findNextSectionMarker(response, startIndex + altStartMarker.length);
        if (nextSectionIndex !== -1) {
          return response.substring(startIndex + altStartMarker.length, nextSectionIndex).trim();
        }
      }
      return '';
    }

    const contentStart = startIndex + startMarker.length;
    const endMarker = `===END ${sectionName}===`;
    let endIndex = response.indexOf(endMarker, contentStart);

    if (endIndex === -1) {
      endIndex = this.findNextSectionMarker(response, contentStart);
    }

    if (endIndex === -1) {
      return response.substring(contentStart).trim();
    }

    return response.substring(contentStart, endIndex).trim();
  }

  private findNextSectionMarker(response: string, fromIndex: number): number {
    const sectionMarkers = [
      '===HTML===', '===CSS===', '===JAVASCRIPT===',
      '===END HTML===', '===END CSS===', '===END JAVASCRIPT===',
    ];
    let nearestIndex = -1;
    for (const marker of sectionMarkers) {
      const index = response.indexOf(marker, fromIndex);
      if (index !== -1 && (nearestIndex === -1 || index < nearestIndex)) {
        nearestIndex = index;
      }
    }
    return nearestIndex;
  }

  private cleanCode(code: string): string {
    return code
      .replace(/```html\n?/g, '')
      .replace(/```css\n?/g, '')
      .replace(/```javascript\n?/g, '')
      .replace(/```js\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
  }

  private extractDependencies(html: string, css: string, js: string): string[] {
    const dependencies: string[] = [];
    const fontMatch = html.match(/fonts\.googleapis\.com\/css\?family=([^"']+)/);
    if (fontMatch) dependencies.push(`Google Fonts: ${fontMatch[1]}`);
    const scriptMatches = html.matchAll(/src=["']https:\/\/cdn\.[^"']+["']/g);
    for (const match of scriptMatches) dependencies.push(match[0]);
    return dependencies;
  }

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
      { systemPrompt: CODE_GENERATION_SYSTEM_PROMPT, temperature: 0.3, maxTokens: 8000 }
    )) {
      buffer += chunk;
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
      if (currentSection && chunk) yield { type: currentSection, content: chunk };
    }
    yield { type: 'complete', content: 'Generation complete' };
  }

  async refineCode(currentCode: GeneratedCode, feedback: string): Promise<GeneratedCode> {
    const htmlSnippet = currentCode.html?.substring(0, 1000) || 'No HTML available';
    const cssSnippet = currentCode.css?.substring(0, 1000) || 'No CSS available';
    const jsSnippet = currentCode.javascript?.substring(0, 1000) || 'No JavaScript available';

    const prompt = `I have generated website code, but the user wants changes.

CURRENT CODE:
HTML: ${htmlSnippet}...
CSS: ${cssSnippet}...
JavaScript: ${jsSnippet}...

USER FEEDBACK: "${feedback}"

Generate the COMPLETE updated code incorporating the feedback. Use the same output format.`;

    const response = await claudeService.sendMessage(
      [{ role: 'user', content: prompt }],
      { systemPrompt: CODE_GENERATION_SYSTEM_PROMPT, temperature: 0.5 }
    );

    return this.parseGeneratedCode(response);
  }
}

export const codeGenerationService = new CodeGenerationService();
