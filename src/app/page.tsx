'use client';

import { useWizard } from '@/store/WizardContext';
import StepPrompt from '@/components/steps/StepPrompt';
import StepDesign from '@/components/steps/StepDesign';
import StepPreview from '@/components/steps/StepPreview';

export default function Home() {
  const { currentStep } = useWizard();

  return (
    <>
      {currentStep === 'prompt' && <StepPrompt />}
      {currentStep === 'design' && <StepDesign />}
      {currentStep === 'preview' && <StepPreview />}
    </>
  );
}
