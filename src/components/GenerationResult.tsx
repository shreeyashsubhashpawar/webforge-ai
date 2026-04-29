'use client';

import React, { useState } from 'react';
import { Code2, Eye, AlertCircle, Download, ArrowLeft } from 'lucide-react';
import FileExplorer from './FileExplorer';
import CodeEditor from './CodeEditor';
import LivePreview from './LivePreview';
import QualityReport from './QualityReport';
import { GeneratedCode, GeneratedFile, WebPage, QualityScore } from '@/types';

interface GenerationResultProps {
  code: GeneratedCode;
  quality?: QualityScore;
  onBack?: () => void;
  onReset?: () => void;
}

type TabType = 'code' | 'preview' | 'quality';

export const GenerationResult: React.FC<GenerationResultProps> = ({
  code,
  quality,
  onBack,
  onReset,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('preview');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  // ── FIX BUG 2: track currentPageIndex in state so navigation actually works ──
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  // ─────────────────────────────────────────────────────────────────────────
  // FIX BUG 3 — [object Object] in code view
  //
  // The original code.website.files had GeneratedFile objects where
  // `content` was set to `this.createFullHtmlFile(page, pages)` which returns
  // a string referencing /styles.css and /script.js.  Those files don't exist
  // in the iframe context, so the preview was blank and the code view was showing
  // object representations instead of the actual code string.
  //
  // Fix: build files directly from code.pages (which always have the actual
  // HTML/CSS/JS strings), and ensure content is always a string.
  // ─────────────────────────────────────────────────────────────────────────
  const files: GeneratedFile[] = React.useMemo(() => {
    const fileList: GeneratedFile[] = [];

    if (code.pages && code.pages.length > 0) {
      // Build one complete HTML file per page (CSS already embedded by CodeGen)
      code.pages.forEach((page, idx) => {
        const htmlContent = buildCompleteHtmlPage(page, code.pages || []);
        fileList.push({
          name: idx === 0 ? 'index.html' : `${page.id}.html`,
          type: 'html',
          content: typeof htmlContent === 'string' ? htmlContent : String(htmlContent),
          path: idx === 0 ? 'index.html' : `${page.id}.html`,
        });
      });

      // Add combined CSS file if any page has separate css
      const allCss = code.pages.map((p) => p.css || '').filter(Boolean).join('\n\n');
      if (allCss.trim()) {
        fileList.push({
          name: 'styles.css',
          type: 'css',
          content: allCss,
          path: 'styles.css',
        });
      }

      // Add combined JS file if any page has separate js
      const allJs = code.pages.map((p) => p.javascript || '').filter(Boolean).join('\n\n');
      if (allJs.trim()) {
        fileList.push({
          name: 'script.js',
          type: 'javascript',
          content: allJs,
          path: 'script.js',
        });
      }
    } else if (code.website?.files) {
      // Use website files but ensure content is always a string
      return code.website.files.map((f) => ({
        ...f,
        content: typeof f.content === 'string' ? f.content : JSON.stringify(f.content, null, 2),
      }));
    } else if (code.html) {
      // Legacy single-page format
      fileList.push({ name: 'index.html', type: 'html', content: code.html, path: 'index.html' });
      if (code.css) fileList.push({ name: 'styles.css', type: 'css', content: code.css, path: 'styles.css' });
      if (code.javascript) fileList.push({ name: 'script.js', type: 'javascript', content: code.javascript, path: 'script.js' });
    }

    return fileList;
  }, [code]);

  // Set initial selected file
  React.useEffect(() => {
    if (selectedFile === null && files.length > 0) {
      setSelectedFile(files.find((f) => f.type === 'html')?.name || files[0].name);
    }
  }, [files, selectedFile]);

  const currentFile = files.find((f) => f.name === selectedFile);

  const handleDownload = () => {
    files.forEach((file) => {
      const element = document.createElement('a');
      const blob = new Blob([file.content], { type: 'text/plain' });
      element.href = URL.createObjectURL(blob);
      element.download = file.name;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      URL.revokeObjectURL(element.href);
    });
  };

  const tabConfig = [
    { id: 'code' as const, label: 'Code', icon: Code2 },
    { id: 'preview' as const, label: 'Preview', icon: Eye },
    ...(quality ? [{ id: 'quality' as const, label: 'Quality Report', icon: AlertCircle }] : []),
  ];

  return (
    <div className="h-screen bg-gradient-to-b from-gray-900 to-black flex flex-col">
      {/* Header */}
      <div className="bg-gray-800/50 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <div>
          <h6 className="text-white font-bold">Website Generated Successfully!</h6>
          <p className="text-sm text-gray-400">
            {code.pages?.length || 0} page(s) • {files.length} file(s)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Download Files
          </button>
          <button
            onClick={onBack}
            className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-gray-800/30 border-b border-gray-700 px-6 flex gap-1">
        {tabConfig.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-white'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'code' && (
          <div className="h-full flex gap-0 bg-gray-900">
            <div className="w-64 border-r border-gray-700">
              <FileExplorer
                files={files}
                selectedFile={selectedFile}
                onFileSelect={setSelectedFile}
              />
            </div>
            <div className="flex-1">
              {/* ✅ FIX: ensure file.content is always a string before passing to CodeEditor */}
              <CodeEditor
                file={
                  currentFile
                    ? {
                        ...currentFile,
                        content:
                          typeof currentFile.content === 'string'
                            ? currentFile.content
                            : JSON.stringify(currentFile.content, null, 2),
                      }
                    : null
                }
              />
            </div>
          </div>
        )}

        {activeTab === 'preview' && (
          <div className="h-full bg-gray-900 p-4">
            <div className="h-full bg-white rounded-lg shadow-2xl overflow-hidden">
              {/* ✅ FIX BUG 2: pass currentPageIndex state + onPageChange handler */}
              <LivePreview
                pages={code.pages}
                currentPageIndex={currentPageIndex}
                onPageChange={setCurrentPageIndex}
              />
            </div>
          </div>
        )}

        {activeTab === 'quality' && quality && (
          <div className="h-full overflow-auto bg-gray-900 p-6">
            <div className="max-w-4xl mx-auto">
              <QualityReport quality={quality} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: build a complete self-contained HTML file for a page.
// If the page.html is already a full document (has <html> tag), use it as-is.
// Otherwise wrap the body content with the shared CSS embedded.
// ─────────────────────────────────────────────────────────────────────────────
function buildCompleteHtmlPage(page: WebPage, allPages: WebPage[]): string {
  const html = page.html || '';

  // If already a complete HTML document, return as-is
  if (/<!DOCTYPE html>/i.test(html) || /<html/i.test(html)) {
    return html;
  }

  // Otherwise build a complete document
  const navLinks = allPages
    .map(
      (p) =>
        `<a href="${p.id === 'home' ? 'index' : p.id}.html" style="color:#fff;text-decoration:none;padding:8px 16px;border-radius:4px;background:rgba(255,255,255,0.15);margin:0 4px">${p.name}</a>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${page.title || page.name}</title>
  <style>
    body { margin: 0; font-family: 'Inter', sans-serif; }
    .generated-nav { background: #1e293b; padding: 12px 24px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    ${page.css || ''}
  </style>
</head>
<body>
  <nav class="generated-nav">
    ${navLinks}
  </nav>
  ${html}
  <script>
    ${page.javascript || ''}
  </script>
</body>
</html>`;
}

export default GenerationResult;
