'use client';

import React, { useState, useMemo, useEffect } from 'react';
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

type TabType = 'preview' | 'code' | 'quality';

export const GenerationResult: React.FC<GenerationResultProps> = ({ code, quality, onBack, onReset }) => {
  const [activeTab, setActiveTab] = useState<TabType>('preview');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  // ── Build file list from pages — always produces real string content ──
  const files: GeneratedFile[] = useMemo(() => {
    const list: GeneratedFile[] = [];

    if (code.pages && code.pages.length > 0) {
      code.pages.forEach((page, idx) => {
        // Ensure html is always a string
        const htmlStr = typeof page.html === 'string' ? page.html : String(page.html ?? '');

        // If page HTML is already complete, use it directly
        // Otherwise build a complete document
        const isComplete = /<!DOCTYPE html>/i.test(htmlStr) || /<html[\s>]/i.test(htmlStr);
        const content = isComplete ? htmlStr : buildStandaloneHtml(page, code.pages || []);

        list.push({
          name: idx === 0 ? 'index.html' : `${page.id}.html`,
          type: 'html',
          content,
          path: idx === 0 ? 'index.html' : `${page.id}.html`,
        });
      });

      // Combined CSS file (if pages have separate css)
      const allCss = code.pages.map(p => p.css || '').filter(Boolean).join('\n\n/* ──── */\n\n');
      if (allCss.trim()) {
        list.push({ name: 'styles.css', type: 'css', content: allCss, path: 'styles.css' });
      }

      // Combined JS file (if pages have separate js)
      const allJs = code.pages.map(p => p.javascript || '').filter(Boolean).join('\n\n/* ──── */\n\n');
      if (allJs.trim()) {
        list.push({ name: 'script.js', type: 'javascript', content: allJs, path: 'script.js' });
      }
    } else if (code.website?.files) {
      // Use website.files but coerce content to string
      return code.website.files.map(f => ({
        ...f,
        content: typeof f.content === 'string' ? f.content : JSON.stringify(f.content, null, 2),
      }));
    } else if (code.html) {
      list.push({ name: 'index.html', type: 'html', content: code.html, path: 'index.html' });
      if (code.css) list.push({ name: 'styles.css', type: 'css', content: code.css, path: 'styles.css' });
      if (code.javascript) list.push({ name: 'script.js', type: 'javascript', content: code.javascript, path: 'script.js' });
    }

    return list;
  }, [code]);

  useEffect(() => {
    if (!selectedFile && files.length > 0) {
      setSelectedFile(files.find(f => f.type === 'html')?.name || files[0].name);
    }
  }, [files, selectedFile]);

  const currentFile = useMemo(() => {
    const f = files.find(f => f.name === selectedFile);
    if (!f) return null;
    return {
      ...f,
      // Always ensure content is a plain string for CodeEditor
      content: typeof f.content === 'string' ? f.content : JSON.stringify(f.content, null, 2),
    };
  }, [files, selectedFile]);

  const handleDownload = () => {
    files.forEach(file => {
      const el = document.createElement('a');
      const content = typeof file.content === 'string' ? file.content : String(file.content);
      el.href = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
      el.download = file.name;
      document.body.appendChild(el);
      el.click();
      document.body.removeChild(el);
      URL.revokeObjectURL(el.href);
    });
  };

  const tabs: { id: TabType; label: string; Icon: typeof Eye }[] = [
    { id: 'preview', label: 'Preview', Icon: Eye },
    { id: 'code', label: 'Code', Icon: Code2 },
    ...(quality ? [{ id: 'quality' as TabType, label: 'Quality', Icon: AlertCircle }] : []),
  ];

  return (
    <div style={{ height: '90vh' }} className="bg-gray-900 flex flex-col rounded-xl overflow-hidden border border-gray-700">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-3 flex items-center justify-between shrink-0">
        <div>
          <p className="text-white font-bold text-sm">✅ Website Generated</p>
          <p className="text-gray-400 text-xs">
            {code.pages?.length || 0} page(s) · {files.length} file(s)
            {quality && ` · Quality: ${quality.overall}/100`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Download All
          </button>
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg text-sm transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-gray-800/50 border-b border-gray-700 px-6 flex gap-1 shrink-0">
        {tabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 text-sm transition-colors ${
              activeTab === id
                ? 'border-blue-500 text-white'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'preview' && (
          <div className="h-full bg-gray-900 p-3">
            <div className="h-full bg-white rounded-lg overflow-hidden shadow-2xl">
              <LivePreview
                pages={code.pages}
                currentPageIndex={currentPageIndex}
                onPageChange={setCurrentPageIndex}
              />
            </div>
          </div>
        )}

        {activeTab === 'code' && (
          <div className="h-full flex bg-gray-900">
            <div className="w-60 border-r border-gray-700 shrink-0">
              <FileExplorer
                files={files}
                selectedFile={selectedFile}
                onFileSelect={setSelectedFile}
              />
            </div>
            <div className="flex-1 overflow-hidden">
              <CodeEditor file={currentFile} />
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

function buildStandaloneHtml(page: WebPage, allPages: WebPage[]): string {
  const navLinks = allPages
    .map(p => `<a onclick="parent.switchPage('${p.id}');return false;" href="#" 
      style="color:#fff;text-decoration:none;padding:6px 14px;border-radius:20px;
      background:rgba(255,255,255,0.15);font-size:14px;margin:0 3px;
      transition:background 0.2s" onmouseover="this.style.background='rgba(255,255,255,0.3)'"
      onmouseout="this.style.background='rgba(255,255,255,0.15)'">${p.name}</a>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${page.title || page.name}</title>
<style>
*{box-sizing:border-box}
body{margin:0;font-family:'Inter','Segoe UI',sans-serif}
.auto-nav{background:#1e293b;padding:12px 24px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
${page.css || ''}
</style>
</head>
<body>
<nav class="auto-nav">${navLinks}</nav>
${page.html || ''}
<script>${page.javascript || ''}<\/script>
</body>
</html>`;
}

export default GenerationResult;
