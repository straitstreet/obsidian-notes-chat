export interface EmbeddingConfig {
    modelName: string;
    batchSize: number;
    maxTokens: number;
    enabled: boolean;
    provider: 'ollama' | 'openai' | 'local';
    baseUrl?: string;
    localModel?: string;
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

import { LocalEmbeddingService } from './local-embeddings';

export class EmbeddingManager {
    private config: EmbeddingConfig;
    private isInitialized = false;
    private localEmbedding?: LocalEmbeddingService;
    private progressCallback?: (progress: { loaded: number; total: number; status: string }) => void;

    constructor(config: EmbeddingConfig, progressCallback?: (progress: { loaded: number; total: number; status: string }) => void) {
        this.config = config;
        this.progressCallback = progressCallback;
    }

    async initialize(): Promise<void> {
        if (this.isInitialized || !this.config.enabled) return;

        try {
            console.log(`Initializing embedding provider: ${this.config.provider}`, this.config);
            
            // Default to ollama if provider is undefined
            const provider = this.config.provider || 'ollama';
            
            if (provider === 'ollama') {
                await this.initializeOllama();
            } else if (provider === 'openai') {
                await this.initializeOpenAI();
            } else if (provider === 'local') {
                await this.initializeLocal();
            } else {
                throw new Error(`Unsupported embedding provider: ${provider} (original: ${this.config.provider})`);
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

    private async initializeLocal(): Promise<void> {
        const modelName = this.config.localModel || 'Xenova/all-MiniLM-L6-v2';
        
        try {
            console.log(`Initializing local embedding model: ${modelName}`);
            
            this.localEmbedding = new LocalEmbeddingService({
                modelName,
                maxTokens: this.config.maxTokens,
                batchSize: this.config.batchSize
            });
            
            // Initialize with progress callback that can be passed from outside
            await this.localEmbedding.initialize(this.progressCallback);
            
            // Test embedding generation
            console.log('Testing local embedding generation...');
            const testEmbedding = await this.localEmbedding.generateEmbedding('test text');
            if (!testEmbedding || testEmbedding.length === 0) {
                throw new Error('Test embedding generation failed');
            }
            
            console.log(`Local embedding test successful: ${testEmbedding.length} dimensions`);
            
        } catch (error) {
            throw new Error(`Local embedding initialization failed: ${(error as Error).message}`);
        }
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
            } else if (this.config.provider === 'local') {
                return await this.generateLocalEmbedding(text);
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

    private async generateLocalEmbedding(text: string): Promise<number[]> {
        if (!this.localEmbedding) {
            throw new Error('Local embedding service not initialized');
        }
        
        try {
            // Truncate text to max tokens (rough estimate: 4 chars per token)
            const truncatedText = text.substring(0, this.config.maxTokens * 4);
            return await this.localEmbedding.generateEmbedding(truncatedText);
        } catch (error) {
            console.error('Local embedding generation failed:', error);
            throw error;
        }
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

    /**
     * Get cache directory information
     */
    getCacheInfo(): { path: string; exists: boolean; size?: number } {
        const cachePath = './.obsidian/plugins/obsidian-notes-chat/models';
        
        try {
            const fs = require('fs');
            const path = require('path');
            
            if (!fs.existsSync(cachePath)) {
                return { path: cachePath, exists: false };
            }
            
            // Calculate total size recursively
            function getDirectorySize(dirPath: string): number {
                let totalSize = 0;
                const items = fs.readdirSync(dirPath);
                
                for (const item of items) {
                    const fullPath = path.join(dirPath, item);
                    const stat = fs.statSync(fullPath);
                    
                    if (stat.isDirectory()) {
                        totalSize += getDirectorySize(fullPath);
                    } else {
                        totalSize += stat.size;
                    }
                }
                
                return totalSize;
            }
            
            const size = getDirectorySize(cachePath);
            return { path: cachePath, exists: true, size };
            
        } catch (error) {
            console.warn('Failed to get cache info:', error);
            return { path: cachePath, exists: false };
        }
    }

    /**
     * Clear all cached models
     */
    clearCache(): Promise<{ success: boolean; message: string; freedBytes?: number }> {
        return new Promise((resolve) => {
            try {
                const fs = require('fs');
                const path = require('path');
                
                const cachePath = './.obsidian/plugins/obsidian-notes-chat/models';
                
                if (!fs.existsSync(cachePath)) {
                    resolve({ success: true, message: 'Cache directory does not exist' });
                    return;
                }
                
                // Get size before deletion
                const cacheInfo = this.getCacheInfo();
                const freedBytes = cacheInfo.size || 0;
                
                // Recursively delete directory contents
                function deleteRecursive(dirPath: string) {
                    const items = fs.readdirSync(dirPath);
                    
                    for (const item of items) {
                        const fullPath = path.join(dirPath, item);
                        const stat = fs.statSync(fullPath);
                        
                        if (stat.isDirectory()) {
                            deleteRecursive(fullPath);
                            fs.rmdirSync(fullPath);
                        } else {
                            fs.unlinkSync(fullPath);
                        }
                    }
                }
                
                deleteRecursive(cachePath);
                
                // Reset embedding manager state
                this.isInitialized = false;
                this.localEmbedding?.destroy();
                this.localEmbedding = undefined;
                
                const freedMB = (freedBytes / 1024 / 1024).toFixed(1);
                resolve({ 
                    success: true, 
                    message: `Cache cleared successfully. Freed ${freedMB}MB.`,
                    freedBytes
                });
                
            } catch (error) {
                console.error('Failed to clear cache:', error);
                resolve({ 
                    success: false, 
                    message: `Failed to clear cache: ${(error as Error).message}`
                });
            }
        });
    }
}