'use client';

import React, { useEffect, useRef, useCallback } from 'react';
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

  // ── Expose switchPage on parent window so iframe nav links work ──
  useEffect(() => {
    if (!onPageChange || !pages || pages.length === 0) return;

    (window as any).switchPage = (pageId: string) => {
      const clean = pageId.replace(/\.html$/, '');
      const idx = pages.findIndex((p) => p.id === clean || p.id === pageId);
      if (idx !== -1) {
        console.log(`[LivePreview] switchPage("${pageId}") → index ${idx}`);
        onPageChange(idx);
      } else {
        console.warn(`[LivePreview] switchPage: no page found for "${pageId}". Pages: ${pages.map(p => p.id).join(', ')}`);
      }
    };

    return () => { delete (window as any).switchPage; };
  }, [pages, onPageChange]);

  // ── Render the current page into the iframe ──
  useEffect(() => {
    if (!pages || pages.length === 0 || !iframeRef.current) return;

    const page = pages[Math.min(currentPageIndex, pages.length - 1)];
    if (!page) return;

    const rawHtml = page.html || '';

    // Build a complete document — handle both complete and partial HTML
    let htmlContent: string;

    if (/<!DOCTYPE html>/i.test(rawHtml) || /<html[\s>]/i.test(rawHtml)) {
      // Already a complete document — use as-is
      htmlContent = rawHtml;
    } else if (/<body[\s>]/i.test(rawHtml)) {
      // Has body tag but no doctype — wrap it
      htmlContent = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${page.title || page.name}</title>
<style>*{box-sizing:border-box}body{margin:0;font-family:'Inter','Segoe UI',sans-serif}
${page.css || ''}</style>
</head>${rawHtml}`;
    } else {
      // Just body content — wrap fully
      htmlContent = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${page.title || page.name}</title>
<style>*{box-sizing:border-box}body{margin:0;font-family:'Inter','Segoe UI',sans-serif}
${page.css || ''}</style>
</head><body>${rawHtml}
<script>${page.javascript || ''}<\/script>
</body></html>`;
    }

    // Set srcdoc — this triggers iframe re-render
    iframeRef.current.srcdoc = htmlContent;
  }, [pages, currentPageIndex]);

  if (!pages || pages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 text-gray-500 flex-col gap-3">
        <div className="text-4xl">🔨</div>
        <p className="text-lg font-medium">No preview available</p>
        <p className="text-sm text-gray-400">Website generation did not produce renderable pages.</p>
        <p className="text-sm text-gray-400">Check the Code tab for raw output.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Page navigation tabs */}
      {pages.length > 1 && (
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-2 flex gap-2 flex-wrap items-center">
          <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide mr-1">Pages:</span>
          {pages.map((page, index) => (
            <button
              key={page.id}
              onClick={() => onPageChange?.(index)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                currentPageIndex === index
                  ? 'bg-blue-600 text-white shadow-sm scale-105'
                  : 'bg-white text-gray-600 border border-gray-300 hover:bg-blue-50 hover:border-blue-300'
              }`}
            >
              {page.name}
            </button>
          ))}
        </div>
      )}

      {/* iframe */}
      <div className="flex-1 overflow-hidden">
        <iframe
          ref={iframeRef}
          className="w-full h-full border-none"
          title={`Preview: ${pages[currentPageIndex]?.name || 'Page'}`}
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        />
      </div>

      {/* Status bar */}
      <div className="border-t border-gray-100 bg-gray-50 px-4 py-1 text-xs text-gray-400 flex justify-between items-center">
        <span>
          Viewing: <strong className="text-gray-600">{pages[currentPageIndex]?.name}</strong>
        </span>
        <span>{currentPageIndex + 1} / {pages.length} pages · {pages[currentPageIndex]?.html?.length?.toLocaleString() || 0} chars</span>
      </div>
    </div>
  );
};

export default LivePreview;
