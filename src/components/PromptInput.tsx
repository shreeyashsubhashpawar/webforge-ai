'use client';

import { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
}

export default function PromptInput({
  value,
  onChange,
  onGenerate,
  isGenerating,
}: PromptInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      onGenerate();
    }
  };

  const placeholderExamples = [
    "Create a modern portfolio website for a photographer with a gallery and contact form",
    "Build a landing page for a SaaS product with pricing tiers and testimonials",
    "Design a blog website with dark mode and article categories",
    "Generate an e-commerce site for handmade jewelry with product showcase",
  ];

  return (
    <div className="space-y-4">
      <div
        className={`border-2 rounded-lg transition-all ${
          isFocused
            ? 'border-blue-500 shadow-lg'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder={placeholderExamples[0]}
          disabled={isGenerating}
          rows={4}
          className="w-full px-4 py-3 rounded-lg focus:outline-none resize-none disabled:bg-gray-50 disabled:text-gray-500"
        />
      </div>

      <div className="flex justify-between items-center">
        <div className="text-xs text-gray-500">
          Press <kbd className="px-2 py-1 bg-gray-100 rounded">Cmd/Ctrl + Enter</kbd> to generate
        </div>
        <button
          onClick={onGenerate}
          disabled={isGenerating || !value.trim()}
          className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center space-x-2 font-semibold shadow-lg hover:shadow-xl"
        >
          {isGenerating ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              <span>Generating...</span>
            </>
          ) : (
            <>
              <Send size={20} />
              <span>Generate Website</span>
            </>
          )}
        </button>
      </div>

      {/* Quick Examples */}
      <div className="pt-2">
        <p className="text-xs text-gray-500 mb-2">Try these examples:</p>
        <div className="flex flex-wrap gap-2">
          {placeholderExamples.slice(1).map((example, idx) => (
            <button
              key={idx}
              onClick={() => onChange(example)}
              disabled={isGenerating}
              className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-full text-gray-700 transition-colors disabled:opacity-50"
            >
              {example.split(' ').slice(0, 5).join(' ')}...
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
