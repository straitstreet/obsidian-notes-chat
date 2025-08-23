import { App, TFile, TFolder, WorkspaceLeaf } from 'obsidian';

export interface VaultStructure {
    totalFiles: number;
    totalFolders: number;
    folders: FolderInfo[];
    tags: string[];
    recentFiles: string[];
    openFiles: string[];
    activeFile?: string;
}

export interface FolderInfo {
    name: string;
    path: string;
    fileCount: number;
    subfolders: string[];
    tags: string[];
}

/**
 * Manages contextual information about the vault structure, open files, and user activity
 * to provide better context to LLM queries for more intelligent search and responses.
 */
export class VaultContextManager {
    private app: App;
    private maxContextTokens: number;

    constructor(app: App, maxContextTokens = 2000) {
        this.app = app;
        this.maxContextTokens = maxContextTokens;
    }

    /**
     * Get comprehensive vault structure context for LLM queries
     */
    async getVaultContext(): Promise<VaultStructure> {
        const files = this.app.vault.getMarkdownFiles();
        const folders = this.getAllFolders();
        
        return {
            totalFiles: files.length,
            totalFolders: folders.length,
            folders: await this.getFolderStructure(folders),
            tags: this.extractAllTags(),
            recentFiles: this.getRecentFiles(10),
            openFiles: this.getOpenFiles(),
            activeFile: this.getActiveFile()
        };
    }

    /**
     * Generate a concise context summary for LLM system prompts
     */
    async getContextSummary(): Promise<string> {
        const context = await this.getVaultContext();
        
        let summary = `**Vault Context:**\n`;
        summary += `📁 ${context.totalFiles} notes across ${context.totalFolders} folders\n`;
        
        // Top-level folder structure
        const topFolders = context.folders
            .filter(f => !f.path.includes('/'))
            .slice(0, 8) // Limit to prevent token overflow
            .map(f => `${f.name}(${f.fileCount})`)
            .join(', ');
        if (topFolders) {
            summary += `📂 Main folders: ${topFolders}\n`;
        }

        // Common tags
        if (context.tags.length > 0) {
            const topTags = context.tags.slice(0, 10).join(', ');
            summary += `🏷️ Common tags: ${topTags}\n`;
        }

        // Currently open files (most relevant context)
        if (context.openFiles.length > 0) {
            summary += `📖 Open files: ${context.openFiles.slice(0, 5).join(', ')}\n`;
        }

        // Active file (highest priority context)
        if (context.activeFile) {
            summary += `✨ Active file: ${context.activeFile}\n`;
        }

        // Recent activity
        if (context.recentFiles.length > 0) {
            summary += `⏰ Recent files: ${context.recentFiles.slice(0, 3).join(', ')}\n`;
        }

        return summary;
    }

    /**
     * Get context specific to a search query to help LLM understand user intent
     */
    async getSearchContext(query: string): Promise<string> {
        const context = await this.getVaultContext();
        let searchContext = '';

        // If query matches folder names, provide folder context
        const matchingFolders = context.folders.filter(f => 
            query.toLowerCase().includes(f.name.toLowerCase()) ||
            f.name.toLowerCase().includes(query.toLowerCase())
        );

        if (matchingFolders.length > 0) {
            searchContext += `🎯 Relevant folders for "${query}": ${matchingFolders.map(f => `${f.name}(${f.fileCount} files)`).join(', ')}\n`;
        }

        // If query matches tags, provide tag context  
        const matchingTags = context.tags.filter(tag =>
            query.toLowerCase().includes(tag.toLowerCase()) ||
            tag.toLowerCase().includes(query.toLowerCase())
        );

        if (matchingTags.length > 0) {
            searchContext += `🏷️ Related tags: ${matchingTags.slice(0, 5).join(', ')}\n`;
        }

        // If user is currently working on related files, mention them
        if (context.activeFile || context.openFiles.length > 0) {
            const workingFiles = [context.activeFile, ...context.openFiles].filter(Boolean);
            const relatedFiles = workingFiles.filter(file => 
                file && (
                    file.toLowerCase().includes(query.toLowerCase()) ||
                    query.toLowerCase().includes(file.toLowerCase().replace('.md', ''))
                )
            );

            if (relatedFiles.length > 0) {
                searchContext += `🔄 Currently working on related: ${relatedFiles.slice(0, 3).join(', ')}\n`;
            }
        }

        return searchContext;
    }

    private getAllFolders(): TFolder[] {
        const folders: TFolder[] = [];
        
        function collectFolders(folder: TFolder) {
            folders.push(folder);
            for (const child of folder.children) {
                if (child instanceof TFolder) {
                    collectFolders(child);
                }
            }
        }

        const rootFolder = this.app.vault.getRoot();
        for (const child of rootFolder.children) {
            if (child instanceof TFolder) {
                collectFolders(child);
            }
        }

        return folders;
    }

    private async getFolderStructure(folders: TFolder[]): Promise<FolderInfo[]> {
        const folderInfo: FolderInfo[] = [];

        for (const folder of folders) {
            const files = folder.children.filter(child => child instanceof TFile) as TFile[];
            const subfolders = folder.children
                .filter(child => child instanceof TFolder)
                .map(child => child.name);

            // Extract tags from files in this folder
            const tags = new Set<string>();
            for (const file of files) {
                const cache = this.app.metadataCache.getFileCache(file);
                if (cache?.tags) {
                    cache.tags.forEach(tag => tags.add(tag.tag.replace('#', '')));
                }
            }

            folderInfo.push({
                name: folder.name,
                path: folder.path,
                fileCount: files.length,
                subfolders,
                tags: Array.from(tags).slice(0, 5) // Limit tags per folder
            });
        }

        return folderInfo;
    }

    private extractAllTags(): string[] {
        const tags = new Set<string>();
        const files = this.app.vault.getMarkdownFiles();

        for (const file of files) {
            const cache = this.app.metadataCache.getFileCache(file);
            if (cache?.tags) {
                cache.tags.forEach(tag => {
                    tags.add(tag.tag.replace('#', ''));
                });
            }
        }

        return Array.from(tags).slice(0, 20); // Limit total tags
    }

    private getRecentFiles(limit = 10): string[] {
        const files = this.app.vault.getMarkdownFiles()
            .sort((a, b) => b.stat.mtime - a.stat.mtime)
            .slice(0, limit)
            .map(file => file.basename);

        return files;
    }

    private getOpenFiles(): string[] {
        const openFiles: string[] = [];
        
        // Get all open tabs
        this.app.workspace.iterateAllLeaves((leaf: WorkspaceLeaf) => {
            if (leaf.view.getViewType() === 'markdown') {
                const file = (leaf.view as any).file;
                if (file && file.basename) {
                    openFiles.push(file.basename);
                }
            }
        });

        return [...new Set(openFiles)]; // Remove duplicates
    }

    private getActiveFile(): string | undefined {
        const activeFile = this.app.workspace.getActiveFile();
        return activeFile?.basename;
    }

    /**
     * Get a smart context window that fits within token limits
     */
    async getSmartContext(query?: string): Promise<string> {
        let context = await this.getContextSummary();
        
        if (query) {
            const searchContext = await this.getSearchContext(query);
            if (searchContext) {
                context += `\n${searchContext}`;
            }
        }

        // Rough token estimation (4 chars ≈ 1 token)
        const estimatedTokens = context.length / 4;
        
        if (estimatedTokens > this.maxContextTokens) {
            // Truncate context to fit within limits
            const targetChars = this.maxContextTokens * 4;
            context = context.substring(0, targetChars) + '...';
        }

        return context;
    }
}