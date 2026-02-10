'use client';

import { useState } from 'react';
import { Code, Eye, FileCode } from 'lucide-react';
import { GeneratedCode } from '@/types';

interface CodePreviewProps {
  code: GeneratedCode;
}

export default function CodePreview({ code }: CodePreviewProps) {
  const [activeTab, setActiveTab] = useState<'preview' | 'html' | 'css' | 'js'>('preview');
  const [selectedPage, setSelectedPage] = useState(0);

  // Support both multi-page and legacy single-page formats
  const pages = code.pages || (code.html ? [{ id: 'index', name: 'Home', html: code.html, css: code.css, javascript: code.javascript }] : []);
  const currentPage = pages[selectedPage];

  const createPreviewUrl = () => {
    if (!currentPage) return '';
    
    const completeHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${currentPage.title || 'Preview'}</title>
    <style>${currentPage.css || ''}</style>
</head>
<body>
${currentPage.html}
${currentPage.javascript ? `<script>${currentPage.javascript}</script>` : ''}
</body>
</html>`;

    const blob = new Blob([completeHtml], { type: 'text/html' });
    return URL.createObjectURL(blob);
  };

  const tabs = [
    { id: 'preview' as const, label: 'Preview', icon: Eye },
    { id: 'html' as const, label: 'HTML', icon: FileCode },
    { id: 'css' as const, label: 'CSS', icon: FileCode },
    ...(currentPage?.javascript ? [{ id: 'js' as const, label: 'JavaScript', icon: Code }] : []),
  ];

  const getCodeContent = () => {
    if (!currentPage) return '';
    
    switch (activeTab) {
      case 'html':
        return currentPage.html;
      case 'css':
        return currentPage.css || '';
      case 'js':
        return currentPage.javascript || '';
      default:
        return '';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Page Selector */}
      {pages.length > 1 && (
        <div className="border-b border-gray-200 bg-gray-50 px-6 py-3 flex gap-2">
          {pages.map((page, index) => (
            <button
              key={page.id}
              onClick={() => setSelectedPage(index)}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                selectedPage === index
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
              }`}
            >
              {page.name}
            </button>
          ))}
        </div>
      )}

      {/* Code Tabs */}
      <div className="border-b border-gray-200 bg-gray-50">
        <div className="flex space-x-1 p-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${
                  activeTab === tab.id
                    ? 'bg-white text-blue-600 shadow-sm font-semibold'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <Icon size={16} />
                <span className="text-sm">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="relative">
        {activeTab === 'preview' ? (
          <div className="bg-gray-100 p-4">
            <div className="bg-white rounded-lg shadow-inner overflow-hidden">
              <iframe
                src={createPreviewUrl()}
                className="w-full h-[600px] border-0"
                title="Website Preview"
                sandbox="allow-scripts"
              />
            </div>
          </div>
        ) : (
          <div className="relative">
            <pre className="p-6 overflow-x-auto text-sm bg-gray-900 text-gray-100 font-mono max-h-[600px]">
              <code>{getCodeContent()}</code>
            </pre>
            <button
              onClick={() => {
                navigator.clipboard.writeText(getCodeContent());
                alert('Code copied to clipboard!');
              }}
              className="absolute top-4 right-4 bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded text-xs"
            >
              Copy
            </button>
          </div>
        )}
      </div>

      {/* Info Footer */}
      <div className="border-t border-gray-200 bg-gray-50 px-6 py-3">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <div className="flex space-x-4">
            {currentPage && (
              <>
                <span>HTML: {currentPage.html.length} chars</span>
                <span>CSS: {(currentPage.css?.length || 0)} chars</span>
                {currentPage.javascript && <span>JS: {currentPage.javascript.length} chars</span>}
              </>
            )}
          </div>
          <div className="flex items-center gap-4">
            {pages.length > 1 && <span>Pages: {pages.length}</span>}
            <span className="font-semibold">Framework: {code.framework || 'Vanilla'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
