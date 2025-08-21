import { TFile, Vault, MetadataCache, CachedMetadata } from 'obsidian';
import { EmbeddingManager, DocumentEmbedding, EmbeddingSearchResult } from './embeddings';

export interface KnowledgeGraphConfig {
    enabled: boolean;
    autoIndex: boolean;
    indexInterval: number; // minutes
    includeFolders: string[];
    excludeFolders: string[];
    fileTypes: string[];
    minContentLength: number;
    maxDocuments: number;
}

export interface DocumentNode {
    id: string;
    path: string;
    title: string;
    content: string;
    outlinks: string[];
    inlinks: string[];
    tags: string[];
    created: number;
    modified: number;
}

export interface GraphConnection {
    from: string;
    to: string;
    type: 'link' | 'tag' | 'semantic';
    strength: number;
}

export interface SearchContext {
    query: string;
    results: EmbeddingSearchResult[];
    context: string;
    relatedNotes: string[];
}

export class KnowledgeGraph {
    private config: KnowledgeGraphConfig;
    private embeddingManager: EmbeddingManager;
    private vault: Vault;
    private metadataCache: MetadataCache;
    
    private documents = new Map<string, DocumentNode>();
    private embeddings = new Map<string, DocumentEmbedding>();
    private connections = new Map<string, GraphConnection[]>();
    private indexTimer?: number;
    private isIndexing = false;
    
    private readonly STORAGE_KEY = 'chat-with-notes-knowledge-graph';

    constructor(
        config: KnowledgeGraphConfig,
        embeddingManager: EmbeddingManager,
        vault: Vault,
        metadataCache: MetadataCache
    ) {
        this.config = config;
        this.embeddingManager = embeddingManager;
        this.vault = vault;
        this.metadataCache = metadataCache;
        
        this.loadPersistedData();
        
        if (config.enabled && config.autoIndex) {
            this.startAutoIndexing();
        }
    }

    async initialize(): Promise<void> {
        if (!this.config.enabled) return;

        try {
            await this.embeddingManager.initialize();
            
            // Initial indexing if no data exists
            if (this.documents.size === 0) {
                await this.buildIndex();
            }
            
            console.log('Knowledge graph initialized successfully');
        } catch (error) {
            console.error('Failed to initialize knowledge graph:', error);
            throw error;
        }
    }

    async buildIndex(): Promise<void> {
        if (this.isIndexing || !this.config.enabled) return;
        
        this.isIndexing = true;
        console.log('Building knowledge graph index...');

        try {
            // Clear existing data
            this.documents.clear();
            this.embeddings.clear();
            this.connections.clear();

            // Get all markdown files
            const files = this.vault.getMarkdownFiles()
                .filter(file => this.shouldIncludeFile(file))
                .slice(0, this.config.maxDocuments);

            console.log(`Processing ${files.length} files...`);

            // Process files in batches
            const batchSize = 10;
            for (let i = 0; i < files.length; i += batchSize) {
                const batch = files.slice(i, i + batchSize);
                await this.processBatch(batch);
                
                // Progress update
                const progress = Math.min(100, Math.round(((i + batchSize) / files.length) * 100));
                console.log(`Indexing progress: ${progress}%`);
            }

            // Build connections
            this.buildConnections();
            
            // Persist data
            this.persistData();
            
            console.log(`Knowledge graph built: ${this.documents.size} documents, ${this.getTotalConnections()} connections`);
        } catch (error) {
            console.error('Failed to build knowledge graph:', error);
            throw error;
        } finally {
            this.isIndexing = false;
        }
    }

    private async processBatch(files: TFile[]): Promise<void> {
        const documents: DocumentNode[] = [];
        const contents: string[] = [];

        // Read all files in batch
        for (const file of files) {
            try {
                const content = await this.vault.read(file);
                const metadata = this.metadataCache.getFileCache(file);
                
                if (content.length < this.config.minContentLength) continue;

                const doc: DocumentNode = {
                    id: file.path,
                    path: file.path,
                    title: file.basename,
                    content: this.extractTextContent(content),
                    outlinks: this.extractLinks(metadata),
                    inlinks: [],
                    tags: this.extractTags(metadata),
                    created: file.stat.ctime,
                    modified: file.stat.mtime
                };

                documents.push(doc);
                contents.push(doc.content);
                this.documents.set(file.path, doc);
            } catch (error) {
                console.warn(`Failed to process file ${file.path}:`, error);
            }
        }

        // Generate embeddings for batch
        if (contents.length > 0) {
            try {
                const embeddings = await this.embeddingManager.generateEmbeddings(contents);
                
                documents.forEach((doc, index) => {
                    if (embeddings[index]) {
                        const embedding: DocumentEmbedding = {
                            id: doc.id,
                            path: doc.path,
                            title: doc.title,
                            content: doc.content,
                            embedding: embeddings[index],
                            metadata: {
                                created: doc.created,
                                modified: doc.modified,
                                size: doc.content.length,
                                tags: doc.tags,
                                links: doc.outlinks
                            }
                        };
                        
                        this.embeddings.set(doc.id, embedding);
                    }
                });
            } catch (error) {
                console.error('Failed to generate embeddings for batch:', error);
            }
        }
    }

    async searchSemantic(query: string, topK = 10, threshold = 0.5): Promise<SearchContext> {
        if (!this.config.enabled || !this.embeddingManager.isReady()) {
            return {
                query,
                results: [],
                context: '',
                relatedNotes: []
            };
        }

        try {
            // Generate query embedding
            const queryEmbedding = await this.embeddingManager.generateEmbedding(query);
            
            // Find similar documents
            const allEmbeddings = Array.from(this.embeddings.values());
            const results = this.embeddingManager.findMostSimilar(
                queryEmbedding, 
                allEmbeddings, 
                topK, 
                threshold
            );

            // Build context from top results
            const context = results
                .slice(0, 3)
                .map(result => `**${result.document.title}**:\n${result.document.content.substring(0, 300)}...`)
                .join('\n\n');

            const relatedNotes = results.map(result => result.document.path);

            return {
                query,
                results,
                context,
                relatedNotes
            };
        } catch (error) {
            console.error('Semantic search failed:', error);
            return {
                query,
                results: [],
                context: '',
                relatedNotes: []
            };
        }
    }

    async updateDocument(file: TFile): Promise<void> {
        if (!this.config.enabled || !this.shouldIncludeFile(file)) return;

        try {
            const content = await this.vault.read(file);
            const metadata = this.metadataCache.getFileCache(file);
            
            if (content.length < this.config.minContentLength) {
                this.removeDocument(file.path);
                return;
            }

            const textContent = this.extractTextContent(content);
            const embedding = await this.embeddingManager.generateEmbedding(textContent);

            const doc: DocumentNode = {
                id: file.path,
                path: file.path,
                title: file.basename,
                content: textContent,
                outlinks: this.extractLinks(metadata),
                inlinks: this.getInlinks(file.path),
                tags: this.extractTags(metadata),
                created: file.stat.ctime,
                modified: file.stat.mtime
            };

            const embeddingDoc: DocumentEmbedding = {
                id: file.path,
                path: file.path,
                title: file.basename,
                content: textContent,
                embedding,
                metadata: {
                    created: file.stat.ctime,
                    modified: file.stat.mtime,
                    size: textContent.length,
                    tags: doc.tags,
                    links: doc.outlinks
                }
            };

            this.documents.set(file.path, doc);
            this.embeddings.set(file.path, embeddingDoc);
            
            // Update connections
            this.updateConnections(file.path);
            this.persistData();
            
        } catch (error) {
            console.error(`Failed to update document ${file.path}:`, error);
        }
    }

    removeDocument(path: string): void {
        this.documents.delete(path);
        this.embeddings.delete(path);
        this.connections.delete(path);
        
        // Remove from other documents' connections
        for (const [, connections] of this.connections) {
            const filtered = connections.filter(conn => conn.to !== path && conn.from !== path);
            if (filtered.length !== connections.length) {
                // Update the map entry
                this.connections.set(path, filtered);
            }
        }
        
        this.persistData();
    }

    private shouldIncludeFile(file: TFile): boolean {
        // Check file type
        if (!this.config.fileTypes.includes(file.extension)) {
            return false;
        }

        // Check include/exclude folders
        const filePath = file.path;
        
        if (this.config.includeFolders.length > 0) {
            const isIncluded = this.config.includeFolders.some(folder => 
                filePath.startsWith(folder)
            );
            if (!isIncluded) return false;
        }

        if (this.config.excludeFolders.length > 0) {
            const isExcluded = this.config.excludeFolders.some(folder => 
                filePath.startsWith(folder)
            );
            if (isExcluded) return false;
        }

        return true;
    }

    private extractTextContent(content: string): string {
        // Remove markdown formatting and extract plain text
        return content
            .replace(/^#+\s*/gm, '') // Headers
            .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
            .replace(/\*(.*?)\*/g, '$1') // Italic
            .replace(/`(.*?)`/g, '$1') // Inline code
            .replace(/```[\s\S]*?```/g, '') // Code blocks
            .replace(/\[\[(.*?)\]\]/g, '$1') // Wiki links
            .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // Markdown links
            .replace(/^\s*[-*+]\s+/gm, '') // List items
            .replace(/^\s*\d+\.\s+/gm, '') // Numbered lists
            .replace(/^\s*>\s*/gm, '') // Blockquotes
            .replace(/\n{3,}/g, '\n\n') // Multiple newlines
            .trim();
    }

    private extractLinks(metadata: CachedMetadata | null): string[] {
        if (!metadata?.links) return [];
        
        return metadata.links
            .map(link => link.link)
            .filter(link => link && !link.startsWith('http'))
            .map(link => link.replace(/^\/+/, '').replace(/#.*$/, ''));
    }

    private extractTags(metadata: CachedMetadata | null): string[] {
        const tags: string[] = [];
        
        if (metadata?.tags) {
            tags.push(...metadata.tags.map(tag => tag.tag));
        }
        
        if (metadata?.frontmatter?.tags) {
            const frontmatterTags = metadata.frontmatter.tags;
            if (Array.isArray(frontmatterTags)) {
                tags.push(...frontmatterTags);
            } else if (typeof frontmatterTags === 'string') {
                tags.push(frontmatterTags);
            }
        }
        
        return [...new Set(tags)]; // Remove duplicates
    }

    private getInlinks(path: string): string[] {
        const inlinks: string[] = [];
        
        for (const [docPath, doc] of this.documents) {
            if (doc.outlinks.includes(path)) {
                inlinks.push(docPath);
            }
        }
        
        return inlinks;
    }

    private buildConnections(): void {
        this.connections.clear();
        
        for (const [path, doc] of this.documents) {
            const connections: GraphConnection[] = [];
            
            // Link connections
            for (const outlink of doc.outlinks) {
                if (this.documents.has(outlink)) {
                    connections.push({
                        from: path,
                        to: outlink,
                        type: 'link',
                        strength: 1.0
                    });
                }
            }
            
            // Tag connections
            for (const [otherPath, otherDoc] of this.documents) {
                if (path === otherPath) continue;
                
                const sharedTags = doc.tags.filter(tag => otherDoc.tags.includes(tag));
                if (sharedTags.length > 0) {
                    connections.push({
                        from: path,
                        to: otherPath,
                        type: 'tag',
                        strength: sharedTags.length / Math.max(doc.tags.length, otherDoc.tags.length)
                    });
                }
            }
            
            this.connections.set(path, connections);
        }
    }

    private updateConnections(path: string): void {
        const doc = this.documents.get(path);
        if (!doc) return;
        
        const connections: GraphConnection[] = [];
        
        // Link connections
        for (const outlink of doc.outlinks) {
            if (this.documents.has(outlink)) {
                connections.push({
                    from: path,
                    to: outlink,
                    type: 'link',
                    strength: 1.0
                });
            }
        }
        
        // Tag connections
        for (const [otherPath, otherDoc] of this.documents) {
            if (path === otherPath) continue;
            
            const sharedTags = doc.tags.filter(tag => otherDoc.tags.includes(tag));
            if (sharedTags.length > 0) {
                connections.push({
                    from: path,
                    to: otherPath,
                    type: 'tag',
                    strength: sharedTags.length / Math.max(doc.tags.length, otherDoc.tags.length)
                });
            }
        }
        
        this.connections.set(path, connections);
    }

    private startAutoIndexing(): void {
        if (this.indexTimer) {
            clearInterval(this.indexTimer);
        }
        
        this.indexTimer = (window as any).setInterval(() => {
            if (!this.isIndexing) {
                this.buildIndex();
            }
        }, this.config.indexInterval * 60 * 1000) as number;
    }

    private persistData(): void {
        try {
            const data = {
                documents: Array.from(this.documents.entries()),
                embeddings: Array.from(this.embeddings.entries()),
                connections: Array.from(this.connections.entries()),
                lastUpdated: Date.now()
            };
            
            (window as any).localStorage?.setItem(this.STORAGE_KEY, JSON.stringify(data));
        } catch (error) {
            console.error('Failed to persist knowledge graph data:', error);
        }
    }

    private loadPersistedData(): void {
        try {
            const stored = (window as any).localStorage?.getItem(this.STORAGE_KEY);
            if (!stored) return;
            
            const data = JSON.parse(stored);
            
            if (data.documents) {
                this.documents = new Map(data.documents);
            }
            
            if (data.embeddings) {
                this.embeddings = new Map(data.embeddings);
            }
            
            if (data.connections) {
                this.connections = new Map(data.connections);
            }
            
        } catch (error) {
            console.error('Failed to load persisted knowledge graph data:', error);
        }
    }

    getStats(): {
        documentsCount: number;
        embeddingsCount: number;
        connectionsCount: number;
        isIndexing: boolean;
        lastUpdated?: number;
    } {
        return {
            documentsCount: this.documents.size,
            embeddingsCount: this.embeddings.size,
            connectionsCount: this.getTotalConnections(),
            isIndexing: this.isIndexing,
            lastUpdated: this.getLastUpdated()
        };
    }

    private getTotalConnections(): number {
        let total = 0;
        for (const connections of this.connections.values()) {
            total += connections.length;
        }
        return total;
    }

    private getLastUpdated(): number | undefined {
        try {
            const stored = (window as any).localStorage?.getItem(this.STORAGE_KEY);
            if (stored) {
                const data = JSON.parse(stored);
                return data.lastUpdated;
            }
        } catch (error) {
            // Ignore
        }
        return undefined;
    }

    updateConfig(newConfig: Partial<KnowledgeGraphConfig>): void {
        const wasEnabled = this.config.enabled;
        this.config = { ...this.config, ...newConfig };
        
        if (!wasEnabled && this.config.enabled) {
            this.initialize();
        } else if (wasEnabled && !this.config.enabled) {
            if (this.indexTimer) {
                clearInterval(this.indexTimer);
                this.indexTimer = undefined;
            }
        }
        
        if (this.config.enabled && this.config.autoIndex && !this.indexTimer) {
            this.startAutoIndexing();
        } else if (this.indexTimer && !this.config.autoIndex) {
            clearInterval(this.indexTimer);
            this.indexTimer = undefined;
        }
    }

    destroy(): void {
        if (this.indexTimer) {
            clearInterval(this.indexTimer);
        }
        
        this.documents.clear();
        this.embeddings.clear();
        this.connections.clear();
    }
}