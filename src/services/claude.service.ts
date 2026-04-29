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

export class ClaudeService {
  private model: string;

  constructor(model: string = 'claude-sonnet-4-20250514') {
    this.model = model;
  }

  async sendMessage(
    messages: ClaudeMessage[],
    options?: ClaudeRequestOptions
  ): Promise<string> {
    try {
      // ✅ FIX: was 4096 — a multi-page website with 4+ pages of HTML+CSS
      // easily exceeds 4096 tokens. Claude was being cut off mid-generation,
      // producing incomplete HTML with no closing </html> tags, causing:
      //   - [object Object] in code view (incomplete JSON)
      //   - blank preview (browser can't render malformed HTML)
      //   - 0 pages extracted (===END PAGE=== never reached)
      // 8192 tokens gives enough room for 4-6 full pages.
      const maxTokens = options?.maxTokens || 8192;

      console.log(`[Claude] Sending request: model=${options?.model || this.model}, maxTokens=${maxTokens}`);

      const response = await anthropic.messages.create({
        model: options?.model || this.model,
        max_tokens: maxTokens,
        temperature: options?.temperature ?? 0.3,
        system: options?.systemPrompt,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
      });

      const textContent = response.content.find(block => block.type === 'text');
      const result = textContent && textContent.type === 'text' ? textContent.text : '';

      console.log(`[Claude] Response received: ${result.length} chars, stop_reason=${response.stop_reason}`);

      // ✅ Warn if Claude stopped because it hit the token limit
      if (response.stop_reason === 'max_tokens') {
        console.warn('[Claude] ⚠️ Response was TRUNCATED — hit max_tokens limit! Output may be incomplete.');
        console.warn('[Claude] Consider increasing maxTokens further or reducing prompt size.');
      }

      return result;
    } catch (error) {
      console.error('Error calling Claude API:', error);
      throw new Error(`Claude API Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async prompt(userPrompt: string, systemPrompt?: string): Promise<string> {
    return this.sendMessage(
      [{ role: 'user', content: userPrompt }],
      { systemPrompt }
    );
  }

  async *streamMessage(
    messages: ClaudeMessage[],
    options?: ClaudeRequestOptions
  ): AsyncGenerator<string> {
    try {
      const stream = await anthropic.messages.stream({
        model: options?.model || this.model,
        max_tokens: options?.maxTokens || 8192,
        temperature: options?.temperature ?? 0.3,
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
      throw new Error(`Claude Stream Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const claudeService = new ClaudeService();
