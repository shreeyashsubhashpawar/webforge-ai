'use client';

import React, { useCallback } from 'react';
import { Upload, X, ArrowLeft, ArrowRight, FileText } from 'lucide-react';
import Header from '../Header';
import { useWizard } from '@/store/WizardContext';
import { UploadedDocument } from '@/types';

export default function StepUpload() {
  const { uploadedFiles, addUploadedFile, removeUploadedFile, goToNextStep, goToPreviousStep } =
    useWizard();

  const handleFileUpload = useCallback(
    async (files: FileList) => {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const reader = new FileReader();

        reader.onload = async () => {
          const uploadedDoc: UploadedDocument = {
            id: Date.now().toString() + i,
            name: file.name,
            type: (file.name.split('.').pop()?.toLowerCase() as any) || 'txt',
            size: file.size,
            content: reader.result as string,
            uploadedAt: new Date(),
          };

          addUploadedFile(uploadedDoc);
        };

        reader.readAsText(file);
      }
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

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black flex items-center justify-center px-4 pt-24">
      <div className="w-full max-w-3xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-2">Add Context Files</h1>
          <p className="text-xl text-gray-400">Step 2 of 4: Upload files about your website (optional)</p>
        </div>

        {/* Content */}
        <div className="bg-gray-800/50 backdrop-blur border border-gray-700 rounded-lg p-8 mb-8">
          {/* Upload Area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className="border-2 border-dashed border-gray-600 rounded-lg p-12 text-center mb-8 transition-colors cursor-pointer hover:border-blue-500"
          >
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
              <button
                onClick={() => document.getElementById('file-input')?.click()}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg transition-colors"
              >
                Browse Files
              </button>
            </label>
          </div>

          {/* Uploaded Files */}
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

        {/* Navigation */}
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
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-lg transition-colors"
          >
            Next
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
      </div>
    </>
  );
}
