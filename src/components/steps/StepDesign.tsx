'use client';

import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import Header from '../Header';
import RAGVisualization from '../RAGVisualization';
import { useWizard } from '@/store/WizardContext';

interface DesignStyle {
  name: string;
  id: 'simple' | 'techie' | 'corporate' | 'creative' | 'playful';
  description: string;
  preview: string;
}

interface ColorPalette {
  name: string;
  id: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

const designStyles: DesignStyle[] = [
  {
    name: 'Simple',
    id: 'simple',
    description: 'Clean and minimalist design',
    preview: 'Light colors, minimal elements, focus on content',
  },
  {
    name: 'Techie',
    id: 'techie',
    description: 'Modern tech-forward aesthetic',
    preview: 'Dark theme, bold colors, cutting-edge feel',
  },
  {
    name: 'Corporate',
    id: 'corporate',
    description: 'Professional business look',
    preview: 'Conservative colors, formal structure',
  },
  {
    name: 'Creative',
    id: 'creative',
    description: 'Artistic and expressive design',
    preview: 'Vibrant colors, unique layouts',
  },
  {
    name: 'Playful',
    id: 'playful',
    description: 'Fun and engaging style',
    preview: 'Bright colors, animated elements',
  },
];

const colorPalettes: ColorPalette[] = [
  {
    name: 'Ocean Blue',
    id: 'ocean',
    colors: {
      primary: '#0066CC',
      secondary: '#003D99',
      accent: '#00B4FF',
    },
  },
  {
    name: 'Sunset Orange',
    id: 'sunset',
    colors: {
      primary: '#FF8B3D',
      secondary: '#FF6B1A',
      accent: '#FFD700',
    },
  },
  {
    name: 'Forest Green',
    id: 'forest',
    colors: {
      primary: '#2D6A4F',
      secondary: '#1B4332',
      accent: '#52B788',
    },
  },
  {
    name: 'Purple Royale',
    id: 'purple',
    colors: {
      primary: '#7209B7',
      secondary: '#4C00A8',
      accent: '#B737F7',
    },
  },
  {
    name: 'Minimal Gray',
    id: 'gray',
    colors: {
      primary: '#333333',
      secondary: '#666666',
      accent: '#999999',
    },
  },
  {
    name: 'Crimson Blaze',
    id: 'crimson',
    colors: {
      primary: '#DC143C',
      secondary: '#8B0000',
      accent: '#FF1744',
    },
  },
];

export default function StepDesign() {
  const { designChoices, setDesignChoices, goToNextStep, goToPreviousStep, uploadedFiles } = useWizard();
  const [selectedStyle, setSelectedStyle] = useState<string>(designChoices?.style || 'simple');
  const [selectedPalette, setSelectedPalette] = useState<string>(
    designChoices ? colorPalettes.findIndex((p) => p.colors.primary === designChoices.primaryColor)?.toString() : '0'
  );
  const [activeTab, setActiveTab] = useState<'design' | 'rag'>('design');

  const handleNext = () => {
    const palette = colorPalettes[parseInt(selectedPalette)];
    setDesignChoices({
      style: selectedStyle as any,
      primaryColor: palette.colors.primary,
      secondaryColor: palette.colors.secondary,
      accentColor: palette.colors.accent,
    });
    goToNextStep();
  };

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black px-4 py-8 pt-24">
      <div className="w-full max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-2">Choose Your Design</h1>
          <p className="text-xl text-gray-400">Step 2 of 3: Select style and color palette</p>
        </div>

        {/* Tabs */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-t-lg flex gap-4 p-4 mb-0">
          <button
            onClick={() => setActiveTab('design')}
            className={`font-semibold pb-2 px-4 border-b-2 transition-colors ${
              activeTab === 'design'
                ? 'text-white border-blue-500'
                : 'text-gray-400 border-transparent'
            }`}
          >
            Design Choices
          </button>
          {uploadedFiles.length > 0 && (
            <button
              onClick={() => setActiveTab('rag')}
              className={`font-semibold pb-2 px-4 border-b-2 transition-colors ${
                activeTab === 'rag'
                  ? 'text-white border-blue-500'
                  : 'text-gray-400 border-transparent'
              }`}
            >
              Document Processing
            </button>
          )}
        </div>

        {/* Design Tab */}
        {activeTab === 'design' && (
          <div className="bg-gray-800/50 border border-gray-700 border-t-0 rounded-b-lg p-8 mb-8">
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-white mb-6">Design Style</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {designStyles.map((style) => (
                  <div
                    key={style.id}
                    onClick={() => setSelectedStyle(style.id)}
                    className={`p-6 rounded-lg cursor-pointer transition-all transform hover:scale-105 ${
                      selectedStyle === style.id
                        ? 'bg-blue-600 border-2 border-blue-400'
                        : 'bg-gray-800 border-2 border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-white font-semibold text-lg">{style.name}</h3>
                      {selectedStyle === style.id && <Check className="w-5 h-5 text-white" />}
                    </div>
                    <p className="text-gray-300 text-sm mb-2">{style.description}</p>
                    <p className="text-gray-400 text-xs">{style.preview}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Color Palettes */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-white mb-6">Color Palette</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {colorPalettes.map((palette, index) => (
                  <div
                    key={palette.id}
                    onClick={() => setSelectedPalette(index.toString())}
                    className={`p-6 rounded-lg cursor-pointer transition-all transform hover:scale-105 border-2 ${
                      parseInt(selectedPalette) === index
                        ? 'border-blue-400'
                        : 'border-gray-700 hover:border-gray-600'
                    } bg-gray-900/50`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="text-white font-semibold">{palette.name}</h3>
                      {parseInt(selectedPalette) === index && <Check className="w-5 h-5 text-blue-400" />}
                    </div>
                    <div className="flex gap-3 mb-3">
                      <div
                        className="w-16 h-16 rounded-lg border-2 border-gray-600"
                        style={{ backgroundColor: palette.colors.primary }}
                        title="Primary"
                      />
                      <div
                        className="w-16 h-16 rounded-lg border-2 border-gray-600"
                        style={{ backgroundColor: palette.colors.secondary }}
                        title="Secondary"
                      />
                      <div
                        className="w-16 h-16 rounded-lg border-2 border-gray-600"
                        style={{ backgroundColor: palette.colors.accent }}
                        title="Accent"
                      />
                    </div>
                    <p className="text-gray-400 text-xs">
                      Primary • Secondary • Accent
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* RAG Tab */}
        {activeTab === 'rag' && (
          <div className="bg-gray-800/50 border border-gray-700 border-t-0 rounded-b-lg p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-6">Document Processing & RAG Analysis</h2>
            <p className="text-gray-400 mb-6">
              Your uploaded documents are being processed for Retrieval-Augmented Generation (RAG). This allows Claude to reference your specific content when generating the website.
            </p>
            <RAGVisualization documents={uploadedFiles} isProcessing={false} />
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
            onClick={handleNext}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-lg transition-colors"
          >
            Generate Website
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
      </div>
    </>
  );
}
