'use client';

import { Loader2, Sparkles, Palette, Code, CheckCircle } from 'lucide-react';

interface GenerationProgressProps {
  currentStep: string;
}

export default function GenerationProgress({ currentStep }: GenerationProgressProps) {
  const steps = [
    { name: 'Intent Analysis', icon: Sparkles, color: 'text-blue-600' },
    { name: 'Design System', icon: Palette, color: 'text-purple-600' },
    { name: 'Code Generation', icon: Code, color: 'text-green-600' },
    { name: 'Quality Check', icon: CheckCircle, color: 'text-orange-600' },
  ];

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center">
          <Loader2 className="mr-2 text-blue-600 animate-spin" size={20} />
          Generating Your Website
        </h3>
      </div>

      {/* Progress Steps */}
      <div className="space-y-3">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          return (
            <div
              key={idx}
              className="flex items-center space-x-3 p-3 rounded-lg bg-gray-50"
            >
              <div className={`${step.color}`}>
                <Icon size={20} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{step.name}</p>
              </div>
              <div className="animate-pulse">
                <div className="w-2 h-2 bg-blue-600 rounded-full" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Current Status */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-sm text-gray-600 text-center">
          {currentStep || 'Processing your request...'}
        </p>
      </div>

      {/* Progress Bar */}
      <div className="mt-4">
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-600 to-purple-600 rounded-full animate-pulse" />
        </div>
      </div>
    </div>
  );
}
