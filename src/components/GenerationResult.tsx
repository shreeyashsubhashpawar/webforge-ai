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

  // Convert pages or legacy code to file structure
  const files: GeneratedFile[] = React.useMemo(() => {
    const fileList: GeneratedFile[] = [];

    // If we have new website format
    if (code.website?.files) {
      return code.website.files;
    }

    // Convert pages to files
    if (code.pages && code.pages.length > 0) {
      code.pages.forEach(page => {
        // Add HTML file
        fileList.push({
          name: page.id === 'index' ? 'index.html' : `${page.id}.html`,
          type: 'html',
          content: page.html,
          path: page.id === 'index' ? 'index.html' : `pages/${page.id}.html`,
        });
      });

      // Add shared CSS if any
      if (code.pages.some(p => p.css)) {
        const sharedCss = code.pages.map(p => p.css || '').join('\n\n');
        fileList.push({
          name: 'styles.css',
          type: 'css',
          content: sharedCss,
          path: 'styles.css',
        });
      }

      // Add shared JavaScript if any
      if (code.pages.some(p => p.javascript)) {
        const sharedJs = code.pages.map(p => p.javascript || '').join('\n\n');
        fileList.push({
          name: 'script.js',
          type: 'javascript',
          content: sharedJs,
          path: 'script.js',
        });
      }
    } else if (code.html) {
      // Legacy format
      fileList.push({
        name: 'index.html',
        type: 'html',
        content: code.html,
        path: 'index.html',
      });

      if (code.css) {
        fileList.push({
          name: 'styles.css',
          type: 'css',
          content: code.css,
          path: 'styles.css',
        });
      }

      if (code.javascript) {
        fileList.push({
          name: 'script.js',
          type: 'javascript',
          content: code.javascript,
          path: 'script.js',
        });
      }
    }

    return fileList;
  }, [code]);

  // Set initial selected file
  React.useEffect(() => {
    if (selectedFile === null && files.length > 0) {
      setSelectedFile(files.find(f => f.type === 'html')?.name || files[0].name);
    }
  }, [files, selectedFile]);

  const currentFile = files.find(f => f.name === selectedFile);

  const handleDownload = () => {
    // Create a ZIP-like structure with all files
    // For now, just download individual files
    files.forEach(file => {
      const element = document.createElement('a');
      const blob = new Blob([file.content], { type: 'text/plain' });
      element.href = URL.createObjectURL(blob);
      element.download = file.name;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
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
          <p className="text-sm text-gray-400">Generated {files.length} file(s)</p>
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
        {tabConfig.map(tab => {
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
              <CodeEditor file={currentFile || null} />
            </div>
          </div>
        )}

        {activeTab === 'preview' && (
          <div className="h-full bg-gray-900 p-6">
            <div className="h-full bg-white rounded-lg shadow-2xl overflow-hidden">
              <LivePreview
                pages={code.pages}
                currentPageIndex={0}
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

export default GenerationResult;
