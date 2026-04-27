'use client';

import React, { useEffect, useState } from 'react';
import Header from '../Header';
import GenerationResult from '../GenerationResult';
import GenerationProgress from '../GenerationProgress';
import { useWizard } from '@/store/WizardContext';
import { GenerationResponse } from '@/types';
import { AlertCircle, ArrowLeft } from 'lucide-react';

// Maps server-side console log prefixes → human-readable progress messages
const STEP_MESSAGES: { match: string; label: string }[] = [
  { match: 'Step 1', label: '📚 Retrieving RAG context from your document...' },
  { match: 'Step 2', label: '🎯 Analysing your requirements...' },
  { match: 'Step 3', label: '🎨 Creating design system...' },
  { match: 'Step 4', label: '💻 Generating website code with Claude AI...' },
  { match: 'Step 5', label: '✅ Evaluating code quality...' },
  { match: 'Step 6', label: '📦 Preparing your website...' },
];

export default function StepPreview() {
  const {
    prompt,
    uploadedFiles,
    ragContextId,   // ← the missing piece
    designChoices,
    generationResult,
    setGenerationResult,
    isGenerating,
    setIsGenerating,
    goToPreviousStep,
    reset,
  } = useWizard();

  const [currentStep, setCurrentStep] = useState('Preparing generation...');
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!generationResult && !isGenerating) {
      generateWebsite();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Animate through step labels while waiting for the API
  useEffect(() => {
    if (!isGenerating) return;
    const interval = setInterval(() => {
      setStepIndex((prev) => {
        const next = prev + 1;
        if (next < STEP_MESSAGES.length) {
          setCurrentStep(STEP_MESSAGES[next].label);
          return next;
        }
        return prev;
      });
    }, 18000); // ~18s per step (total ~118s observed)
    return () => clearInterval(interval);
  }, [isGenerating]);

  const generateWebsite = async () => {
    setIsGenerating(true);
    setStepIndex(0);
    setCurrentStep(STEP_MESSAGES[0].label);
    setGenerationResult(null);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          documents: uploadedFiles,
          designPreferences: designChoices,
          // ✅ Pass ragContextId so the server can retrieve and inject PDF content
          ragContextId: ragContextId ?? undefined,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Generation failed (${response.status})`);
      }

      const result: GenerationResponse = await response.json();
      setGenerationResult(result);
      setCurrentStep('');
    } catch (error) {
      console.error('[StepPreview] Generation error:', error);
      setCurrentStep('');
      alert(
        error instanceof Error
          ? error.message
          : 'Failed to generate website. Please check your API key and try again.'
      );
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
            <h1 className="text-4xl font-bold text-white mb-2 text-center">
              Generating Your Website
            </h1>
            {ragContextId && (
              <p className="text-green-400 text-center text-sm mb-2">
                ✓ Using content from your uploaded document
              </p>
            )}
            <p className="text-gray-400 text-center mb-8">
              Step 4 of 4: AI is building your website — this takes ~2 minutes
            </p>
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
            {generationResult.augmentedPrompt && (
              <div className="mt-3 inline-flex items-center gap-2 bg-green-900/40 border border-green-700 text-green-300 text-sm px-3 py-1.5 rounded-full">
                ✓ Generated using content from your uploaded PDF
              </div>
            )}
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
              onClick={() => { reset(); window.location.href = '/'; }}
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
