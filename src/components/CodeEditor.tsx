'use client';

import React, { useState } from 'react';
import { Copy, Check, Download } from 'lucide-react';
import { GeneratedFile } from '@/types';

interface CodeEditorProps {
  file: GeneratedFile | null;
  onCopy?: () => void;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ file, onCopy }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (file) {
      navigator.clipboard.writeText(file.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onCopy?.();
    }
  };

  const getLanguage = () => {
    if (!file) return 'plaintext';
    switch (file.type) {
      case 'html':
        return 'html';
      case 'css':
        return 'css';
      case 'javascript':
        return 'javascript';
      default:
        return 'plaintext';
    }
  };

  const highlightCode = (code: string, type: string) => {
    const lines = code.split('\n');
    return lines.map((line, idx) => (
      <div key={idx} className="flex">
        <span className="w-12 text-right pr-4 text-gray-600 select-none">
          {idx + 1}
        </span>
        <span className="flex-1 font-mono text-sm text-gray-100 whitespace-pre-wrap break-words">
          {highlightLine(line, type)}
        </span>
      </div>
    ));
  };

  const highlightLine = (line: string, type: string) => {
    // Simple syntax highlighting
    let highlighted = line;

    if (type === 'html') {
      highlighted = highlighted
        .replace(/(&lt;[^&]*?&gt;)/g, '<span class="text-red-400">$1</span>')
        .replace(/([a-zA-Z-]+)=/g, '<span class="text-blue-400">$1</span>=')
        .replace(/"[^"]*"/g, match => `<span class="text-green-400">${match}</span>`);
    } else if (type === 'css') {
      highlighted = highlighted
        .replace(/([^{]*){/g, '<span class="text-blue-400">$1</span>{')
        .replace(/:([^;]*);/g, ': <span class="text-green-400">$1</span>;')
        .replace(/\.[a-zA-Z0-9_-]+/g, match => `<span class="text-yellow-400">${match}</span>`);
    } else if (type === 'javascript') {
      highlighted = highlighted
        .replace(/(const|let|var|function|return|if|else|for|while)\b/g, '<span class="text-purple-400">$1</span>')
        .replace(/"[^"]*"/g, match => `<span class="text-green-400">${match}</span>`)
        .replace(/'[^']*'/g, match => `<span class="text-green-400">${match}</span>`)
        .replace(/\/\/.*$/g, match => `<span class="text-gray-500">${match}</span>`);
    }

    return highlighted || line;
  };

  if (!file) {
    return (
      <div className="h-full bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 text-lg">Select a file to view its content</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg">
            {file.type === 'html'
              ? '🌐'
              : file.type === 'css'
              ? '🎨'
              : file.type === 'javascript'
              ? '⚙️'
              : '📄'}
          </span>
          <div>
            <p className="text-white font-semibold">{file.name}</p>
            <p className="text-xs text-gray-400">
              {file.type.toUpperCase()} • {file.content.length} characters
            </p>
          </div>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition-colors text-sm"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              Copy
            </>
          )}
        </button>
      </div>

      {/* Code */}
      <div className="flex-1 overflow-auto">
        <div className="bg-gray-900 p-4 font-mono text-sm">
          <div dangerouslySetInnerHTML={{ __html: highlightCode(file.content, file.type).join('') }} />
        </div>
      </div>
    </div>
  );
};

export default CodeEditor;
