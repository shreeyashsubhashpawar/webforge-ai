'use client';

import React from 'react';
import { File, Folder, ChevronRight, ChevronDown } from 'lucide-react';
import { GeneratedFile } from '@/types';

interface FileExplorerProps {
  files: GeneratedFile[];
  selectedFile: string | null;
  onFileSelect: (fileName: string) => void;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  files,
  selectedFile,
  onFileSelect,
}) => {
  // Group files by type and organize them
  const htmlFiles = files.filter(f => f.type === 'html');
  const cssFiles = files.filter(f => f.type === 'css');
  const jsFiles = files.filter(f => f.type === 'javascript');
  const otherFiles = files.filter(f => !['html', 'css', 'javascript'].includes(f.type));

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'html':
        return '🌐';
      case 'css':
        return '🎨';
      case 'javascript':
        return '⚙️';
      default:
        return '📄';
    }
  };

  const FileItem: React.FC<{ file: GeneratedFile }> = ({ file }) => (
    <button
      onClick={() => onFileSelect(file.name)}
      className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors rounded ${
        selectedFile === file.name
          ? 'bg-blue-500/20 text-blue-400 border-l-2 border-blue-400'
          : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
      }`}
    >
      <span className="text-lg">{getFileIcon(file.type)}</span>
      <span className="truncate">{file.name}</span>
    </button>
  );

  return (
    <div className="w-full h-full bg-gray-900 border-r border-gray-700 flex flex-col overflow-y-auto">
      <div className="sticky top-0 bg-gray-800 px-4 py-3 border-b border-gray-700">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Folder className="w-4 h-4" />
          Files ({files.length})
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* HTML Files */}
        {htmlFiles.length > 0 && (
          <div className="px-2 py-2">
            <div className="text-xs font-semibold text-gray-400 px-2 py-1 uppercase tracking-wider">
              HTML
            </div>
            <div className="space-y-1">
              {htmlFiles.map(file => (
                <FileItem key={file.name} file={file} />
              ))}
            </div>
          </div>
        )}

        {/* CSS Files */}
        {cssFiles.length > 0 && (
          <div className="px-2 py-2">
            <div className="text-xs font-semibold text-gray-400 px-2 py-1 uppercase tracking-wider">
              Styles
            </div>
            <div className="space-y-1">
              {cssFiles.map(file => (
                <FileItem key={file.name} file={file} />
              ))}
            </div>
          </div>
        )}

        {/* JavaScript Files */}
        {jsFiles.length > 0 && (
          <div className="px-2 py-2">
            <div className="text-xs font-semibold text-gray-400 px-2 py-1 uppercase tracking-wider">
              Scripts
            </div>
            <div className="space-y-1">
              {jsFiles.map(file => (
                <FileItem key={file.name} file={file} />
              ))}
            </div>
          </div>
        )}

        {/* Other Files */}
        {otherFiles.length > 0 && (
          <div className="px-2 py-2">
            <div className="text-xs font-semibold text-gray-400 px-2 py-1 uppercase tracking-wider">
              Other
            </div>
            <div className="space-y-1">
              {otherFiles.map(file => (
                <FileItem key={file.name} file={file} />
              ))}
            </div>
          </div>
        )}

        {files.length === 0 && (
          <div className="p-4 text-center text-gray-500 text-sm">
            <p>No files generated yet</p>
          </div>
        )}
      </div>

      {files.length > 0 && (
        <div className="border-t border-gray-700 bg-gray-800 px-4 py-3 text-xs text-gray-400">
          <p>Total: {files.length} files</p>
        </div>
      )}
    </div>
  );
};

export default FileExplorer;
