import { pipeline, FeatureExtractionPipeline } from '@xenova/transformers';

export class EmbeddingService {
  private static instance: EmbeddingService;
  private pipe: FeatureExtractionPipeline | null = null;
  private initFailed = false;

  private constructor() {}

  public static getInstance(): EmbeddingService {
    if (!EmbeddingService.instance) {
      EmbeddingService.instance = new EmbeddingService();
    }
    return EmbeddingService.instance;
  }

  public async initialize(): Promise<void> {
    if (this.pipe) return;
    if (this.initFailed) throw new Error('Embedding model failed to load. Check network access to Hugging Face or run `npm run index` first.');

    console.error('Initializing local embedding model (Xenova/all-MiniLM-L6-v2)...');
    try {
      this.pipe = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      console.error('Embedding model loaded.');
    } catch (err) {
      this.initFailed = true;
      throw err;
    }
  }

  public async generateEmbedding(text: string): Promise<number[]> {
    if (!this.pipe) {
      await this.initialize();
    }

    const output = await this.pipe!(text, { 
      pooling: 'mean', 
      normalize: true 
    });

    return Array.from(output.data);
  }
}
