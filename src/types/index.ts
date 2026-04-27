// Core types for WebForge AI

export interface UserPrompt {
  text: string;
  timestamp: Date;
}

export interface UploadedDocument {
  id: string;
  name: string;
  type: 'pdf' | 'docx' | 'txt' | 'image';
  size: number;
  content?: string;
  uploadedAt: Date;
}

export interface IntentClassification {
  primaryIntent: 'landing-page' | 'portfolio' | 'blog' | 'ecommerce' | 'dashboard' | 'documentation' | 'custom';
  confidence: number;
  designPreferences: {
    style: 'modern' | 'minimal' | 'corporate' | 'creative' | 'playful';
    colorScheme?: string;
    layout?: 'single-page' | 'multi-page';
    components: string[];
  };
  extractedRequirements: string[];
}

export interface DesignRecommendation {
  framework: 'react' | 'vanilla' | 'vue';
  components: ComponentRecommendation[];
  colorPalette: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  typography: {
    headingFont: string;
    bodyFont: string;
  };
  reasoning: string;
}

export interface ComponentRecommendation {
  name: string;
  type: 'header' | 'hero' | 'features' | 'testimonials' | 'footer' | 'gallery' | 'form' | 'custom';
  description: string;
  priority: number;
}

// ============ RAG Pipeline Types ============

export interface ExtractedImage {
  id: string;
  pageNumber: number;
  base64?: string;
  localPath?: string;
  metadata: {
    width?: number;
    height?: number;
    extractedAt: Date;
  };
}

export interface ExtractedPageContent {
  pageNumber: number;
  text: string;
  images: ExtractedImage[];
  metadata?: Record<string, any>;
}

export interface ExtractedPDFContent {
  id: string;
  fileName: string;
  pages: ExtractedPageContent[];
  metadata: {
    totalPages: number;
    totalImages: number;
    extractedAt: Date;
    fileSize: number;
  };
}

export interface RAGChunkMetadata {
  pageNumber: number;
  chunkIndex: number;
  relatedImages?: string[];
  section?: string;
  wordCount: number;
}

export interface RAGChunk {
  id: string;
  text: string;
  metadata: RAGChunkMetadata;
  embedding?: number[];
}

export interface RAGChunkedDocument {
  id: string;
  originalName: string;
  chunks: RAGChunk[];
  imageIds: string[];
  metadata: {
    totalChunks: number;
    totalWordCount: number;
    chunkSize: number;
    overlapSize: number;
  };
}

export interface RAGVectorIndex {
  chunkId: string;
  embedding: number[];
  text: string;
  documentId: string;
  pageNumber: number;
  chunkIndex: number;
  relatedImages?: string[];
}

export interface RAGContextData {
  id: string;
  documentId: string;
  documentName: string;
  chunks: RAGChunk[];
  vectorIndex: RAGVectorIndex[];
  imageIds: string[];
  metadata: {
    createdAt: Date;
    totalChunks: number;
    totalWords: number;
  };
}

export interface RAGRetrievalResult {
  chunks: RAGChunk[];
  similarity: number[];
  images: string[];
  context: string;
}

// Legacy/Alternative interface for backward compatibility
export interface RAGContext {
  documents: ProcessedDocument[];
  relevantChunks: DocumentChunk[];
  embeddings?: number[][];
}

export interface ProcessedDocument {
  id: string;
  originalName: string;
  text: string;
  chunks: DocumentChunk[];
  metadata: {
    pageCount?: number;
    wordCount: number;
    extractedAt: Date;
  };
}

export interface DocumentChunk {
  id: string;
  text: string;
  documentId: string;
  chunkIndex: number;
  embedding?: number[];
  metadata?: Record<string, any>;
}

export interface WebPage {
  id: string;
  name: string;
  title: string;
  html: string;
  css?: string;
  javascript?: string;
  route?: string; // URL path for this page
}

export interface GeneratedFile {
  name: string; // e.g., 'index.html', 'styles.css', 'script.js'
  type: 'html' | 'css' | 'javascript' | 'json';
  content: string;
  path?: string; // e.g., 'index.html', 'pages/about.html'
}

export interface GeneratedWebsite {
  files: GeneratedFile[];
  mainFile: string; // e.g., 'index.html'
  framework?: 'react' | 'vanilla';
  dependencies?: string[];
}

export interface GeneratedCode {
  pages: WebPage[];
  framework?: 'react' | 'vanilla';
  dependencies?: string[];
  preview?: string;
  // New structured file format
  website?: GeneratedWebsite;
  // Legacy support
  html?: string;
  css?: string;
  javascript?: string;
}

export interface QualityScore {
  overall: number;
  breakdown: {
    codeQuality: number;
    designConsistency: number;
    accessibility: number;
    performance: number;
    responsiveness: number;
  };
  issues: QualityIssue[];
  suggestions: string[];
  explanation: string;
}

export interface QualityIssue {
  severity: 'critical' | 'warning' | 'info';
  category: 'code' | 'design' | 'accessibility' | 'performance';
  message: string;
  line?: number;
  suggestion?: string;
}

export interface GenerationRequest {
  prompt: string;
  documents?: UploadedDocument[];
  ragContextId?: string; // ID of processed RAG context
  designPreferences?: Partial<DesignRecommendation>;
  constraints?: {
    maxFileSize?: number;
    includeComments?: boolean;
    minifyCode?: boolean;
  };
}

export interface GenerationResponse {
  success: boolean;
  intent?: IntentClassification;
  design?: DesignRecommendation;
  code?: GeneratedCode;
  quality?: QualityScore;
  ragContext?: RAGContextData; // Processed RAG context if available
  augmentedPrompt?: string; // Enhanced prompt with RAG context
  error?: string;
  processingTime?: number;
}

export interface ProjectState {
  id: string;
  name: string;
  prompt: string;
  documents: UploadedDocument[];
  intent?: IntentClassification;
  design?: DesignRecommendation;
  code?: GeneratedCode;
  quality?: QualityScore;
  createdAt: Date;
  updatedAt: Date;
}
