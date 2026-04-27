'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useWizard } from '@/store/WizardContext';
import { Loader2, AlertCircle, CheckCircle2, Image as ImageIcon } from 'lucide-react';

export const StepRAG: React.FC = () => {
  const { uploadedFiles, ragContext, setRAGContext, goToNextStep, goToPreviousStep } = useWizard();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [stats, setStats] = useState<{
    pages: number;
    chunks: number;
    words: number;
    images: number;
  } | null>(null);

  const processedFileIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (ragContext || isProcessing || success) return;

    const pdfFile = uploadedFiles.find((f) => f.type === 'pdf');
    if (!pdfFile) return;

    // Content not ready yet — re-runs automatically when uploadedFiles reference changes
    if (!pdfFile.content || !pdfFile.content.startsWith('data:')) {
      console.log('[StepRAG] Waiting for file content...');
      return;
    }

    // Don't re-process the same file
    if (processedFileIdRef.current === pdfFile.id) return;

    processedFileIdRef.current = pdfFile.id;
    console.log('[StepRAG] Content ready, starting RAG for:', pdfFile.name, 'length:', pdfFile.content.length);
    processRAG(pdfFile);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadedFiles, ragContext, isProcessing, success]);

  const processRAG = async (pdfFile: any) => {
    setIsProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      const fetchRes = await fetch(pdfFile.content);
      if (!fetchRes.ok) throw new Error(`Failed to decode file: ${fetchRes.statusText}`);
      const blob = await fetchRes.blob();
      formData.append('file', blob, pdfFile.name);

      console.log('[StepRAG] Sending to /api/rag/process, blob size:', blob.size);

      const response = await fetch('/api/rag/process', { method: 'POST', body: formData });
      const data = await response.json();

      if (!data.success) throw new Error(data.error || 'RAG processing failed');

      console.log('[StepRAG] Success:', data.stats);
      setStats(data.stats);
      setSuccess(true);

      setRAGContext(
        {
          id: data.ragContextId,
          documentId: pdfFile.id,
          documentName: pdfFile.name,
          chunks: [],
          vectorIndex: [],
          imageIds: [],
          metadata: {
            createdAt: new Date(),
            totalChunks: data.stats.chunks,
            totalWords: data.stats.words,
          },
        },
        data.ragContextId
      );

      setTimeout(() => goToNextStep(), 1500);
    } catch (err) {
      console.error('[StepRAG] Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      processedFileIdRef.current = null; // allow retry
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetry = () => {
    processedFileIdRef.current = null;
    setError(null);
    const pdfFile = uploadedFiles.find((f) => f.type === 'pdf');
    if (pdfFile?.content) processRAG(pdfFile);
  };

  if (uploadedFiles.length === 0 || uploadedFiles.every((f) => f.type !== 'pdf')) {
    return (
      <div className="w-full max-w-2xl mx-auto p-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-blue-900 mb-2">RAG Pipeline Setup</h2>
          <p className="text-blue-700 mb-4">Please upload a PDF file first to proceed with the RAG pipeline.</p>
          <button onClick={goToPreviousStep} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
            Back to Upload
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">RAG Pipeline Processing</h1>
        <p className="text-gray-600">
          Your document is being processed for intelligent context retrieval. This allows the AI to generate better websites by understanding your content.
        </p>
      </div>

      {isProcessing && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 mb-6">
          <div className="flex items-center gap-4">
            <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            <div>
              <h3 className="font-semibold text-blue-900">Processing PDF...</h3>
              <p className="text-sm text-blue-700">Extracting text, images, and creating embeddings...</p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-red-900">Error Processing PDF</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
              <div className="mt-4 flex gap-2">
                <button onClick={goToPreviousStep} className="px-3 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition">
                  Back to Upload
                </button>
                <button onClick={handleRetry} className="px-3 py-2 bg-gray-600 text-white rounded text-sm hover:bg-gray-700 transition">
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {success && stats && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div className="flex-grow">
              <h3 className="font-semibold text-green-900">PDF Processing Complete</h3>
              <p className="text-sm text-green-700 mt-1">Your document has been successfully processed.</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <div className="bg-white rounded p-3 border border-green-100">
                  <div className="text-lg font-bold text-green-700">{stats.pages}</div>
                  <div className="text-xs text-gray-600">Pages</div>
                </div>
                <div className="bg-white rounded p-3 border border-green-100">
                  <div className="text-lg font-bold text-green-700">{stats.chunks}</div>
                  <div className="text-xs text-gray-600">Chunks</div>
                </div>
                <div className="bg-white rounded p-3 border border-green-100">
                  <div className="text-lg font-bold text-green-700">{stats.words.toLocaleString()}</div>
                  <div className="text-xs text-gray-600">Words</div>
                </div>
                <div className="bg-white rounded p-3 border border-green-100">
                  <div className="text-lg font-bold text-green-700 flex items-center gap-1">
                    <ImageIcon className="w-4 h-4" />{stats.images}
                  </div>
                  <div className="text-xs text-gray-600">Images</div>
                </div>
              </div>
              <p className="text-sm text-green-700 mt-4">
                ✓ Text extracted and chunked<br />
                ✓ Embeddings generated with Ollama<br />
                ✓ Vector index created for semantic search<br />
                ✓ Images extracted for website integration
              </p>
            </div>
          </div>
        </div>
      )}

      {!isProcessing && !error && !success && (
        <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">How RAG Works</h3>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex gap-2"><span className="font-bold text-blue-600 flex-shrink-0">1.</span><span><strong>Text Extraction:</strong> The PDF content is extracted and organized by pages</span></li>
            <li className="flex gap-2"><span className="font-bold text-blue-600 flex-shrink-0">2.</span><span><strong>Chunking:</strong> Text is split into overlapping chunks for better context understanding</span></li>
            <li className="flex gap-2"><span className="font-bold text-blue-600 flex-shrink-0">3.</span><span><strong>Embeddings:</strong> Each chunk is converted to a vector representation by Ollama</span></li>
            <li className="flex gap-2"><span className="font-bold text-blue-600 flex-shrink-0">4.</span><span><strong>Image Extraction:</strong> All images are extracted for website integration</span></li>
            <li className="flex gap-2"><span className="font-bold text-blue-600 flex-shrink-0">5.</span><span><strong>Generation:</strong> When generating your website, relevant content is automatically retrieved</span></li>
          </ul>
        </div>
      )}

      <div className="flex gap-4">
        <button onClick={goToPreviousStep} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition">
          ← Back
        </button>
        {success && (
          <button onClick={goToNextStep} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
            Continue to Design →
          </button>
        )}
      </div>
    </div>
  );
};
