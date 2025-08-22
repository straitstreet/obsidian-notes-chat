export interface EmbeddingConfig {
    modelName: string;
    batchSize: number;
    maxTokens: number;
    enabled: boolean;
    provider: 'ollama' | 'openai' | 'transformers';
    baseUrl?: string;
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

    constructor(config: EmbeddingConfig) {
        this.config = config;
    }

    async initialize(): Promise<void> {
        if (this.isInitialized || !this.config.enabled) return;

        try {
            console.log(`Initializing embedding provider: ${this.config.provider}`);
            
            if (this.config.provider === 'ollama') {
                await this.initializeOllama();
            } else if (this.config.provider === 'openai') {
                await this.initializeOpenAI();
            } else {
                throw new Error(`Unsupported embedding provider: ${this.config.provider}`);
            }
            
            this.isInitialized = true;
            console.log('Embedding provider initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize embedding provider:', error);
            console.warn('🔍 Embeddings disabled - knowledge graph will use text search fallback');
            
            // Don't throw error, just disable embeddings gracefully
            this.config.enabled = false;
            this.isInitialized = false;
        }
    }

    private async initializeOllama(): Promise<void> {
        const baseUrl = this.config.baseUrl || 'http://localhost:11434';
        
        try {
            // Test connection to Ollama
            const response = await fetch(`${baseUrl}/api/tags`);
            if (!response.ok) {
                throw new Error(`Ollama not available at ${baseUrl}`);
            }
            
            const data = await response.json();
            const availableModels = data.models?.map((m: any) => m.name) || [];
            
            // Check if our embedding model is available
            const modelExists = availableModels.some((name: string) => 
                name.includes(this.config.modelName) || name === this.config.modelName
            );
            
            if (!modelExists) {
                console.warn(`Model ${this.config.modelName} not found. Available models:`, availableModels);
                console.warn('Pulling embedding model... This may take a few minutes.');
                
                // Try to pull the model
                await this.pullOllamaModel();
            }
            
            // Test embedding generation
            console.log('Testing Ollama embedding generation...');
            const testEmbedding = await this.generateEmbedding('test text');
            if (!testEmbedding || testEmbedding.length === 0) {
                throw new Error('Test embedding generation failed');
            }
            
            console.log(`Ollama embedding test successful: ${testEmbedding.length} dimensions`);
            
        } catch (error) {
            throw new Error(`Ollama initialization failed: ${(error as Error).message}`);
        }
    }

    private async initializeOpenAI(): Promise<void> {
        // TODO: Implement OpenAI embeddings if needed
        throw new Error('OpenAI embeddings not implemented yet');
    }

    private async pullOllamaModel(): Promise<void> {
        const baseUrl = this.config.baseUrl || 'http://localhost:11434';
        
        try {
            const response = await fetch(`${baseUrl}/api/pull`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: this.config.modelName })
            });
            
            if (!response.ok) {
                throw new Error(`Failed to pull model: ${response.statusText}`);
            }
            
            console.log(`Successfully pulled model: ${this.config.modelName}`);
        } catch (error) {
            console.error(`Failed to pull model ${this.config.modelName}:`, error);
            throw error;
        }
    }

    async generateEmbedding(text: string): Promise<number[]> {
        if (!this.isInitialized || !this.config.enabled) {
            throw new Error('Embedding manager not initialized');
        }

        try {
            if (this.config.provider === 'ollama') {
                return await this.generateOllamaEmbedding(text);
            } else if (this.config.provider === 'openai') {
                return await this.generateOpenAIEmbedding(text);
            } else {
                throw new Error(`Unsupported provider: ${this.config.provider}`);
            }
        } catch (error) {
            console.error('Failed to generate embedding:', error);
            throw error;
        }
    }

    private async generateOllamaEmbedding(text: string): Promise<number[]> {
        const baseUrl = this.config.baseUrl || 'http://localhost:11434';
        
        try {
            const response = await fetch(`${baseUrl}/api/embeddings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.config.modelName,
                    prompt: text.substring(0, this.config.maxTokens * 4) // Rough token limit
                })
            });
            
            if (!response.ok) {
                throw new Error(`Ollama embedding request failed: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (!data.embedding || !Array.isArray(data.embedding)) {
                throw new Error('Invalid embedding response from Ollama');
            }
            
            return data.embedding;
            
        } catch (error) {
            console.error('Ollama embedding generation failed:', error);
            throw error;
        }
    }

    private async generateOpenAIEmbedding(text: string): Promise<number[]> {
        // TODO: Implement OpenAI embedding generation
        throw new Error('OpenAI embeddings not implemented yet');
    }

    async generateEmbeddings(texts: string[]): Promise<number[][]> {
        if (!this.isInitialized || !this.config.enabled) {
            throw new Error('Embedding manager not initialized');
        }

        const results: number[][] = [];
        const batchSize = this.config.batchSize;

        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);
            const batchPromises = batch.map(text => this.generateEmbedding(text));
            
            try {
                const batchResults = await Promise.all(batchPromises);
                results.push(...batchResults);
                
                // Small delay between batches to avoid overwhelming the service
                if (i + batchSize < texts.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            } catch (error) {
                console.error(`Batch embedding failed for batch starting at ${i}:`, error);
                throw error;
            }
        }

        return results;
    }

    cosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length) {
            throw new Error('Vectors must have the same length');
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
        return magnitude === 0 ? 0 : dotProduct / magnitude;
    }

    findSimilarEmbeddings(queryEmbedding: number[], embeddings: DocumentEmbedding[], topK: number = 5): EmbeddingSearchResult[] {
        const similarities = embeddings.map(doc => ({
            document: doc,
            similarity: this.cosineSimilarity(queryEmbedding, doc.embedding),
            score: this.cosineSimilarity(queryEmbedding, doc.embedding)
        }));

        return similarities
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, topK);
    }

    findMostSimilar(queryEmbedding: number[], embeddings: DocumentEmbedding[], topK: number = 5, threshold: number = 0.1): EmbeddingSearchResult[] {
        const similarities = embeddings.map(doc => ({
            document: doc,
            similarity: this.cosineSimilarity(queryEmbedding, doc.embedding),
            score: this.cosineSimilarity(queryEmbedding, doc.embedding)
        }));

        return similarities
            .filter(result => result.similarity >= threshold)
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, topK);
    }

    isReady(): boolean {
        return this.isInitialized && this.config.enabled;
    }

    getConfig(): EmbeddingConfig {
        return { ...this.config };
    }

    updateConfig(newConfig: Partial<EmbeddingConfig>) {
        this.config = { ...this.config, ...newConfig };
        
        // If critical settings changed, reinitialize
        if (newConfig.provider || newConfig.modelName || newConfig.baseUrl) {
            this.isInitialized = false;
        }
    }
}