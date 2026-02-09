'use client';

import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import PromptInput from '../PromptInput';
import Header from '../Header';
import { useWizard } from '@/store/WizardContext';

export default function StepPrompt() {
  const { prompt, setPrompt, goToNextStep } = useWizard();

  const handleNext = () => {
    if (!prompt.trim()) {
      alert('Please describe your website');
      return;
    }
    goToNextStep();
  };

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black flex items-center justify-center px-4 pt-24">
      <div className="w-full max-w-3xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="text-4xl">
              <Sparkles className="w-10 h-10 text-blue-500" />
            </div>
          </div>
          <h1 className="text-5xl font-bold text-white mb-4">
            Build Your Website with Web Forge AI
          </h1>
          <p className="text-xl text-gray-400">
            Step 1 of 4: Tell us about your website vision
          </p>
        </div>

        {/* Content */}
        <div className="bg-gray-800/50 backdrop-blur border border-gray-700 rounded-lg p-8 mb-8">
          <div className="mb-6">
            <label className="block text-sm font-semibold text-white mb-3">
              Describe Your Website
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Example: Create a modern portfolio website with a dark theme, showcase my projects, and include a contact form..."
              className="w-full h-64 px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none resize-none"
            />
          </div>

          <div className="text-sm text-gray-400 mb-6">
            Be as detailed as possible about what you want: style, features, content, layout, etc.
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <div></div>
          <button
            onClick={handleNext}
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
