'use client';

import React, { useCallback, useState } from 'react';
import { Upload, X, ArrowLeft, ArrowRight, FileText, Loader2 } from 'lucide-react';
import Header from '../Header';
import { useWizard } from '@/store/WizardContext';
import { UploadedDocument } from '@/types';

export default function StepUpload() {
  const { uploadedFiles, addUploadedFile, removeUploadedFile, goToNextStep, goToPreviousStep } =
    useWizard();
  const [isReading, setIsReading] = useState(false);

  const handleFileUpload = useCallback(
    (files: FileList) => {
      const fileArray = Array.from(files);
      if (fileArray.length === 0) return;

      setIsReading(true);
      let completed = 0;

      fileArray.forEach((file, index) => {
        const extension = file.name.split('.').pop()?.toLowerCase() || 'txt';

        let fileType: 'pdf' | 'docx' | 'txt' | 'image' = 'txt';
        if (extension === 'pdf') fileType = 'pdf';
        else if (extension === 'docx' || extension === 'doc') fileType = 'docx';
        else if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(extension)) fileType = 'image';

        const reader = new FileReader();

        reader.onload = () => {
          const dataUrl = reader.result as string;

          if (dataUrl && typeof dataUrl === 'string' && dataUrl.startsWith('data:')) {
            const uploadedDoc: UploadedDocument = {
              id: `${Date.now()}-${index}`,
              name: file.name,
              type: fileType,
              size: file.size,
              content: dataUrl,
              uploadedAt: new Date(),
            };
            console.log('[StepUpload] File ready:', file.name, 'content length:', dataUrl.length);
            addUploadedFile(uploadedDoc);
          } else {
            console.error('[StepUpload] Invalid data URL for:', file.name);
          }

          completed++;
          if (completed === fileArray.length) {
            setIsReading(false);
          }
        };

        reader.onerror = () => {
          console.error('[StepUpload] FileReader error for:', file.name, reader.error);
          completed++;
          if (completed === fileArray.length) setIsReading(false);
        };

        reader.readAsDataURL(file);
      });
    },
    [addUploadedFile]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add('bg-blue-500/20');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('bg-blue-500/20');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-blue-500/20');
    handleFileUpload(e.dataTransfer.files);
  };

  const hasPdf = uploadedFiles.some((f) => f.type === 'pdf');

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black flex items-center justify-center px-4 pt-24">
        <div className="w-full max-w-3xl">
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-white mb-2">Add Context Files</h1>
            <p className="text-xl text-gray-400">Step 2 of 4: Upload files about your website (optional)</p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur border border-gray-700 rounded-lg p-8 mb-8">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className="border-2 border-dashed border-gray-600 rounded-lg p-12 text-center mb-8 transition-colors cursor-pointer hover:border-blue-500"
            >
              {isReading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
                  <p className="text-white font-semibold">Reading file...</p>
                </div>
              ) : (
                <>
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-white text-lg font-semibold mb-2">Drag files here or click to upload</p>
                  <p className="text-gray-400 mb-4">Supported: PDF, DOCX, TXT, Images</p>
                  <input
                    type="file"
                    multiple
                    onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                    className="hidden"
                    id="file-input"
                    accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp"
                  />
                  <label htmlFor="file-input" className="inline-block">
                    <span className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg transition-colors cursor-pointer">
                      Browse Files
                    </span>
                  </label>
                </>
              )}
            </div>

            {uploadedFiles.length > 0 && (
              <div className="mb-8">
                <h3 className="text-white font-semibold mb-4">Uploaded Files ({uploadedFiles.length})</h3>
                <div className="space-y-2">
                  {uploadedFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between bg-gray-900/50 p-4 rounded-lg border border-gray-700"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-blue-400" />
                        <div>
                          <p className="text-white font-medium">{file.name}</p>
                          <p className="text-gray-400 text-sm">
                            {(file.size / 1024).toFixed(2)} KB
                            {file.content ? (
                              <span className="text-green-400 ml-2">✓ Ready</span>
                            ) : (
                              <span className="text-yellow-400 ml-2">⏳ Reading...</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeUploadedFile(file.id)}
                        className="text-gray-400 hover:text-red-400 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-sm text-gray-400">
              These files will be used to provide context to the AI for more accurate website generation.
            </p>
          </div>

          <div className="flex justify-between items-center">
            <button
              onClick={goToPreviousStep}
              className="flex items-center gap-2 text-gray-400 hover:text-white font-semibold px-8 py-3 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
            <button
              onClick={goToNextStep}
              disabled={isReading || (hasPdf && uploadedFiles.find(f => f.type === 'pdf')?.content === undefined)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-8 py-3 rounded-lg transition-colors"
            >
              {isReading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Reading file...
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
