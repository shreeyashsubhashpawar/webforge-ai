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

  // ──────────────────────────────────────────────────────────────────────────
  // FIX BUG 2 — Navigation buttons inside the iframe don't work.
  //
  // The generated pages use onclick="parent.switchPage('pageid')" for nav.
  // We expose window.switchPage on the PARENT window so the iframe can call it.
  // When called, we find the matching page index and call onPageChange().
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!onPageChange || !pages || pages.length === 0) return;

    // Expose switchPage on the parent window so iframe onclick="parent.switchPage(...)" works
    (window as any).switchPage = (pageId: string) => {
      const idx = pages.findIndex(
        (p) => p.id === pageId || p.id === pageId.replace('.html', '')
      );
      if (idx !== -1) {
        onPageChange(idx);
      }
    };

    return () => {
      delete (window as any).switchPage;
    };
  }, [pages, onPageChange]);

  useEffect(() => {
    if (!pages || pages.length === 0 || !iframeRef.current) return;

    const currentPage = pages[currentPageIndex];
    if (!currentPage) return;

    const html = currentPage.html || '';

    // If the page already has a complete HTML document, use it directly
    let htmlContent: string;
    if (/<!DOCTYPE html>/i.test(html) || /<html/i.test(html)) {
      htmlContent = html;
    } else {
      // Build a complete document embedding the page's CSS and JS
      htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${currentPage.title || currentPage.name || 'Preview'}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: 'Inter', 'Segoe UI', sans-serif; }
    ${currentPage.css || ''}
  </style>
</head>
<body>
  ${html}
  <script>
    ${currentPage.javascript || ''}
  </script>
</body>
</html>`;
    }

    // Use srcdoc for sandboxed rendering
    iframeRef.current.srcdoc = htmlContent;
  }, [pages, currentPageIndex]);

  if (!pages || pages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 text-gray-500">
        <div className="text-center">
          <p className="text-lg font-medium">No preview available</p>
          <p className="text-sm mt-1">Website generation may have failed to extract pages.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Page Navigation Tabs — always shown when multiple pages exist */}
      {pages.length > 1 && (
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 flex gap-2 flex-wrap">
          <span className="text-xs text-gray-500 self-center mr-2 font-medium">PAGES:</span>
          {pages.map((page, index) => (
            <button
              key={page.id}
              onClick={() => onPageChange?.(index)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                currentPageIndex === index
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-100 hover:border-gray-400'
              }`}
            >
              {page.name}
            </button>
          ))}
        </div>
      )}

      {/* Preview iframe */}
      <div className="flex-1 overflow-hidden">
        <iframe
          ref={iframeRef}
          className="w-full h-full border-none"
          title="Website Preview"
          sandbox="allow-scripts allow-same-origin allow-popups"
        />
      </div>

      {/* Status bar */}
      <div className="border-t border-gray-100 bg-gray-50 px-4 py-1.5 text-xs text-gray-500 flex justify-between">
        <span>
          Page: <strong>{pages[currentPageIndex]?.name}</strong>
        </span>
        <span>
          {currentPageIndex + 1} / {pages.length} pages
        </span>
      </div>
    </div>
  );
};

export default LivePreview;
