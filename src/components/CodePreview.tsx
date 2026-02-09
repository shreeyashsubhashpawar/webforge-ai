'use client';

import { useState } from 'react';
import { Code, Eye, FileCode } from 'lucide-react';
import { GeneratedCode } from '@/types';

interface CodePreviewProps {
  code: GeneratedCode;
}

export default function CodePreview({ code }: CodePreviewProps) {
  const [activeTab, setActiveTab] = useState<'preview' | 'html' | 'css' | 'js'>('preview');

  const createPreviewUrl = () => {
    const completeHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Preview</title>
    <style>${code.css}</style>
</head>
<body>
${code.html}
${code.javascript ? `<script>${code.javascript}</script>` : ''}
</body>
</html>`;

    const blob = new Blob([completeHtml], { type: 'text/html' });
    return URL.createObjectURL(blob);
  };

  const tabs = [
    { id: 'preview' as const, label: 'Preview', icon: Eye },
    { id: 'html' as const, label: 'HTML', icon: FileCode },
    { id: 'css' as const, label: 'CSS', icon: FileCode },
    ...(code.javascript ? [{ id: 'js' as const, label: 'JavaScript', icon: Code }] : []),
  ];

  const getCodeContent = () => {
    switch (activeTab) {
      case 'html':
        return code.html;
      case 'css':
        return code.css;
      case 'js':
        return code.javascript;
      default:
        return '';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Tabs */}
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
            <span>HTML: {code.html.length} chars</span>
            <span>CSS: {code.css.length} chars</span>
            {code.javascript && <span>JS: {code.javascript.length} chars</span>}
          </div>
          <span className="font-semibold">Framework: {code.framework || 'Vanilla'}</span>
        </div>
      </div>
    </div>
  );
}
