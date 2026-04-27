'use client';

import { useWizard } from '@/store/WizardContext';
import StepPrompt from '@/components/steps/StepPrompt';
import StepUpload from '@/components/steps/StepUpload';
import { StepRAG } from '@/components/steps/StepRAG';
import StepDesign from '@/components/steps/StepDesign';
import StepPreview from '@/components/steps/StepPreview';

export default function Home() {
  const { currentStep } = useWizard();

  return (
    <>
      {currentStep === 'prompt' && <StepPrompt />}
      {currentStep === 'upload' && <StepUpload />}
      {currentStep === 'rag' && <StepRAG />}
      {currentStep === 'design' && <StepDesign />}
      {currentStep === 'preview' && <StepPreview />}
    </>
  );
}
