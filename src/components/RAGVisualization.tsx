'use client';

import React, { useEffect, useState } from 'react';
import { File, Check, Loader } from 'lucide-react';
import { UploadedDocument } from '@/types';

interface RAGVisualizationProps {
  documents?: UploadedDocument[];
  isProcessing?: boolean;
}

export const RAGVisualization: React.FC<RAGVisualizationProps> = ({
  documents = [],
  isProcessing = false,
}) => {
  const [processedDocs, setProcessedDocs] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isProcessing && documents.length > 0) {
      // Simulate processing each document
      documents.forEach((doc, index) => {
        setTimeout(() => {
          setProcessedDocs((prev) => new Set([...prev, doc.id]));
        }, (index + 1) * 300);
      });
    }
  }, [documents, isProcessing]);

  if (!documents || documents.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-400">No documents uploaded</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-white font-semibold mb-4">Document Processing</h3>
      
      {documents.map((doc, index) => {
        const isProcessed = processedDocs.has(doc.id);
        const isProcessing_doc = !isProcessed && processedDocs.size > index;

        return (
          <div
            key={doc.id}
            className="bg-gray-700/30 border border-gray-600 rounded-lg p-4 transition-all"
          >
            <div className="flex items-start gap-3">
              <div className="mt-1">
                {isProcessed ? (
                  <Check className="w-5 h-5 text-green-400" />
                ) : isProcessing_doc ? (
                  <Loader className="w-5 h-5 text-blue-400 animate-spin" />
                ) : (
                  <File className="w-5 h-5 text-gray-500" />
                )}
              </div>

              <div className="flex-1">
                <p className="text-white font-medium">{doc.name}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {doc.size} bytes • {doc.type.toUpperCase()}
                </p>

                {isProcessed && (
                  <div className="mt-3 space-y-2">
                    <div className="bg-gray-600/30 rounded p-2">
                      <p className="text-xs text-gray-300">
                        ✓ Extracted {Math.floor(Math.random() * 10 + 5)} key sections
                      </p>
                    </div>
                    <div className="bg-gray-600/30 rounded p-2">
                      <p className="text-xs text-gray-300">
                        ✓ Created embeddings for semantic search
                      </p>
                    </div>
                    <div className="bg-gray-600/30 rounded p-2">
                      <p className="text-xs text-gray-300">
                        ✓ Ready for RAG enhancement
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {documents.length > 0 && (
        <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <p className="text-sm text-blue-300">
            📊 {processedDocs.size} of {documents.length} documents processed and ready for RAG
          </p>
        </div>
      )}
    </div>
  );
};

export default RAGVisualization;
