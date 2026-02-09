import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeRequestOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

/**
 * Main service for interacting with Claude API
 */
export class ClaudeService {
  private model: string;

  constructor(model: string = 'claude-sonnet-4-20250514') {
    this.model = model;
  }

  /**
   * Send a message to Claude and get a response
   */
  async sendMessage(
    messages: ClaudeMessage[],
    options?: ClaudeRequestOptions
  ): Promise<string> {
    try {
      const response = await anthropic.messages.create({
        model: options?.model || this.model,
        max_tokens: options?.maxTokens || 4096,
        temperature: options?.temperature || 0.7,
        system: options?.systemPrompt,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
      });

      const textContent = response.content.find(block => block.type === 'text');
      return textContent && textContent.type === 'text' ? textContent.text : '';
    } catch (error) {
      console.error('Error calling Claude API:', error);
      throw new Error(`Claude API Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send a simple prompt and get a response
   */
  async prompt(userPrompt: string, systemPrompt?: string): Promise<string> {
    return this.sendMessage(
      [{ role: 'user', content: userPrompt }],
      { systemPrompt }
    );
  }

  /**
   * Stream a response from Claude (for real-time UI updates)
   */
  async *streamMessage(
    messages: ClaudeMessage[],
    options?: ClaudeRequestOptions
  ): AsyncGenerator<string> {
    try {
      const stream = await anthropic.messages.stream({
        model: options?.model || this.model,
        max_tokens: options?.maxTokens || 4096,
        temperature: options?.temperature || 0.7,
        system: options?.systemPrompt,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
      });

      for await (const chunk of stream) {
        if (
          chunk.type === 'content_block_delta' &&
          chunk.delta.type === 'text_delta'
        ) {
          yield chunk.delta.text;
        }
      }
    } catch (error) {
      console.error('Error streaming from Claude API:', error);
      throw new Error(`Claude Streaming Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const claudeService = new ClaudeService();
