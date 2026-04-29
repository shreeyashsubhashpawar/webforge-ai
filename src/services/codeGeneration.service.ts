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

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT
// Tells Claude to:
//   1. Use REAL data from the uploaded document
//   2. Output in the exact page-block format we parse
//   3. Embed ALL CSS inline inside each page (no external stylesheet references)
//      so the iframe preview works without a file server
// ─────────────────────────────────────────────────────────────────────────────
const CODE_GENERATION_SYSTEM_PROMPT = `You are an expert full-stack web developer.

CRITICAL RULE — REAL CONTENT:
When the user's prompt contains document content extracted from a PDF, you MUST use the REAL data:
- Real names → put them in HTML headings, not "John Doe"
- Real phone numbers → display them, not "+91 XXXXXXXXXX"
- Real addresses → show them, not "123 Main St"
- Real achievements → list them as actual bullet points
- Real department/organization names → use in <h1> and <title>
- NEVER use lorem ipsum or placeholder text when real content was provided

OUTPUT FORMAT — follow EXACTLY, character for character:

===PAGE_NAME:home===
===HTML===
[Complete self-contained HTML page — include <html><head><style>...</style></head><body>...</body></html>]
[Navigation links must use onclick="parent.switchPage('pageid')" to work inside the preview iframe]
===END HTML===
===END PAGE===

===PAGE_NAME:about===
===HTML===
[Complete self-contained HTML page]
===END HTML===
===END PAGE===

RULES:
1. Each page is a COMPLETE standalone HTML file with embedded <style> tags
2. Navigation between pages: use onclick="parent.switchPage('pageid')" on anchor/button elements
3. Generate MINIMUM 4 pages: home, about, achievements (or services), contact
4. Every page must have a consistent navigation bar at the top
5. Contact page must show real phone, email, address from the document
6. Make it visually professional: gradients, cards, hover effects, responsive
7. Use Google Fonts via <link> inside <head>`;

export class CodeGenerationService {
  async generateWebsite(
    intent: IntentClassification,
    design: DesignRecommendation,
    documents?: ProcessedDocument[],
    augmentedPrompt?: string
  ): Promise<GeneratedCode> {
    try {
      const prompt = augmentedPrompt
        ? augmentedPrompt
        : this.buildGenerationPrompt(intent, design, this.buildDocumentContext(documents));

      console.log(`[CodeGen] Generating website with ${augmentedPrompt ? 'RAG-augmented' : 'standard'} prompt`);
      console.log(`[CodeGen] Prompt length: ${prompt.length} chars`);

      const response = await claudeService.sendMessage(
        [{ role: 'user', content: prompt }],
        {
          systemPrompt: CODE_GENERATION_SYSTEM_PROMPT,
          temperature: 0.3,
          maxTokens: 8000,
        }
      );

      console.log(`[CodeGen] Claude response length: ${response.length} chars`);
      console.log(`[CodeGen] Response preview: ${response.substring(0, 300)}`);

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
    return `Generate a complete, production-ready MULTI-PAGE website.

PRIMARY PURPOSE: ${intent.primaryIntent}
DESIGN STYLE: ${intent.designPreferences?.style || 'modern'}

DESIGN SYSTEM:
- Primary Color: ${design.colorPalette?.primary || '#2563eb'}
- Secondary Color: ${design.colorPalette?.secondary || '#1e40af'}
- Accent: ${design.colorPalette?.accent || '#f59e0b'}
- Background: ${design.colorPalette?.background || '#ffffff'}
- Headings Font: ${design.typography?.headingFont || 'Inter'}
- Body Font: ${design.typography?.bodyFont || 'Inter'}

REQUIREMENTS:
${(intent.extractedRequirements || []).map((req: string, i: number) => `${i + 1}. ${req}`).join('\n')}

${documentContext}

Generate 4+ pages. Make it production-ready and fully responsive.`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CRITICAL FIX — parseGeneratedCode
  //
  // BUG FOUND: The regex was:
  //   /===PAGE_NAME:([^=]+)===[\\s\S]*?===END PAGE===/g
  //
  // In a JS string literal, [\\s\\S] becomes the literal text [\s\S] which is
  // NOT a valid "any character" class — it matches only \, s, \, S literally.
  // So the regex NEVER matched Claude's output → pages array was always empty
  // → parseGeneratedCode threw "Failed to extract HTML" or returned garbage
  // → frontend showed [object Object] and code tab showed character counts only.
  //
  // FIX: Use a RegExp constructor with a raw string so \s\S is interpreted
  // correctly, OR use a regex literal. We use a regex literal here.
  // ─────────────────────────────────────────────────────────────────────────
  private parseGeneratedCode(response: string): GeneratedCode {
    const pages = this.extractPages(response);

    console.log(`[CodeGen] Extracted ${pages.length} pages from response`);

    if (pages.length === 0) {
      console.error('[CodeGen] No pages extracted. Response preview:', response.substring(0, 800));
      // Emergency fallback: wrap entire response as a single page
      const fallbackPage: WebPage = {
        id: 'index',
        name: 'Home',
        title: 'Home',
        html: `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Generated Website</title></head><body>${response}</body></html>`,
        css: '',
        javascript: '',
        route: '/',
      };
      pages.push(fallbackPage);
    }

    // Build file list — each page is a complete standalone HTML file
    const files: GeneratedFile[] = pages.map((page) => ({
      name: page.id === 'home' || page.id === 'index' ? 'index.html' : `${page.id}.html`,
      type: 'html' as const,
      content: page.html, // already a complete HTML document
      path: page.id === 'home' || page.id === 'index' ? 'index.html' : `${page.id}.html`,
    }));

    const website: GeneratedWebsite = {
      files,
      mainFile: 'index.html',
      framework: 'vanilla',
    };

    return {
      pages,
      website,
      framework: 'vanilla',
      dependencies: [],
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // extractPages — uses a regex LITERAL (not a string-constructed regex)
  // so [\s\S] correctly means "any character including newlines"
  // ─────────────────────────────────────────────────────────────────────────
  private extractPages(response: string): WebPage[] {
    const pages: WebPage[] = [];

    // ✅ CORRECT regex literal — [\s\S]*? matches any character including newlines
    const pagePattern = /===PAGE_NAME:([^=\n]+)===[\s\S]*?===END PAGE===/g;
    let match: RegExpExecArray | null;

    while ((match = pagePattern.exec(response)) !== null) {
      const rawPageName = match[0].match(/===PAGE_NAME:([^=\n]+)===/)?.[1]?.trim() || 'page';
      const pageBlock = match[0];

      // Extract the HTML section
      const html = this.extractSection(pageBlock, 'HTML');

      if (html && html.trim().length > 0) {
        const cleanedHtml = this.cleanCode(html);
        const pageId = rawPageName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

        pages.push({
          id: pageId || 'page',
          name: this.formatPageName(rawPageName),
          title: this.formatPageName(rawPageName),
          html: cleanedHtml, // complete HTML document
          css: '',           // CSS is embedded inside html
          javascript: '',    // JS is embedded inside html
          route: `/${pageId}`,
        });

        console.log(`[CodeGen] Extracted page: "${rawPageName}" (${cleanedHtml.length} chars)`);
      }
    }

    // Fallback: if Claude didn't use the PAGE_NAME format, try to extract a single page
    if (pages.length === 0) {
      console.warn('[CodeGen] No PAGE_NAME blocks found — trying single-page fallback');

      // Look for a complete HTML document
      const htmlDocMatch = response.match(/<!DOCTYPE html>[\s\S]*<\/html>/i);
      if (htmlDocMatch) {
        pages.push({
          id: 'index',
          name: 'Home',
          title: 'Home',
          html: htmlDocMatch[0],
          css: '',
          javascript: '',
          route: '/',
        });
        console.log('[CodeGen] Found complete HTML document as fallback');
      } else {
        // Last resort: try ===HTML=== markers
        const html = this.extractSection(response, 'HTML');
        if (html) {
          pages.push({
            id: 'index',
            name: 'Home',
            title: 'Home',
            html: this.cleanCode(html),
            css: this.cleanCode(this.extractSection(response, 'CSS')),
            javascript: this.cleanCode(this.extractSection(response, 'JAVASCRIPT')),
            route: '/',
          });
          console.log('[CodeGen] Found HTML section as last-resort fallback');
        }
      }
    }

    return pages;
  }

  private formatPageName(raw: string): string {
    return raw
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();
  }

  private extractSection(content: string, sectionName: string): string {
    // Try ===SECTIONNAME=== format
    const startMarker = `===${sectionName}===`;
    const endMarker = `===END ${sectionName}===`;

    let startIndex = content.indexOf(startMarker);
    if (startIndex === -1) {
      // Try with spaces
      const altStart = `=== ${sectionName} ===`;
      startIndex = content.indexOf(altStart);
      if (startIndex !== -1) {
        const contentStart = startIndex + altStart.length;
        const endIndex = content.indexOf(`=== END ${sectionName} ===`, contentStart);
        return endIndex !== -1
          ? content.substring(contentStart, endIndex).trim()
          : content.substring(contentStart).trim();
      }
      return '';
    }

    const contentStart = startIndex + startMarker.length;
    const endIndex = content.indexOf(endMarker, contentStart);

    if (endIndex !== -1) {
      return content.substring(contentStart, endIndex).trim();
    }

    // No end marker — take until next section or end
    const nextSectionMarkers = ['===CSS===', '===JAVASCRIPT===', '===END PAGE===', '===PAGE_NAME:'];
    let nearestNext = -1;
    for (const m of nextSectionMarkers) {
      const idx = content.indexOf(m, contentStart);
      if (idx !== -1 && (nearestNext === -1 || idx < nearestNext)) nearestNext = idx;
    }

    return nearestNext !== -1
      ? content.substring(contentStart, nearestNext).trim()
      : content.substring(contentStart).trim();
  }

  private cleanCode(code: string): string {
    if (!code) return '';
    return code
      .replace(/```html\n?/gi, '')
      .replace(/```css\n?/gi, '')
      .replace(/```javascript\n?/gi, '')
      .replace(/```js\n?/gi, '')
      .replace(/```\n?/g, '')
      .trim();
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
    const htmlSnippet = currentCode.pages?.[0]?.html?.substring(0, 1000) || currentCode.html?.substring(0, 1000) || 'No HTML available';

    const prompt = `I have a generated website, but the user wants changes.

CURRENT CODE (first page preview):
${htmlSnippet}...

USER FEEDBACK: "${feedback}"

Generate the COMPLETE updated website incorporating the feedback. Use the same output format.`;

    const response = await claudeService.sendMessage(
      [{ role: 'user', content: prompt }],
      { systemPrompt: CODE_GENERATION_SYSTEM_PROMPT, temperature: 0.5 }
    );

    return this.parseGeneratedCode(response);
  }
}

export const codeGenerationService = new CodeGenerationService();
