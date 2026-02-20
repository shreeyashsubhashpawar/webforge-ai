'use client';

import React, { useEffect, useState } from 'react';
import Header from '../Header';
import GenerationResult from '../GenerationResult';
import GenerationProgress from '../GenerationProgress';
import { useWizard } from '@/store/WizardContext';
import { GenerationResponse } from '@/types';
import { AlertCircle, ArrowLeft } from 'lucide-react';

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
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">Your Generated Website</h1>
            <p className="text-gray-400">Step 4 of 4: Review and download your website</p>
          </div>

          {generationResult.code && (
            <GenerationResult 
              code={generationResult.code} 
              quality={generationResult.quality} 
              onBack={goToPreviousStep}
              onReset={reset}
            />
          )}

          <div className="flex gap-4 mt-8">
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
