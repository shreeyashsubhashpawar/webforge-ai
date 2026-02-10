'use client';

import React, { createContext, useContext, useState } from 'react';
import { UploadedDocument, GenerationResponse } from '@/types';

export type WizardStep = 'prompt' | 'design' | 'preview';

interface DesignChoices {
  style: 'simple' | 'techie' | 'corporate' | 'creative' | 'playful';
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}

interface WizardContextType {
  currentStep: WizardStep;
  prompt: string;
  uploadedFiles: UploadedDocument[];
  designChoices: DesignChoices | null;
  generationResult: GenerationResponse | null;
  isGenerating: boolean;

  // Actions
  setCurrentStep: (step: WizardStep) => void;
  setPrompt: (prompt: string) => void;
  setUploadedFiles: (files: UploadedDocument[]) => void;
  addUploadedFile: (file: UploadedDocument) => void;
  removeUploadedFile: (fileId: string) => void;
  setDesignChoices: (choices: DesignChoices) => void;
  setGenerationResult: (result: GenerationResponse | null) => void;
  setIsGenerating: (isGenerating: boolean) => void;
  goToNextStep: () => void;
  goToPreviousStep: () => void;
  reset: () => void;
}

const WizardContext = createContext<WizardContextType | undefined>(undefined);

export const WizardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentStep, setCurrentStep] = useState<WizardStep>('prompt');
  const [prompt, setPrompt] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedDocument[]>([]);
  const [designChoices, setDesignChoices] = useState<DesignChoices | null>(null);
  const [generationResult, setGenerationResult] = useState<GenerationResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const stepOrder: WizardStep[] = ['prompt', 'design', 'preview'];
  const currentStepIndex = stepOrder.indexOf(currentStep);

  const goToNextStep = () => {
    if (currentStepIndex < stepOrder.length - 1) {
      setCurrentStep(stepOrder[currentStepIndex + 1]);
    }
  };

  const goToPreviousStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStep(stepOrder[currentStepIndex - 1]);
    }
  };

  const addUploadedFile = (file: UploadedDocument) => {
    setUploadedFiles([...uploadedFiles, file]);
  };

  const removeUploadedFile = (fileId: string) => {
    setUploadedFiles(uploadedFiles.filter(f => f.id !== fileId));
  };

  const reset = () => {
    setCurrentStep('prompt');
    setPrompt('');
    setUploadedFiles([]);
    setDesignChoices(null);
    setGenerationResult(null);
    setIsGenerating(false);
  };

  const value: WizardContextType = {
    currentStep,
    prompt,
    uploadedFiles,
    designChoices,
    generationResult,
    isGenerating,

    setCurrentStep,
    setPrompt,
    setUploadedFiles,
    addUploadedFile,
    removeUploadedFile,
    setDesignChoices,
    setGenerationResult,
    setIsGenerating,
    goToNextStep,
    goToPreviousStep,
    reset,
  };

  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>;
};

export const useWizard = () => {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error('useWizard must be used within a WizardProvider');
  }
  return context;
};
