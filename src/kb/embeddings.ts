export interface EmbeddingConfig {
    modelName: string;
    batchSize: number;
    maxTokens: number;
    enabled: boolean;
}

export interface DocumentEmbedding {
    id: string;
    path: string;
    title: string;
    content: string;
    embedding: number[];
    metadata: {
        created: number;
        modified: number;
        size: number;
        tags: string[];
        links: string[];
    };
}

export interface EmbeddingSearchResult {
    document: DocumentEmbedding;
    similarity: number;
    score: number;
}

export class EmbeddingManager {
    private config: EmbeddingConfig;
    private isInitialized = false;
    private pipeline: any = null;

    constructor(config: EmbeddingConfig) {
        this.config = config;
    }

    async initialize(): Promise<void> {
        if (this.isInitialized || !this.config.enabled) return;

        try {
            // Dynamic import to avoid bundling when not needed
            const { pipeline } = await import('@xenova/transformers');
            
            // Initialize the sentence transformer pipeline
            this.pipeline = await pipeline(
                'feature-extraction',
                this.config.modelName,
                { 
                    quantized: true,
                    progress_callback: (progress: any) => {
                        console.log('Loading embedding model:', progress);
                    }
                }
            );
            
            this.isInitialized = true;
            console.log('Embedding model initialized successfully');
        } catch (error) {
            console.error('Failed to initialize embedding model:', error);
            throw error;
        }
    }

    async generateEmbedding(text: string): Promise<number[]> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        if (!this.pipeline) {
            throw new Error('Embedding model not initialized');
        }

        try {
            // Truncate text to max tokens (approximate)
            const truncatedText = this.truncateText(text, this.config.maxTokens);
            
            // Generate embedding
            const output = await this.pipeline(truncatedText, {
                pooling: 'mean',
                normalize: true
            });

            // Convert tensor to array
            return Array.from(output.data);
        } catch (error) {
            console.error('Failed to generate embedding:', error);
            throw error;
        }
    }

    async generateEmbeddings(texts: string[]): Promise<number[][]> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const embeddings: number[][] = [];
        
        // Process in batches to avoid memory issues
        for (let i = 0; i < texts.length; i += this.config.batchSize) {
            const batch = texts.slice(i, i + this.config.batchSize);
            const batchEmbeddings = await Promise.all(
                batch.map(text => this.generateEmbedding(text))
            );
            embeddings.push(...batchEmbeddings);
        }

        return embeddings;
    }

    calculateCosineSimilarity(embedding1: number[], embedding2: number[]): number {
        if (embedding1.length !== embedding2.length) {
            throw new Error('Embeddings must have the same dimensions');
        }

        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;

        for (let i = 0; i < embedding1.length; i++) {
            dotProduct += embedding1[i] * embedding2[i];
            norm1 += embedding1[i] * embedding1[i];
            norm2 += embedding2[i] * embedding2[i];
        }

        norm1 = Math.sqrt(norm1);
        norm2 = Math.sqrt(norm2);

        if (norm1 === 0 || norm2 === 0) {
            return 0;
        }

        return dotProduct / (norm1 * norm2);
    }

    findMostSimilar(
        queryEmbedding: number[], 
        documents: DocumentEmbedding[], 
        topK = 10,
        threshold = 0.5
    ): EmbeddingSearchResult[] {
        const results: EmbeddingSearchResult[] = [];

        for (const doc of documents) {
            const similarity = this.calculateCosineSimilarity(queryEmbedding, doc.embedding);
            
            if (similarity >= threshold) {
                results.push({
                    document: doc,
                    similarity,
                    score: similarity
                });
            }
        }

        // Sort by similarity descending
        results.sort((a, b) => b.similarity - a.similarity);
        
        return results.slice(0, topK);
    }

    private truncateText(text: string, maxTokens: number): string {
        // Rough approximation: 1 token ≈ 4 characters
        const maxChars = maxTokens * 4;
        
        if (text.length <= maxChars) {
            return text;
        }

        // Try to truncate at word boundaries
        const truncated = text.substring(0, maxChars);
        const lastSpaceIndex = truncated.lastIndexOf(' ');
        
        return lastSpaceIndex > maxChars * 0.8 
            ? truncated.substring(0, lastSpaceIndex) 
            : truncated;
    }

    updateConfig(newConfig: Partial<EmbeddingConfig>): void {
        const oldEnabled = this.config.enabled;
        this.config = { ...this.config, ...newConfig };
        
        // If embedding was disabled and now enabled, reset initialization
        if (!oldEnabled && this.config.enabled) {
            this.isInitialized = false;
            this.pipeline = null;
        }
    }

    isReady(): boolean {
        return this.isInitialized && this.pipeline !== null;
    }

    getModelInfo(): { modelName: string; isReady: boolean; batchSize: number } {
        return {
            modelName: this.config.modelName,
            isReady: this.isReady(),
            batchSize: this.config.batchSize
        };
    }
}