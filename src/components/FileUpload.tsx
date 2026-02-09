'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, X, Check, AlertCircle } from 'lucide-react';
import { UploadedDocument } from '@/types';

interface FileUploadProps {
  onFilesUploaded: (files: UploadedDocument[]) => void;
  disabled?: boolean;
}

export default function FileUpload({ onFilesUploaded, disabled }: FileUploadProps) {
  const [files, setFiles] = useState<UploadedDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      setUploading(true);
      setError(null);

      try {
        const formData = new FormData();
        acceptedFiles.forEach((file) => {
          formData.append('files', file);
        });

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Upload failed');
        }

        const result = await response.json();
        
        if (result.success && result.files) {
          const uploadedDocs: UploadedDocument[] = result.files.map((file: any) => ({
            id: file.id,
            name: file.name,
            type: file.type.includes('pdf') ? 'pdf' : 
                  file.type.includes('word') ? 'docx' : 'txt',
            size: file.size,
            uploadedAt: new Date(file.uploadedAt),
          }));

          setFiles((prev) => [...prev, ...uploadedDocs]);
          onFilesUploaded([...files, ...uploadedDocs]);
        }
      } catch (err) {
        console.error('Upload error:', err);
        setError('Failed to upload files. Please try again.');
      } finally {
        setUploading(false);
      }
    },
    [files, onFilesUploaded]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    disabled: disabled || uploading,
  });

  const removeFile = (id: string) => {
    const updated = files.filter((f) => f.id !== id);
    setFiles(updated);
    onFilesUploaded(updated);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
          isDragActive
            ? 'border-blue-500 bg-blue-50'
            : disabled
            ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
            : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
        }`}
      >
        <input {...getInputProps()} />
        
        {uploading ? (
          <div className="space-y-2">
            <div className="animate-spin mx-auto w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full" />
            <p className="text-gray-600">Uploading files...</p>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="mx-auto text-gray-400" size={40} />
            {isDragActive ? (
              <p className="text-blue-600 font-semibold">Drop files here...</p>
            ) : (
              <>
                <p className="text-gray-700 font-medium">
                  Drop files here or click to browse
                </p>
                <p className="text-xs text-gray-500">
                  PDF, DOCX, or TXT files up to 10MB
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg">
          <AlertCircle size={16} />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Uploaded Files List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-700">
            Uploaded Files ({files.length})
          </h4>
          <div className="space-y-2">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200"
              >
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <div className="bg-blue-100 p-2 rounded">
                    <File className="text-blue-600" size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(file.size)} • {file.type.toUpperCase()}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Check className="text-green-600" size={16} />
                    <button
                      onClick={() => removeFile(file.id)}
                      disabled={disabled}
                      className="text-red-600 hover:text-red-700 disabled:opacity-50 p-1"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
