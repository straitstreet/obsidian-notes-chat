export interface LocalEmbeddingConfig {
    modelName: string;
    maxTokens: number;
    batchSize: number;
}

export class LocalEmbeddingService {
    private pipeline: any = null;
    private modelName: string;
    private isInitializing: boolean = false;
    private isReady: boolean = false;
    
    constructor(config: LocalEmbeddingConfig) {
        this.modelName = config.modelName;
    }
    
    async initialize(onProgress?: (progress: { loaded: number; total: number; status: string }) => void): Promise<void> {
        if (this.isReady || this.isInitializing) return;
        
        this.isInitializing = true;
        
        try {
            console.log(`Initializing local embedding model: ${this.modelName}`);
            
            // Dynamic import of transformers to handle potential module not found errors
            let pipeline: any;
            try {
                const transformers = await import('@xenova/transformers');
                pipeline = transformers.pipeline;
            } catch (importError) {
                console.error('Failed to import @xenova/transformers:', importError);
                throw new Error('Local embeddings require @xenova/transformers to be available. This feature is currently disabled in the Obsidian environment.');
            }
            
            // Create progress callback if provided
            const progressCallback = onProgress ? (data: any) => {
                if (data.status === 'downloading' || data.status === 'loading') {
                    onProgress({
                        loaded: (data as any).loaded || 0,
                        total: (data as any).total || 0,
                        status: (data as any).status
                    });
                }
            } : undefined;
            
            // Initialize the pipeline with progress tracking
            this.pipeline = await pipeline(
                'feature-extraction',
                this.modelName,
                { 
                    progress_callback: progressCallback,
                    // Cache model in plugin data folder
                    cache_dir: './.obsidian/plugins/obsidian-notes-chat/models'
                }
            );
            
            this.isReady = true;
            console.log('Local embedding model initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize local embedding model:', error);
            throw new Error(`Failed to initialize embedding model: ${(error as Error).message}`);
        } finally {
            this.isInitializing = false;
        }
    }
    
    async generateEmbedding(text: string): Promise<number[]> {
        if (!this.isReady || !this.pipeline) {
            throw new Error('Local embedding service not initialized');
        }
        
        try {
            // Generate embedding using Transformers.js
            const result = await this.pipeline(text, {
                pooling: 'mean',
                normalize: true
            });
            
            // Convert to regular array
            return Array.from((result as any).data) as number[];
            
        } catch (error) {
            console.error('Failed to generate embedding:', error);
            throw new Error(`Failed to generate embedding: ${(error as Error).message}`);
        }
    }
    
    async generateBatchEmbeddings(texts: string[], batchSize: number = 5): Promise<number[][]> {
        const embeddings: number[][] = [];
        
        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);
            const batchResults = await Promise.all(
                batch.map(text => this.generateEmbedding(text))
            );
            embeddings.push(...batchResults);
        }
        
        return embeddings;
    }
    
    getModelName(): string {
        return this.modelName;
    }
    
    isModelReady(): boolean {
        return this.isReady;
    }
    
    isModelInitializing(): boolean {
        return this.isInitializing;
    }
    
    destroy(): void {
        this.pipeline = null;
        this.isReady = false;
        this.isInitializing = false;
    }
}