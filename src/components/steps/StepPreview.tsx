'use client';

import React, { useEffect, useState } from 'react';
import { ArrowLeft, Download, Copy, Check, AlertCircle } from 'lucide-react';
import Header from '../Header';
import { useWizard } from '@/store/WizardContext';
import CodePreview from '../CodePreview';
import GenerationProgress from '../GenerationProgress';
import QualityReport from '../QualityReport';
import { GenerationResponse } from '@/types';

export default function StepPreview() {
  const {
    prompt,
    uploadedFiles,
    designChoices,
    generationResult,
    setGenerationResult,
    isGenerating,
    setIsGenerating,
    goToPreviousStep,
    reset,
  } = useWizard();

  const [currentStep, setCurrentStep] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    // Auto-generate on mount
    if (!generationResult && !isGenerating) {
      generateWebsite();
    }
  }, []);

  const generateWebsite = async () => {
    setIsGenerating(true);
    setCurrentStep('Analyzing your requirements...');
    setGenerationResult(null);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          documents: uploadedFiles,
          designPreferences: designChoices,
        }),
      });

      if (!response.ok) {
        throw new Error('Generation failed');
      }

      const result: GenerationResponse = await response.json();
      setGenerationResult(result);
      setCurrentStep('');
    } catch (error) {
      console.error('Error:', error);
      setCurrentStep('');
      alert('Failed to generate website. Please check your API key and try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyCode = () => {
    if (generationResult?.code?.html) {
      navigator.clipboard.writeText(generationResult.code.html);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleDownload = () => {
    if (!generationResult?.code) return;

    const code = generationResult.code;
    const content = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Generated Website</title>
  <style>
${code.css}
  </style>
</head>
<body>
${code.html}
  <script>
${code.javascript}
  </script>
</body>
</html>`;

    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'website.html';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isGenerating) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black flex items-center justify-center px-4 pt-24">
        <div className="w-full max-w-4xl">
          <h1 className="text-4xl font-bold text-white mb-4 text-center">
            Generating Your Website
          </h1>
          <p className="text-gray-400 text-center mb-8">Step 4 of 4: AI is building your website...</p>
          <GenerationProgress currentStep={currentStep} />
        </div>
      </div>
      </>
    );
  }

  if (!generationResult) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black flex items-center justify-center px-4 pt-24">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-white text-lg mb-4">Failed to generate website</p>
          <button
            onClick={generateWebsite}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black px-4 py-8 pt-24">
      <div className="w-full max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Your Generated Website</h1>
          <p className="text-gray-400">Step 4 of 4: Review and download your website</p>
        </div>

        {/* Tabs */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-t-lg flex gap-4 p-4 mb-0">
          <button className="text-white font-semibold border-b-2 border-blue-500 pb-2 px-4">
            Preview
          </button>
          <button className="text-gray-400 font-semibold px-4">Code</button>
          {generationResult.quality && (
            <button className="text-gray-400 font-semibold px-4">Quality Report</button>
          )}
        </div>

        {/* Preview */}
        <div className="bg-gray-800/50 border border-gray-700 border-t-0 rounded-b-lg p-6 mb-8">
          {generationResult.code ? (
            <>
              <CodePreview code={generationResult.code} />
              <div className="mt-6 flex gap-4">
                <button
                  onClick={handleCopyCode}
                  className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
                >
                  {copiedCode ? (
                    <>
                      <Check className="w-5 h-5" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-5 h-5" />
                      Copy Code
                    </>
                  )}
                </button>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
                >
                  <Download className="w-5 h-5" />
                  Download HTML
                </button>
              </div>
            </>
          ) : (
            <p className="text-gray-400">No code generated</p>
          )}
        </div>

        {/* Quality Report */}
        {generationResult.quality && (
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 mb-8">
            <QualityReport quality={generationResult.quality} />
          </div>
        )}

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
            onClick={() => {
              reset();
              window.location.href = '/';
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-lg transition-colors"
          >
            Create New Website
          </button>
        </div>
      </div>
      </div>
    </>
  );
}
