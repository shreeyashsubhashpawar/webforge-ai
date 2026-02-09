'use client';

import React from 'react';
import { Sparkles } from 'lucide-react';

export default function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 bg-gray-900/95 backdrop-blur border-b border-gray-800 z-50">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
        <div className="text-2xl">
          <Sparkles className="w-8 h-8 text-blue-500" />
        </div>
        <div>
          <h1 className="text-white font-bold text-lg">WebForge AI</h1>
          <p className="text-gray-400 text-xs">Intelligent Website Generator</p>
        </div>
      </div>
    </header>
  );
}
