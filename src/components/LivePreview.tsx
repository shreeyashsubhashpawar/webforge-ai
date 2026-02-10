'use client';

import React, { useEffect, useRef } from 'react';
import { WebPage } from '@/types';

interface LivePreviewProps {
  pages?: WebPage[];
  currentPageIndex?: number;
  onPageChange?: (index: number) => void;
}

export const LivePreview: React.FC<LivePreviewProps> = ({
  pages = [],
  currentPageIndex = 0,
  onPageChange,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!pages || pages.length === 0 || !iframeRef.current) {
      return;
    }

    const currentPage = pages[currentPageIndex];
    if (!currentPage) {
      return;
    }

    // Create complete HTML document with inlined CSS
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${currentPage.title || 'Preview'}</title>
  <style>
    ${currentPage.css || ''}
  </style>
</head>
<body>
  ${currentPage.html || ''}
  <script>
    ${currentPage.javascript || ''}
  </script>
</body>
</html>
    `;

    // Write to iframe
    const iframe = iframeRef.current;
    iframe.srcdoc = htmlContent;
  }, [pages, currentPageIndex]);

  if (!pages || pages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 text-gray-500">
        <p>No preview available</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Page Navigation */}
      {pages.length > 1 && (
        <div className="border-b border-gray-200 bg-gray-50 p-4 flex gap-2 overflow-x-auto">
          {pages.map((page, index) => (
            <button
              key={page.id}
              onClick={() => onPageChange?.(index)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                currentPageIndex === index
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
              }`}
            >
              {page.name}
            </button>
          ))}
        </div>
      )}

      {/* Preview Area */}
      <div className="flex-1 overflow-hidden">
        <iframe
          ref={iframeRef}
          className="w-full h-full border-none"
          title="Website Preview"
          sandbox="allow-scripts allow-same-origin"
        />
      </div>

      {/* Info Bar */}
      <div className="border-t border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-600">
        <p>
          Showing page: <span className="font-semibold">{pages[currentPageIndex]?.name}</span> ({currentPageIndex + 1} of {pages.length})
        </p>
      </div>
    </div>
  );
};

export default LivePreview;
