'use client';

import { CheckCircle, AlertTriangle, Info, TrendingUp } from 'lucide-react';
import { QualityScore } from '@/types';

interface QualityReportProps {
  quality: QualityScore;
}

export default function QualityReport({ quality }: QualityReportProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreGradient = (score: number) => {
    if (score >= 80) return 'from-green-500 to-emerald-500';
    if (score >= 60) return 'from-yellow-500 to-orange-500';
    return 'from-red-500 to-pink-500';
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="text-red-600" size={16} />;
      case 'warning':
        return <AlertTriangle className="text-yellow-600" size={16} />;
      default:
        return <Info className="text-blue-600" size={16} />;
    }
  };

  const getSeverityBg = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Overall Score */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold flex items-center">
            <CheckCircle className="mr-2" size={24} />
            Quality Score
          </h3>
          <div className={`text-5xl font-bold ${getScoreColor(quality.overall)}`}>
            <span className="text-white">{quality.overall}</span>
            <span className="text-2xl text-white/80">/100</span>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="h-3 bg-white/20 rounded-full overflow-hidden">
          <div
            className={`h-full bg-white rounded-full transition-all duration-1000`}
            style={{ width: `${quality.overall}%` }}
          />
        </div>
      </div>

      {/* Breakdown Scores */}
      <div className="p-6 space-y-4">
        <h4 className="font-semibold text-gray-900 mb-3">Quality Breakdown</h4>
        
        {Object.entries(quality.breakdown).map(([key, value]) => (
          <div key={key} className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700 capitalize">
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </span>
              <span className={`text-sm font-bold ${getScoreColor(value)}`}>
                {value}/100
              </span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${getScoreGradient(value)} rounded-full transition-all duration-1000`}
                style={{ width: `${value}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Issues */}
      {quality.issues.length > 0 && (
        <div className="border-t border-gray-200 p-6">
          <h4 className="font-semibold text-gray-900 mb-4">
            Issues Found ({quality.issues.length})
          </h4>
          <div className="space-y-3">
            {quality.issues.map((issue, idx) => (
              <div
                key={idx}
                className={`border rounded-lg p-4 ${getSeverityBg(issue.severity)}`}
              >
                <div className="flex items-start space-x-3">
                  {getSeverityIcon(issue.severity)}
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-900">
                        {issue.message}
                      </p>
                      <span className="text-xs font-medium text-gray-600 uppercase px-2 py-1 bg-white rounded">
                        {issue.category}
                      </span>
                    </div>
                    {issue.suggestion && (
                      <p className="text-xs text-gray-700">
                        💡 <strong>Suggestion:</strong> {issue.suggestion}
                      </p>
                    )}
                    {issue.line && (
                      <p className="text-xs text-gray-600">Line {issue.line}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions */}
      {quality.suggestions.length > 0 && (
        <div className="border-t border-gray-200 p-6 bg-blue-50">
          <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
            <TrendingUp className="mr-2 text-blue-600" size={18} />
            Improvement Suggestions
          </h4>
          <ul className="space-y-2">
            {quality.suggestions.map((suggestion, idx) => (
              <li key={idx} className="text-sm text-gray-700 flex items-start">
                <span className="text-blue-600 mr-2">✓</span>
                <span>{suggestion}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Explanation */}
      {quality.explanation && (
        <div className="border-t border-gray-200 p-6">
          <h4 className="font-semibold text-gray-900 mb-2">Analysis</h4>
          <p className="text-sm text-gray-700 leading-relaxed">
            {quality.explanation}
          </p>
        </div>
      )}
    </div>
  );
}
