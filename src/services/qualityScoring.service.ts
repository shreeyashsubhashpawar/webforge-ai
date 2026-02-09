import { claudeService } from './claude.service';
import { GeneratedCode, QualityScore, QualityIssue } from '@/types';

const QUALITY_EVALUATION_PROMPT = `You are an expert web development quality assurance specialist. Evaluate the generated website code for quality, best practices, and potential issues.

Analyze the code across these dimensions:
1. CODE QUALITY: Clean code, proper structure, maintainability
2. DESIGN CONSISTENCY: Visual harmony, spacing, color usage
3. ACCESSIBILITY: WCAG compliance, semantic HTML, ARIA labels
4. PERFORMANCE: Optimization, loading speed, resource usage
5. RESPONSIVENESS: Mobile-first, breakpoints, flexible layouts

For each dimension, provide:
- A score from 0-100
- Specific issues found (if any)
- Actionable suggestions for improvement

Return your evaluation in this EXACT JSON format:
{
  "overall": 0-100,
  "breakdown": {
    "codeQuality": 0-100,
    "designConsistency": 0-100,
    "accessibility": 0-100,
    "performance": 0-100,
    "responsiveness": 0-100
  },
  "issues": [
    {
      "severity": "critical" | "warning" | "info",
      "category": "code" | "design" | "accessibility" | "performance",
      "message": "Description of the issue",
      "line": optional line number,
      "suggestion": "How to fix it"
    }
  ],
  "suggestions": [
    "General improvement suggestion 1",
    "General improvement suggestion 2"
  ],
  "explanation": "Overall explanation of the quality assessment and reasoning"
}

Be thorough but fair. Real-world code is never perfect.`;

export class QualityScoringService {
  /**
   * Evaluate the quality of generated code
   */
  async evaluateCode(code: GeneratedCode): Promise<QualityScore> {
    try {
      const prompt = this.buildEvaluationPrompt(code);

      const response = await claudeService.sendMessage(
        [{ role: 'user', content: prompt }],
        {
          systemPrompt: QUALITY_EVALUATION_PROMPT,
          temperature: 0.3,
          maxTokens: 3000,
        }
      );

      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to parse quality evaluation');
      }

      const evaluation: QualityScore = JSON.parse(jsonMatch[0]);

      // Validate and enhance the evaluation
      this.validateEvaluation(evaluation);
      this.performBasicChecks(code, evaluation);

      return evaluation;
    } catch (error) {
      console.error('Error evaluating code quality:', error);
      return this.getBasicEvaluation(code);
    }
  }

  /**
   * Build the evaluation prompt
   */
  private buildEvaluationPrompt(code: GeneratedCode): string {
    return `Evaluate this website code for quality and best practices:

HTML (${code.html.length} characters):
${code.html}

CSS (${code.css.length} characters):
${code.css}

JavaScript (${code.javascript.length} characters):
${code.javascript || 'No JavaScript code'}

Provide a detailed quality evaluation with scores and actionable feedback.`;
  }

  /**
   * Validate the evaluation response
   */
  private validateEvaluation(evaluation: any): void {
    if (typeof evaluation.overall !== 'number') {
      throw new Error('Invalid overall score');
    }
    if (!evaluation.breakdown) {
      throw new Error('Missing breakdown scores');
    }
    if (!Array.isArray(evaluation.issues)) {
      throw new Error('Invalid issues array');
    }
  }

  /**
   * Perform basic automated checks
   */
  private performBasicChecks(code: GeneratedCode, evaluation: QualityScore): void {
    // Check for common issues
    
    // 1. Missing viewport meta tag
    if (!code.html.includes('viewport')) {
      evaluation.issues.push({
        severity: 'warning',
        category: 'accessibility',
        message: 'Missing viewport meta tag',
        suggestion: 'Add <meta name="viewport" content="width=device-width, initial-scale=1.0">',
      });
    }

    // 2. Missing alt attributes on images
    const imgTags = code.html.match(/<img[^>]+>/g) || [];
    const missingAlt = imgTags.filter(img => !img.includes('alt='));
    if (missingAlt.length > 0) {
      evaluation.issues.push({
        severity: 'warning',
        category: 'accessibility',
        message: `${missingAlt.length} image(s) missing alt attributes`,
        suggestion: 'Add descriptive alt text to all images for accessibility',
      });
    }

    // 3. Inline styles (anti-pattern)
    const inlineStyles = code.html.match(/style=/g);
    if (inlineStyles && inlineStyles.length > 5) {
      evaluation.issues.push({
        severity: 'info',
        category: 'code',
        message: 'Multiple inline styles detected',
        suggestion: 'Consider moving inline styles to the CSS file for better maintainability',
      });
    }

    // 4. No semantic HTML5 elements
    const hasSemanticHTML = /(<header|<nav|<main|<article|<section|<aside|<footer)/.test(
      code.html
    );
    if (!hasSemanticHTML) {
      evaluation.issues.push({
        severity: 'warning',
        category: 'accessibility',
        message: 'Limited use of semantic HTML5 elements',
        suggestion: 'Use semantic elements like <header>, <nav>, <main>, <footer> for better structure',
      });
    }

    // 5. Large CSS file
    if (code.css.length > 10000) {
      evaluation.suggestions.push(
        'Consider splitting CSS into multiple files or using a CSS preprocessor for better organization'
      );
    }

    // 6. Check for responsive design patterns
    const hasMediaQueries = /@media/.test(code.css);
    if (!hasMediaQueries) {
      evaluation.issues.push({
        severity: 'critical',
        category: 'design',
        message: 'No media queries found - site may not be responsive',
        suggestion: 'Add media queries for mobile, tablet, and desktop breakpoints',
      });
      evaluation.breakdown.responsiveness = Math.min(
        evaluation.breakdown.responsiveness,
        50
      );
    }

    // Recalculate overall score based on issues
    this.recalculateOverallScore(evaluation);
  }

  /**
   * Recalculate overall score based on issues and breakdowns
   */
  private recalculateOverallScore(evaluation: QualityScore): void {
    const { breakdown } = evaluation;
    
    // Average of all breakdown scores
    const scores = [
      breakdown.codeQuality,
      breakdown.designConsistency,
      breakdown.accessibility,
      breakdown.performance,
      breakdown.responsiveness,
    ];

    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;

    // Penalty for critical issues
    const criticalPenalty = evaluation.issues.filter(
      i => i.severity === 'critical'
    ).length * 10;
    const warningPenalty = evaluation.issues.filter(
      i => i.severity === 'warning'
    ).length * 3;

    evaluation.overall = Math.max(
      0,
      Math.min(100, average - criticalPenalty - warningPenalty)
    );
  }

  /**
   * Get a basic evaluation when AI evaluation fails
   */
  private getBasicEvaluation(code: GeneratedCode): QualityScore {
    const issues: QualityIssue[] = [];

    // Basic automated checks
    if (!code.html.includes('<!DOCTYPE html>')) {
      issues.push({
        severity: 'warning',
        category: 'code',
        message: 'Missing DOCTYPE declaration',
        suggestion: 'Add <!DOCTYPE html> at the beginning',
      });
    }

    return {
      overall: 70,
      breakdown: {
        codeQuality: 70,
        designConsistency: 70,
        accessibility: 65,
        performance: 75,
        responsiveness: 70,
      },
      issues,
      suggestions: [
        'Code has been generated but detailed evaluation is unavailable',
        'Please review the code manually for best practices',
      ],
      explanation:
        'Basic automated evaluation completed. The code appears functional but should be manually reviewed.',
    };
  }

  /**
   * Generate an explanation of the quality score
   */
  async explainQuality(
    code: GeneratedCode,
    qualityScore: QualityScore
  ): Promise<string> {
    const prompt = `Explain this quality evaluation in simple terms for a non-technical user:

Overall Score: ${qualityScore.overall}/100

Breakdown:
- Code Quality: ${qualityScore.breakdown.codeQuality}/100
- Design Consistency: ${qualityScore.breakdown.designConsistency}/100
- Accessibility: ${qualityScore.breakdown.accessibility}/100
- Performance: ${qualityScore.breakdown.performance}/100
- Responsiveness: ${qualityScore.breakdown.responsiveness}/100

Issues Found: ${qualityScore.issues.length}
${qualityScore.issues
  .map(i => `- [${i.severity.toUpperCase()}] ${i.message}`)
  .join('\n')}

Provide a clear, friendly explanation of what these scores mean and what should be improved.`;

    try {
      return await claudeService.prompt(prompt);
    } catch (error) {
      return qualityScore.explanation;
    }
  }

  /**
   * Get improvement suggestions with code examples
   */
  async getImprovementExamples(
    issue: QualityIssue,
    code: GeneratedCode
  ): Promise<string> {
    const prompt = `Given this code quality issue, provide a specific code example showing how to fix it:

Issue: ${issue.message}
Category: ${issue.category}
Suggestion: ${issue.suggestion}

Provide a before/after code snippet showing the improvement.`;

    try {
      return await claudeService.prompt(prompt);
    } catch (error) {
      return issue.suggestion || 'No specific example available';
    }
  }
}

export const qualityScoringService = new QualityScoringService();
