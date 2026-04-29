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

const CODE_GENERATION_SYSTEM_PROMPT = `You are an expert web developer. Generate complete multi-page websites.

CRITICAL RULE — USE REAL CONTENT:
When document content is provided, you MUST use the REAL data:
- Real names → put them in HTML, never "John Doe"
- Real phone numbers → display them, never "+91 XXXXXXXXXX"  
- Real addresses → show them, never "123 Main St"
- Real achievements → list as actual bullet points
- Organization/department name → use in <h1> and <title>
- NEVER use lorem ipsum when real content is provided

OUTPUT FORMAT — follow EXACTLY:

===PAGE_NAME:home===
===HTML===
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Page Title</title>
<style>
/* All CSS embedded here */
</style>
</head>
<body>
<!-- Full page content -->
<script>/* JS here */</script>
</body>
</html>
===END HTML===
===END PAGE===

===PAGE_NAME:about===
===HTML===
[complete HTML document]
===END HTML===
===END PAGE===

RULES:
1. Each page = COMPLETE standalone HTML with embedded <style> and <script>
2. Generate EXACTLY 4 pages: home, about, achievements, contact
3. Navigation: <a onclick="parent.switchPage('pageid'); return false;" href="#">Page Name</a>
4. Contact page: show REAL phone, email, address from document
5. Professional design: CSS Grid/Flexbox, gradients, hover effects, responsive
6. DO NOT use external CSS files — embed everything in <style> tags`;

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

      console.log(`[CodeGen] Mode: ${augmentedPrompt ? 'RAG-AUGMENTED' : 'standard'}`);
      console.log(`[CodeGen] Prompt length: ${prompt.length} chars`);
      // Log first 500 chars of prompt so we can verify PDF content is in it
      console.log(`[CodeGen] Prompt preview:\n${prompt.substring(0, 500)}\n...`);

      const response = await claudeService.sendMessage(
        [{ role: 'user', content: prompt }],
        {
          systemPrompt: CODE_GENERATION_SYSTEM_PROMPT,
          temperature: 0.3,
          maxTokens: 8192, // ✅ Must be 8192 — 4096 cuts off multi-page output
        }
      );

      console.log(`[CodeGen] Claude response: ${response.length} chars`);

      const code = this.parseGeneratedCode(response);
      console.log(`[CodeGen] Parsed ${code.pages.length} pages`);
      return code;
    } catch (error) {
      console.error('Error generating website code:', error);
      throw new Error(`Code generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private buildDocumentContext(documents?: ProcessedDocument[]): string {
    if (!documents || documents.length === 0) return '';
    let ctx = '\n\nCONTENT FROM UPLOADED DOCUMENTS:\n\n';
    for (const doc of documents) {
      ctx += `Document: ${doc.originalName}\n${doc.text.substring(0, 3000)}\n\n`;
    }
    return ctx;
  }

  private buildGenerationPrompt(
    intent: IntentClassification,
    design: DesignRecommendation,
    documentContext: string
  ): string {
    return `Generate a complete MULTI-PAGE website.

PURPOSE: ${intent.primaryIntent}
STYLE: ${intent.designPreferences?.style || 'modern'}
PRIMARY COLOR: ${design.colorPalette?.primary || '#2563eb'}
HEADING FONT: ${design.typography?.headingFont || 'Inter'}

REQUIREMENTS:
${(intent.extractedRequirements || []).map((r: string, i: number) => `${i + 1}. ${r}`).join('\n')}
${documentContext}

Generate 4 complete pages now.`;
  }

  private parseGeneratedCode(response: string): GeneratedCode {
    const pages = this.extractPages(response);

    if (pages.length === 0) {
      console.error('[CodeGen] No pages found in response. Preview:\n', response.substring(0, 1000));
      // Emergency: wrap raw response so user sees something
      pages.push({
        id: 'index',
        name: 'Home',
        title: 'Home',
        html: `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Generated Website</title>
<style>body{font-family:sans-serif;padding:2rem;max-width:900px;margin:0 auto}</style>
</head><body><div style="background:#fef3c7;border:1px solid #f59e0b;padding:1rem;border-radius:8px;margin-bottom:1rem">
<strong>⚠️ Parser could not extract structured pages.</strong><br>
The raw Claude response is shown below. Check server logs for details.
</div><pre style="white-space:pre-wrap;font-size:12px">${response.replace(/</g, '&lt;').substring(0, 5000)}</pre>
</body></html>`,
        css: '',
        javascript: '',
        route: '/',
      });
    }

    const files: GeneratedFile[] = pages.map((page, idx) => ({
      name: idx === 0 ? 'index.html' : `${page.id}.html`,
      type: 'html' as const,
      content: page.html,
      path: idx === 0 ? 'index.html' : `${page.id}.html`,
    }));

    const website: GeneratedWebsite = {
      files,
      mainFile: 'index.html',
      framework: 'vanilla',
    };

    return { pages, website, framework: 'vanilla', dependencies: [] };
  }

  private extractPages(response: string): WebPage[] {
    const pages: WebPage[] = [];

    // ✅ Regex literal — [\s\S] correctly matches any character including newlines
    const pagePattern = /===PAGE_NAME:([^=\n]+)===[\s\S]*?===END PAGE===/g;
    let match: RegExpExecArray | null;

    while ((match = pagePattern.exec(response)) !== null) {
      const rawName = match[0].match(/===PAGE_NAME:([^=\n]+)===/)?.[1]?.trim() || 'page';
      const block = match[0];
      const html = this.extractSection(block, 'HTML');

      if (html && html.trim().length > 50) {
        const clean = this.cleanCode(html);
        const id = rawName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'page';
        pages.push({
          id,
          name: this.formatName(rawName),
          title: this.formatName(rawName),
          html: clean,
          css: '',
          javascript: '',
          route: `/${id}`,
        });
        console.log(`[CodeGen] Page extracted: "${rawName}" — ${clean.length} chars`);
      }
    }

    // Fallback 1: find complete HTML documents anywhere in the response
    if (pages.length === 0) {
      console.warn('[CodeGen] No PAGE_NAME blocks — trying HTML document fallback');
      const docPattern = /<!DOCTYPE html>[\s\S]*?<\/html>/gi;
      let docMatch: RegExpExecArray | null;
      let docIdx = 0;
      const pageNames = ['home', 'about', 'achievements', 'contact'];

      while ((docMatch = docPattern.exec(response)) !== null) {
        const id = pageNames[docIdx] || `page-${docIdx + 1}`;
        pages.push({
          id,
          name: this.formatName(id),
          title: this.formatName(id),
          html: docMatch[0],
          css: '',
          javascript: '',
          route: `/${id}`,
        });
        docIdx++;
        console.log(`[CodeGen] Fallback page ${docIdx}: "${id}" — ${docMatch[0].length} chars`);
      }
    }

    // Fallback 2: find ===HTML=== sections
    if (pages.length === 0) {
      console.warn('[CodeGen] Trying ===HTML=== section fallback');
      const html = this.extractSection(response, 'HTML');
      if (html && html.length > 50) {
        pages.push({
          id: 'index',
          name: 'Home',
          title: 'Home',
          html: this.cleanCode(html),
          css: this.cleanCode(this.extractSection(response, 'CSS')),
          javascript: this.cleanCode(this.extractSection(response, 'JAVASCRIPT')),
          route: '/',
        });
        console.log('[CodeGen] HTML section fallback used');
      }
    }

    return pages;
  }

  private formatName(raw: string): string {
    return raw.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
  }

  private extractSection(content: string, name: string): string {
    const start = `===${name}===`;
    const end = `===END ${name}===`;

    let si = content.indexOf(start);
    if (si === -1) return '';

    const ci = si + start.length;
    const ei = content.indexOf(end, ci);

    if (ei !== -1) return content.substring(ci, ei).trim();

    // No end marker — take until next section
    const nexts = ['===CSS===', '===JAVASCRIPT===', '===END PAGE===', '===PAGE_NAME:'];
    let nearest = -1;
    for (const m of nexts) {
      const i = content.indexOf(m, ci);
      if (i !== -1 && (nearest === -1 || i < nearest)) nearest = i;
    }
    return nearest !== -1 ? content.substring(ci, nearest).trim() : content.substring(ci).trim();
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
    const prompt = this.buildGenerationPrompt(intent, design, this.buildDocumentContext(documents));
    let currentSection: 'html' | 'css' | 'javascript' | null = null;

    for await (const chunk of claudeService.streamMessage(
      [{ role: 'user', content: prompt }],
      { systemPrompt: CODE_GENERATION_SYSTEM_PROMPT, temperature: 0.3, maxTokens: 8192 }
    )) {
      if (chunk.includes('===HTML===')) currentSection = 'html';
      else if (chunk.includes('===CSS===')) currentSection = 'css';
      else if (chunk.includes('===JAVASCRIPT===')) currentSection = 'javascript';
      if (currentSection) yield { type: currentSection, content: chunk };
    }
    yield { type: 'complete', content: 'done' };
  }

  async refineCode(currentCode: GeneratedCode, feedback: string): Promise<GeneratedCode> {
    const preview = currentCode.pages?.[0]?.html?.substring(0, 800) || currentCode.html?.substring(0, 800) || '';
    const prompt = `Existing website preview:\n${preview}\n\nUser feedback: "${feedback}"\n\nGenerate the COMPLETE updated website.`;
    const response = await claudeService.sendMessage(
      [{ role: 'user', content: prompt }],
      { systemPrompt: CODE_GENERATION_SYSTEM_PROMPT, temperature: 0.5, maxTokens: 8192 }
    );
    return this.parseGeneratedCode(response);
  }
}

export const codeGenerationService = new CodeGenerationService();
