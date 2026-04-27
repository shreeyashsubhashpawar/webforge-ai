import axios, { AxiosInstance } from 'axios';

export interface OllamaEmbeddingRequest {
  model: string;
  prompt: string;
}

export interface OllamaEmbeddingResponse {
  embedding: number[];
}

export interface OllamaGenerationRequest {
  model: string;
  prompt: string;
  stream?: boolean;
  temperature?: number;
  top_p?: number;
  top_k?: number;
}

export interface OllamaGenerationResponse {
  response: string;
  done: boolean;
}

export interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
}

export interface OllamaModelsResponse {
  models: OllamaModel[];
}

/**
 * Service for communicating with Ollama API
 * Handles embeddings and text generation using local Ollama models
 */
export class OllamaService {
  private client: AxiosInstance;
  private baseUrl: string;
  private embeddingModel: string;
  private generationModel: string;
  private timeout: number;
  private isHealthy: boolean = false;

  constructor(
    baseUrl: string = process.env.OLLAMA_API_URL || 'http://localhost:11434',
    embeddingModel: string = process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text',
    generationModel: string = process.env.OLLAMA_TEXT_MODEL || 'mistral',
    timeout: number = parseInt(process.env.OLLAMA_TIMEOUT || '120000', 10)
  ) {
    this.baseUrl = baseUrl;
    this.embeddingModel = embeddingModel;
    this.generationModel = generationModel;
    this.timeout = timeout;

    this.client = axios.create({
      baseURL: baseUrl,
      timeout: timeout,
    });

    console.log(`[Ollama] Initialized with:`);
    console.log(`  - Base URL: ${baseUrl}`);
    console.log(`  - Embedding Model: ${embeddingModel}`);
    console.log(`  - Generation Model: ${generationModel}`);
  }

  /**
   * Check if Ollama server is healthy and models are available
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/api/tags');
      const models: OllamaModelsResponse = response.data;

      const hasEmbeddingModel = models.models.some((m) => m.name.includes(this.embeddingModel));
      const hasGenerationModel = models.models.some((m) => m.name.includes(this.generationModel));

      if (!hasEmbeddingModel || !hasGenerationModel) {
        console.warn(`[Ollama] Missing models:`);
        if (!hasEmbeddingModel) console.warn(`  - ${this.embeddingModel}`);
        if (!hasGenerationModel) console.warn(`  - ${this.generationModel}`);
        return false;
      }

      this.isHealthy = true;
      console.log('[Ollama] Health check passed ✓');
      return true;
    } catch (error) {
      console.error('[Ollama] Health check failed:', error instanceof Error ? error.message : error);
      this.isHealthy = false;
      return false;
    }
  }

  /**
   * Generate embeddings for text using the embedding model
   * Returns a vector representation of the text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.isHealthy) {
      const healthy = await this.healthCheck();
      if (!healthy) {
        throw new Error('Ollama service is not healthy. Check if server is running.');
      }
    }

    try {
      console.log(`[Ollama] Generating embedding (${text.length} chars)...`);

      const response = await this.client.post('/api/embed', {
        model: this.embeddingModel,
        input: text,
      });

      // Handle both single and array responses
      const embedding = Array.isArray(response.data.embeddings)
        ? response.data.embeddings[0]
        : response.data.embedding;

      console.log(`[Ollama] Embedding generated: ${embedding.length} dimensions`);
      return embedding;
    } catch (error) {
      console.error('[Ollama] Embedding generation failed:', error);
      throw new Error(
        `Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate embeddings for multiple texts (batch)
   * More efficient than calling generateEmbedding multiple times
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.isHealthy) {
      const healthy = await this.healthCheck();
      if (!healthy) {
        throw new Error('Ollama service is not healthy. Check if server is running.');
      }
    }

    try {
      console.log(`[Ollama] Generating embeddings for ${texts.length} texts...`);

      const response = await this.client.post('/api/embed', {
        model: this.embeddingModel,
        input: texts,
      });

      const embeddings = response.data.embeddings || [response.data.embedding];
      console.log(`[Ollama] Generated ${embeddings.length} embeddings`);

      return embeddings;
    } catch (error) {
      console.error('[Ollama] Batch embedding generation failed:', error);
      throw new Error(
        `Failed to generate embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate text using the language model
   */
  async generateText(
    prompt: string,
    options?: {
      temperature?: number;
      topP?: number;
      topK?: number;
    }
  ): Promise<string> {
    if (!this.isHealthy) {
      const healthy = await this.healthCheck();
      if (!healthy) {
        throw new Error('Ollama service is not healthy. Check if server is running.');
      }
    }

    try {
      console.log(`[Ollama] Generating text (prompt: ${prompt.substring(0, 50)}...)`);

      const response = await this.client.post('/api/generate', {
        model: this.generationModel,
        prompt,
        stream: false,
        temperature: options?.temperature ?? 0.7,
        top_p: options?.topP ?? 0.9,
        top_k: options?.topK ?? 40,
      });

      const generatedText = response.data.response || '';
      console.log(`[Ollama] Generated ${generatedText.length} characters`);

      return generatedText;
    } catch (error) {
      console.error('[Ollama] Text generation failed:', error);
      throw new Error(
        `Failed to generate text: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate text with streaming (for real-time progress)
   */
  async generateTextStream(
    prompt: string,
    onChunk: (chunk: string) => void,
    options?: {
      temperature?: number;
      topP?: number;
      topK?: number;
    }
  ): Promise<string> {
    if (!this.isHealthy) {
      const healthy = await this.healthCheck();
      if (!healthy) {
        throw new Error('Ollama service is not healthy. Check if server is running.');
      }
    }

    try {
      console.log(`[Ollama] Generating text with stream...`);

      const response = await this.client.post('/api/generate', {
        model: this.generationModel,
        prompt,
        stream: true,
        temperature: options?.temperature ?? 0.7,
        top_p: options?.topP ?? 0.9,
        top_k: options?.topK ?? 40,
      });

      let fullResponse = '';
      const lines = response.data.toString().split('\n');

      for (const line of lines) {
        if (line.trim()) {
          try {
            const data = JSON.parse(line);
            const chunk = data.response || '';
            fullResponse += chunk;
            onChunk(chunk);
          } catch (e) {
            // Skip invalid JSON lines
          }
        }
      }

      console.log(`[Ollama] Stream complete: ${fullResponse.length} characters`);
      return fullResponse;
    } catch (error) {
      console.error('[Ollama] Text generation stream failed:', error);
      throw new Error(
        `Failed to generate text stream: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Calculate cosine similarity between two embedding vectors
   */
  cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Get list of available models
   */
  async getAvailableModels(): Promise<OllamaModel[]> {
    try {
      const response = await this.client.get('/api/tags');
      return response.data.models || [];
    } catch (error) {
      console.error('[Ollama] Failed to get models:', error);
      return [];
    }
  }

  /**
   * Get embedding model name
   */
  getEmbeddingModel(): string {
    return this.embeddingModel;
  }

  /**
   * Get generation model name
   */
  getGenerationModel(): string {
    return this.generationModel;
  }

  /**
   * Check if service is healthy
   */
  getHealthStatus(): boolean {
    return this.isHealthy;
  }
}

// Export singleton instance
export const ollamaService = new OllamaService();
