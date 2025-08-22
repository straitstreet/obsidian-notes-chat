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
    size: number; // For change detection
    contentHash: string; // For change detection
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
            console.log('Initializing knowledge graph...');
            
            // Try to initialize embeddings (this won't throw anymore)
            await this.embeddingManager.initialize();
            
            const embeddingsReady = this.embeddingManager.isReady();
            if (embeddingsReady) {
                console.log('Embeddings ready - using semantic search capabilities');
            } else {
                console.log('Embeddings not available - using text search only');
            }
            
            // Initial indexing if no data exists
            if (this.documents.size === 0 || (embeddingsReady && this.embeddings.size === 0)) {
                console.log(`Building initial index: ${this.documents.size} documents, ${this.embeddings.size} embeddings`);
                if (embeddingsReady) {
                    await this.buildIndex(); // Full index with embeddings
                } else {
                    await this.buildBasicIndex(); // Text-only index
                }
            } else {
                console.log(`Using cached index: ${this.documents.size} documents, ${this.embeddings.size} embeddings`);
            }
            
            console.log(`Knowledge graph initialized successfully (${embeddingsReady ? 'with semantic search' : 'text search only'})`);
            
        } catch (error) {
            console.error('Failed to initialize knowledge graph:', error);
            console.warn('Knowledge graph will run in basic text-only mode');
            
            // Fall back to basic functionality
            if (this.documents.size === 0) {
                try {
                    await this.buildBasicIndex();
                    console.log('Basic knowledge graph ready');
                } catch (basicError) {
                    console.error('Failed to build even basic index:', basicError);
                }
            }
        }
    }
    
    // Fallback method that builds index without embeddings
    private async buildBasicIndex(): Promise<void> {
        console.log('Building basic index without embeddings...');
        
        try {
            const files = this.vault.getMarkdownFiles();
            let processedCount = 0;
            
            for (const file of files) {
                if (this.shouldIncludeFile(file)) {
                    const content = await this.vault.read(file);
                    const node = await this.createDocumentNode(file, content);
                    this.documents.set(file.path, node);
                    processedCount++;
                }
            }
            
            console.log(`Basic index built successfully: ${processedCount} documents (text search only)`);
            this.persistData();
        } catch (error) {
            console.error('Failed to build basic index:', error);
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
                    modified: file.stat.mtime,
                    size: file.stat.size,
                    contentHash: await this.generateContentHash(content)
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
        if (!this.config.enabled) {
            return {
                query,
                results: [],
                context: '',
                relatedNotes: []
            };
        }

        // Try semantic search first if embeddings are available
        if (this.embeddingManager.isReady() && this.embeddings.size > 0) {
            try {
                console.log('Using semantic search with embeddings');
                
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
                    .map((result: any) => `**${result.document.title}**:\n${result.document.content.substring(0, 300)}...`)
                    .join('\n\n');

                const relatedNotes = results.map((result: any) => result.document.path);

                return {
                    query,
                    results,
                    context,
                    relatedNotes
                };
            } catch (error) {
                console.error('Semantic search failed, falling back to text search:', error);
            }
        }

        // Fallback to basic text search when semantic search isn't available
        console.log('Using fallback text search instead of semantic search');
        return await this.searchText(query, topK);
    }

    /**
     * Text-based search fallback when semantic search isn't available
     */
    async searchText(query: string, maxResults = 10): Promise<SearchContext> {
        if (!this.config.enabled) {
            return { query, results: [], context: '', relatedNotes: [] };
        }

        const results: Array<{ document: any; similarity: number; score: number }> = [];
        const searchQuery = query.toLowerCase();
        
        for (const [, doc] of this.documents) {
            const content = doc.content.toLowerCase();
            const matches: Array<{ context: string; position: number }> = [];
            
            let position = content.indexOf(searchQuery, 0);
            while (position !== -1 && matches.length < 3) { // Max 3 matches per document
                const contextStart = Math.max(0, position - 100);
                const contextEnd = Math.min(content.length, position + searchQuery.length + 100);
                const context = doc.content.substring(contextStart, contextEnd);
                
                matches.push({
                    context: contextStart > 0 ? '...' + context : context,
                    position
                });
                
                position = content.indexOf(searchQuery, position + 1);
            }
            
            if (matches.length > 0) {
                // Create mock embedding result for consistency
                results.push({
                    document: {
                        id: doc.id,
                        path: doc.path,
                        title: doc.title,
                        content: matches[0].context, // Use first match context
                        embedding: [],
                        metadata: {
                            created: doc.created,
                            modified: doc.modified,
                            size: doc.size,
                            tags: doc.tags,
                            links: doc.outlinks
                        }
                    },
                    similarity: matches.length * 0.1, // Simple scoring based on match count
                    score: matches.length
                });
            }
        }
        
        // Sort by number of matches, then by recency
        results.sort((a, b) => {
            if (a.score !== b.score) {
                return b.score - a.score;
            }
            return b.document.metadata.modified - a.document.metadata.modified;
        });
        
        const limitedResults = results.slice(0, maxResults);
        const context = limitedResults
            .slice(0, 3)
            .map(result => `**${result.document.title}**:\n${result.document.content}`)
            .join('\n\n');
        
        const relatedNotes = limitedResults.map(result => result.document.path);
        
        return {
            query,
            results: limitedResults,
            context,
            relatedNotes
        };
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
                modified: file.stat.mtime,
                size: file.stat.size,
                contentHash: await this.generateContentHash(content)
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
        
        // Run smart incremental reindexing every hour
        this.indexTimer = (window as any).setInterval(async () => {
            if (!this.isIndexing) {
                console.log('Starting hourly incremental reindex...');
                await this.performIncrementalIndex();
            }
        }, this.config.indexInterval * 60 * 1000) as number;
        
        console.log(`Auto-indexing started: checking for changes every ${this.config.indexInterval} minutes`);
    }

    /**
     * Performs smart incremental indexing - only processes changed files
     */
    private async performIncrementalIndex(): Promise<void> {
        if (!this.config.enabled || this.isIndexing) return;
        
        this.isIndexing = true;
        const startTime = Date.now();
        
        try {
            console.log('🔄 Starting incremental index scan...');
            
            const files = this.vault.getMarkdownFiles();
            const filesToUpdate: TFile[] = [];
            const filesToRemove: string[] = [];
            
            // Check for modified or new files
            for (const file of files) {
                if (this.shouldIncludeFile(file)) {
                    const existingDoc = this.documents.get(file.path);
                    
                    if (!existingDoc) {
                        // New file
                        filesToUpdate.push(file);
                        console.log(`📄 New file detected: ${file.path}`);
                    } else if (file.stat.mtime > existingDoc.modified || file.stat.size !== existingDoc.size) {
                        // Modified file
                        filesToUpdate.push(file);
                        console.log(`✏️ Modified file detected: ${file.path}`);
                    }
                }
            }
            
            // Check for deleted files
            const existingPaths = new Set(files.map(f => f.path));
            for (const [path] of this.documents) {
                if (!existingPaths.has(path)) {
                    filesToRemove.push(path);
                    console.log(`🗑️ Deleted file detected: ${path}`);
                }
            }
            
            const totalChanges = filesToUpdate.length + filesToRemove.length;
            
            if (totalChanges === 0) {
                console.log('✅ No changes detected - index is up to date');
                return;
            }
            
            console.log(`📊 Processing ${totalChanges} changes (${filesToUpdate.length} updates, ${filesToRemove.length} removals)`);
            
            // Remove deleted files
            for (const path of filesToRemove) {
                this.documents.delete(path);
                this.embeddings.delete(path);
                this.connections.delete(path);
            }
            
            // Update modified/new files
            let processedCount = 0;
            for (const file of filesToUpdate) {
                try {
                    const content = await this.vault.read(file);
                    const contentHash = await this.generateContentHash(content);
                    
                    // Double-check if content actually changed
                    const existingDoc = this.documents.get(file.path);
                    if (existingDoc && existingDoc.contentHash === contentHash) {
                        console.log(`⏭️ Skipping ${file.path} - content unchanged despite stat difference`);
                        continue;
                    }
                    
                    // Process the file
                    await this.processFile(file, content, contentHash);
                    processedCount++;
                    
                    // Add small delay to prevent UI blocking
                    if (processedCount % 5 === 0) {
                        await new Promise(resolve => setTimeout(resolve, 10));
                    }
                    
                } catch (error) {
                    console.error(`Failed to process file ${file.path}:`, error);
                }
            }
            
            // Update connections for all affected files
            console.log('🔗 Updating document connections...');
            this.updateAllConnections();
            
            // Persist the updated data
            this.persistData();
            
            const duration = Date.now() - startTime;
            const stats = this.getStats();
            
            console.log(`✅ Incremental index complete: ${processedCount} files processed in ${duration}ms`);
            console.log(`📈 Index stats: ${stats.documentsCount} documents, ${stats.embeddingsCount} embeddings`);
            
        } catch (error) {
            console.error('❌ Incremental indexing failed:', error);
        } finally {
            this.isIndexing = false;
        }
    }
    
    /**
     * Processes a single file during incremental indexing
     */
    private async processFile(file: TFile, content: string, contentHash: string): Promise<void> {
        const node = await this.createDocumentNode(file, content);
        node.contentHash = contentHash;
        
        this.documents.set(file.path, node);
        
        // Generate embeddings if embedding manager is ready
        if (this.embeddingManager.isReady()) {
            try {
                const embedding = await this.embeddingManager.generateEmbedding(content);
                const embeddingDoc = {
                    id: node.id,
                    path: file.path,
                    title: node.title,
                    content: content.substring(0, 1000), // Store first 1000 chars for context
                    embedding,
                    metadata: {
                        created: node.created,
                        modified: node.modified,
                        size: node.size,
                        tags: node.tags,
                        links: node.outlinks
                    }
                };
                
                this.embeddings.set(file.path, embeddingDoc);
            } catch (error) {
                console.error(`Failed to generate embedding for ${file.path}:`, error);
            }
        }
    }
    
    /**
     * Creates a DocumentNode from a TFile and its content
     */
    private async createDocumentNode(file: TFile, content: string): Promise<DocumentNode> {
        const metadata = this.metadataCache.getFileCache(file);
        
        return {
            id: file.path,
            path: file.path,
            title: file.basename,
            content: this.extractTextContent(content),
            outlinks: this.extractLinks(metadata),
            inlinks: [], // Will be updated during connection building
            tags: this.extractTags(metadata),
            created: file.stat.ctime,
            modified: file.stat.mtime,
            size: file.stat.size,
            contentHash: await this.generateContentHash(content)
        };
    }

    /**
     * Generates a simple hash of content for change detection
     */
    private async generateContentHash(content: string): Promise<string> {
        // Simple hash function for change detection
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(36);
    }

    /**
     * Updates all document connections - alias for buildConnections
     */
    private updateAllConnections(): void {
        this.buildConnections();
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