import { KnowledgeGraph, DocumentNode } from '../kb/knowledge-graph';
import { EmbeddingSearchResult } from '../kb/embeddings';

/**
 * Interface for agent tools that can be used to search and retrieve information
 */
export interface AgentTool {
    /** Unique identifier for the tool */
    name: string;
    /** Human-readable description of what the tool does */
    description: string;
    /** JSON schema describing the tool's parameters */
    parameters: any;
    /** Function that executes the tool with given parameters */
    execute: (params: any) => Promise<any>;
}

/**
 * Represents a single tool call made by the agent
 */
export interface AgentToolCall {
    /** Name of the tool that was called */
    toolName: string;
    /** Parameters passed to the tool */
    parameters: any;
    /** Result returned by the tool (undefined if not yet executed) */
    result?: any;
}

/**
 * Response from the agent after processing a query
 */
export interface AgentResponse {
    /** Final answer content for the user */
    content: string;
    /** List of all tool calls made during processing */
    toolCalls: AgentToolCall[];
    /** Whether the agent has finished processing */
    finished: boolean;
}

/**
 * Factory class for creating knowledge graph search tools.
 * 
 * This class provides 8 specialized tools that the AI agent can use to search
 * and retrieve information from the user's notes:
 * 
 * 1. semantic_search - Vector similarity search using embeddings
 * 2. text_search - Exact text matching with context
 * 3. search_recent_notes - Date-sorted with content filtering
 * 4. search_by_date - Time range queries with flexible date parsing
 * 5. find_specific_info - Pattern matching for VINs, phones, emails, etc.
 * 6. search_by_tags - Tag-based filtering
 * 7. search_by_links - Link relationship mapping
 * 8. get_note_details - Complete note information retrieval
 * 
 * @example
 * ```typescript
 * const tools = new KnowledgeGraphTools(knowledgeGraph);
 * const availableTools = tools.getTools();
 * 
 * // Execute a specific tool
 * const searchTool = availableTools.find(t => t.name === 'semantic_search');
 * const result = await searchTool.execute({ query: 'love', topK: 5 });
 * ```
 */
export class KnowledgeGraphTools {
    /**
     * Creates a new KnowledgeGraphTools instance.
     * 
     * @param knowledgeGraph - The knowledge graph containing indexed documents
     */
    constructor(private knowledgeGraph: KnowledgeGraph) {}

    /**
     * Returns all available search tools that the agent can use.
     * 
     * @returns Array of AgentTool instances, each providing a specific search capability
     */
    getTools(): AgentTool[] {
        return [
            {
                name: 'semantic_search',
                description: 'Search for notes using semantic similarity (or text search as fallback if embeddings unavailable)',
                parameters: {
                    type: 'object',
                    properties: {
                        query: { type: 'string', description: 'The search query or question' },
                        topK: { type: 'number', description: 'Number of results to return (default: 5)' },
                        threshold: { type: 'number', description: 'Minimum similarity threshold (default: 0.3)' }
                    },
                    required: ['query']
                },
                execute: async (params) => {
                    const { query, topK = 5, threshold = 0.3 } = params;
                    const results = await this.knowledgeGraph.searchSemantic(query, topK, threshold);
                    
                    return {
                        query,
                        found: results.results.length,
                        results: results.results.map(r => ({
                            title: r.document.title,
                            path: r.document.path,
                            similarity: r.similarity,
                            content_preview: r.document.content.substring(0, 200) + '...'
                        })),
                        context: results.context
                    };
                }
            },
            {
                name: 'text_search',
                description: 'Search for exact text matches in note content and titles (fallback when semantic search fails)',
                parameters: {
                    type: 'object',
                    properties: {
                        query: { type: 'string', description: 'The text to search for' },
                        topK: { type: 'number', description: 'Number of results to return (default: 5)' }
                    },
                    required: ['query']
                },
                execute: async (params) => {
                    const { query, topK = 5 } = params;
                    const results = await this.knowledgeGraph.searchText(query, topK);
                    
                    return {
                        query,
                        found: results.results.length,
                        results: results.results.map(r => ({
                            title: r.document.title,
                            path: r.document.path,
                            score: r.score,
                            content_preview: r.document.content.substring(0, 200) + '...'
                        })),
                        context: results.context
                    };
                }
            },
            {
                name: 'search_by_tags',
                description: 'Find notes that have specific tags',
                parameters: {
                    type: 'object',
                    properties: {
                        tags: { 
                            type: 'array', 
                            items: { type: 'string' },
                            description: 'List of tags to search for' 
                        },
                        require_all: { 
                            type: 'boolean', 
                            description: 'If true, require all tags; if false, require any tag (default: false)' 
                        }
                    },
                    required: ['tags']
                },
                execute: async (params) => {
                    const { tags, require_all = false } = params;
                    return this.searchByTags(tags, require_all);
                }
            },
            {
                name: 'search_by_links',
                description: 'Find notes that link to or are linked from a specific note',
                parameters: {
                    type: 'object',
                    properties: {
                        note_path: { type: 'string', description: 'Path of the note to find connections for' },
                        direction: { 
                            type: 'string', 
                            enum: ['incoming', 'outgoing', 'both'],
                            description: 'Direction of links to search (default: both)' 
                        }
                    },
                    required: ['note_path']
                },
                execute: async (params) => {
                    const { note_path, direction = 'both' } = params;
                    return this.searchByLinks(note_path, direction);
                }
            },
            {
                name: 'get_note_details',
                description: 'Get detailed information about a specific note',
                parameters: {
                    type: 'object',
                    properties: {
                        note_path: { type: 'string', description: 'Path of the note to get details for' }
                    },
                    required: ['note_path']
                },
                execute: async (params) => {
                    const { note_path } = params;
                    return this.getNoteDetails(note_path);
                }
            },
            {
                name: 'explore_connections',
                description: 'Explore the network of connections around a note',
                parameters: {
                    type: 'object',
                    properties: {
                        note_path: { type: 'string', description: 'Path of the note to explore connections from' },
                        max_depth: { type: 'number', description: 'Maximum depth of connections to explore (default: 2)' },
                        connection_types: {
                            type: 'array',
                            items: { type: 'string', enum: ['link', 'tag', 'semantic'] },
                            description: 'Types of connections to explore (default: all)'
                        }
                    },
                    required: ['note_path']
                },
                execute: async (params) => {
                    const { note_path, max_depth = 2, connection_types = ['link', 'tag', 'semantic'] } = params;
                    return this.exploreConnections(note_path, max_depth, connection_types);
                }
            },
            {
                name: 'text_search',
                description: 'Search for exact text matches within note content (case-insensitive)',
                parameters: {
                    type: 'object',
                    properties: {
                        query: { type: 'string', description: 'The exact text or phrase to search for' },
                        case_sensitive: { type: 'boolean', description: 'Whether to perform case-sensitive search (default: false)' },
                        max_results: { type: 'number', description: 'Maximum number of results to return (default: 10)' }
                    },
                    required: ['query']
                },
                execute: async (params) => {
                    const { query, case_sensitive = false, max_results = 10 } = params;
                    return this.textSearch(query, case_sensitive, max_results);
                }
            },
            {
                name: 'search_by_date',
                description: 'Find notes created or modified within a specific time period',
                parameters: {
                    type: 'object',
                    properties: {
                        date_type: { 
                            type: 'string', 
                            enum: ['created', 'modified', 'both'],
                            description: 'Which date to search by (default: modified)' 
                        },
                        start_date: { type: 'string', description: 'Start date (ISO format or relative like "7 days ago")' },
                        end_date: { type: 'string', description: 'End date (ISO format or relative like "today")' },
                        sort_order: {
                            type: 'string',
                            enum: ['newest', 'oldest'],
                            description: 'How to sort results (default: newest)'
                        },
                        max_results: { type: 'number', description: 'Maximum number of results (default: 20)' }
                    },
                    required: []
                },
                execute: async (params) => {
                    const { 
                        date_type = 'modified', 
                        start_date, 
                        end_date, 
                        sort_order = 'newest',
                        max_results = 20 
                    } = params;
                    return this.searchByDate(date_type, start_date, end_date, sort_order, max_results);
                }
            },
            {
                name: 'find_specific_info',
                description: 'Search for specific types of information like VINs, phone numbers, emails, addresses, etc.',
                parameters: {
                    type: 'object',
                    properties: {
                        info_type: {
                            type: 'string',
                            enum: ['vin', 'phone', 'email', 'address', 'url', 'number', 'date'],
                            description: 'Type of information to search for'
                        },
                        pattern: { type: 'string', description: 'Custom regex pattern to search for (optional)' },
                        context_words: { type: 'number', description: 'Number of words to include around matches (default: 10)' }
                    },
                    required: ['info_type']
                },
                execute: async (params) => {
                    const { info_type, pattern, context_words = 10 } = params;
                    return this.findSpecificInfo(info_type, pattern, context_words);
                }
            },
            {
                name: 'search_recent_notes',
                description: 'Find the most recently created or modified notes, optionally filtered by content',
                parameters: {
                    type: 'object',
                    properties: {
                        count: { type: 'number', description: 'Number of recent notes to return (default: 10)' },
                        content_filter: { type: 'string', description: 'Optional text that must appear in the notes' },
                        date_type: {
                            type: 'string',
                            enum: ['created', 'modified'],
                            description: 'Sort by creation or modification date (default: modified)'
                        },
                        days_back: { type: 'number', description: 'Only include notes from the last N days' }
                    },
                    required: []
                },
                execute: async (params) => {
                    const { count = 10, content_filter, date_type = 'modified', days_back } = params;
                    return this.searchRecentNotes(count, content_filter, date_type, days_back);
                }
            }
        ];
    }

    private async searchByTags(tags: string[], requireAll: boolean = false): Promise<any> {
        const documents = (this.knowledgeGraph as any).documents as Map<string, DocumentNode>;
        const results: DocumentNode[] = [];
        
        for (const [, doc] of documents) {
            const hasRequiredTags = requireAll 
                ? tags.every(tag => doc.tags.includes(tag))
                : tags.some(tag => doc.tags.includes(tag));
                
            if (hasRequiredTags) {
                results.push(doc);
            }
        }
        
        return {
            search_tags: tags,
            require_all: requireAll,
            found: results.length,
            results: results.map(doc => ({
                title: doc.title,
                path: doc.path,
                tags: doc.tags,
                content_preview: doc.content.substring(0, 200) + '...'
            }))
        };
    }

    private async searchByLinks(notePath: string, direction: 'incoming' | 'outgoing' | 'both'): Promise<any> {
        const documents = (this.knowledgeGraph as any).documents as Map<string, DocumentNode>;
        const targetDoc = documents.get(notePath);
        
        if (!targetDoc) {
            return { error: `Note not found: ${notePath}` };
        }
        
        const results: { direction: string; notes: DocumentNode[] } = {
            direction,
            notes: []
        };
        
        if (direction === 'outgoing' || direction === 'both') {
            for (const linkPath of targetDoc.outlinks) {
                const linkedDoc = documents.get(linkPath);
                if (linkedDoc) {
                    results.notes.push(linkedDoc);
                }
            }
        }
        
        if (direction === 'incoming' || direction === 'both') {
            for (const linkPath of targetDoc.inlinks) {
                const linkedDoc = documents.get(linkPath);
                if (linkedDoc) {
                    results.notes.push(linkedDoc);
                }
            }
        }
        
        // Remove duplicates
        const uniqueNotes = results.notes.filter((note, index, arr) => 
            arr.findIndex(n => n.path === note.path) === index
        );
        
        return {
            source_note: {
                title: targetDoc.title,
                path: targetDoc.path
            },
            direction,
            found: uniqueNotes.length,
            linked_notes: uniqueNotes.map(doc => ({
                title: doc.title,
                path: doc.path,
                content_preview: doc.content.substring(0, 200) + '...'
            }))
        };
    }

    private async getNoteDetails(notePath: string): Promise<any> {
        const documents = (this.knowledgeGraph as any).documents as Map<string, DocumentNode>;
        const connections = (this.knowledgeGraph as any).connections as Map<string, any[]>;
        
        const doc = documents.get(notePath);
        if (!doc) {
            return { error: `Note not found: ${notePath}` };
        }
        
        const nodeConnections = connections.get(notePath) || [];
        
        return {
            title: doc.title,
            path: doc.path,
            content: doc.content,
            tags: doc.tags,
            outgoing_links: doc.outlinks,
            incoming_links: doc.inlinks,
            created: new Date(doc.created).toISOString(),
            modified: new Date(doc.modified).toISOString(),
            connections: {
                total: nodeConnections.length,
                by_type: {
                    link: nodeConnections.filter(c => c.type === 'link').length,
                    tag: nodeConnections.filter(c => c.type === 'tag').length,
                    semantic: nodeConnections.filter(c => c.type === 'semantic').length
                }
            }
        };
    }

    private async exploreConnections(
        notePath: string, 
        maxDepth: number, 
        connectionTypes: string[]
    ): Promise<any> {
        const documents = (this.knowledgeGraph as any).documents as Map<string, DocumentNode>;
        const connections = (this.knowledgeGraph as any).connections as Map<string, any[]>;
        
        const startDoc = documents.get(notePath);
        if (!startDoc) {
            return { error: `Note not found: ${notePath}` };
        }
        
        const visited = new Set<string>();
        const network: any = {
            center: {
                title: startDoc.title,
                path: startDoc.path
            },
            levels: []
        };
        
        let currentLevel = [notePath];
        visited.add(notePath);
        
        for (let depth = 0; depth < maxDepth && currentLevel.length > 0; depth++) {
            const nextLevel: string[] = [];
            const levelConnections: any[] = [];
            
            for (const currentPath of currentLevel) {
                const nodeConnections = connections.get(currentPath) || [];
                
                for (const connection of nodeConnections) {
                    if (!connectionTypes.includes(connection.type)) continue;
                    if (visited.has(connection.to)) continue;
                    
                    const connectedDoc = documents.get(connection.to);
                    if (!connectedDoc) continue;
                    
                    levelConnections.push({
                        from: {
                            title: documents.get(connection.from)?.title,
                            path: connection.from
                        },
                        to: {
                            title: connectedDoc.title,
                            path: connection.to
                        },
                        type: connection.type,
                        strength: connection.strength
                    });
                    
                    if (!visited.has(connection.to)) {
                        nextLevel.push(connection.to);
                        visited.add(connection.to);
                    }
                }
            }
            
            if (levelConnections.length > 0) {
                network.levels.push({
                    depth: depth + 1,
                    connections: levelConnections
                });
            }
            
            currentLevel = nextLevel;
        }
        
        return network;
    }

    private async textSearch(query: string, caseSensitive: boolean, maxResults: number): Promise<any> {
        const documents = (this.knowledgeGraph as any).documents as Map<string, DocumentNode>;
        const results: Array<{ doc: DocumentNode; matches: Array<{ context: string; position: number }> }> = [];
        
        const searchQuery = caseSensitive ? query : query.toLowerCase();
        
        for (const [, doc] of documents) {
            const content = caseSensitive ? doc.content : doc.content.toLowerCase();
            const matches: Array<{ context: string; position: number }> = [];
            
            let position = content.indexOf(searchQuery, 0);
            while (position !== -1 && matches.length < 5) { // Max 5 matches per document
                const contextStart = Math.max(0, position - 50);
                const contextEnd = Math.min(content.length, position + searchQuery.length + 50);
                const context = doc.content.substring(contextStart, contextEnd);
                
                matches.push({
                    context: contextStart > 0 ? '...' + context : context,
                    position
                });
                
                position = content.indexOf(searchQuery, position + 1);
            }
            
            if (matches.length > 0) {
                results.push({ doc, matches });
            }
        }
        
        // Sort by number of matches, then by most recent modification
        results.sort((a, b) => {
            if (a.matches.length !== b.matches.length) {
                return b.matches.length - a.matches.length;
            }
            return b.doc.modified - a.doc.modified;
        });
        
        return {
            query: query,
            case_sensitive: caseSensitive,
            found: results.length,
            results: results.slice(0, maxResults).map(r => ({
                title: r.doc.title,
                path: r.doc.path,
                matches: r.matches.length,
                contexts: r.matches.map(m => m.context),
                modified: new Date(r.doc.modified).toISOString()
            }))
        };
    }

    private async searchByDate(
        dateType: string,
        startDate?: string,
        endDate?: string,
        sortOrder: string = 'newest',
        maxResults: number = 20
    ): Promise<any> {
        const documents = (this.knowledgeGraph as any).documents as Map<string, DocumentNode>;
        const results: DocumentNode[] = [];
        
        // Parse relative dates
        const parseDate = (dateStr?: string): number | undefined => {
            if (!dateStr) return undefined;
            
            const now = Date.now();
            const lowerStr = dateStr.toLowerCase();
            
            if (lowerStr === 'today') {
                return now - (now % (24 * 60 * 60 * 1000));
            } else if (lowerStr === 'yesterday') {
                return now - (24 * 60 * 60 * 1000) - (now % (24 * 60 * 60 * 1000));
            } else if (lowerStr.includes('days ago')) {
                const days = parseInt(lowerStr.match(/(\d+)/)?.[1] || '0');
                return now - (days * 24 * 60 * 60 * 1000);
            } else if (lowerStr.includes('weeks ago')) {
                const weeks = parseInt(lowerStr.match(/(\d+)/)?.[1] || '0');
                return now - (weeks * 7 * 24 * 60 * 60 * 1000);
            } else if (lowerStr.includes('months ago')) {
                const months = parseInt(lowerStr.match(/(\d+)/)?.[1] || '0');
                return now - (months * 30 * 24 * 60 * 60 * 1000);
            } else {
                // Try parsing as ISO date
                const parsed = new Date(dateStr).getTime();
                return isNaN(parsed) ? undefined : parsed;
            }
        };
        
        const startTimestamp = parseDate(startDate);
        const endTimestamp = parseDate(endDate);
        
        for (const [, doc] of documents) {
            const checkDate = dateType === 'created' ? doc.created : doc.modified;
            
            let include = true;
            if (startTimestamp && checkDate < startTimestamp) include = false;
            if (endTimestamp && checkDate > endTimestamp) include = false;
            
            if (include) {
                results.push(doc);
            }
        }
        
        // Sort results
        results.sort((a, b) => {
            const dateA = dateType === 'created' ? a.created : a.modified;
            const dateB = dateType === 'created' ? b.created : b.modified;
            return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
        });
        
        return {
            date_type: dateType,
            start_date: startDate,
            end_date: endDate,
            sort_order: sortOrder,
            found: results.length,
            results: results.slice(0, maxResults).map(doc => ({
                title: doc.title,
                path: doc.path,
                created: new Date(doc.created).toISOString(),
                modified: new Date(doc.modified).toISOString(),
                content_preview: doc.content.substring(0, 200) + '...'
            }))
        };
    }

    private async findSpecificInfo(infoType: string, customPattern?: string, contextWords: number = 10): Promise<any> {
        const documents = (this.knowledgeGraph as any).documents as Map<string, DocumentNode>;
        const results: Array<{ doc: DocumentNode; matches: Array<{ value: string; context: string }> }> = [];
        
        // Define regex patterns for different info types
        const patterns: { [key: string]: RegExp } = {
            vin: /\b[A-HJ-NPR-Z0-9]{17}\b/gi, // Vehicle Identification Numbers
            phone: /(\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g,
            email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
            address: /\b\d+\s+[A-Za-z0-9\s,.-]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Circle|Cir|Place|Pl)\b/gi,
            url: /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g,
            number: /\b\d{3,}\b/g, // Numbers with 3+ digits
            date: /\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b|\b\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}\b/g
        };
        
        const pattern = customPattern ? new RegExp(customPattern, 'gi') : patterns[infoType];
        if (!pattern) {
            return { error: `Unknown info type: ${infoType}` };
        }
        
        for (const [, doc] of documents) {
            const matches: Array<{ value: string; context: string }> = [];
            let match;
            
            while ((match = pattern.exec(doc.content)) !== null) {
                const matchStart = match.index;
                const matchEnd = matchStart + match[0].length;
                
                // Extract context around the match
                const words = doc.content.split(/\s+/);
                const wordPositions: number[] = [];
                let currentPos = 0;
                
                for (const word of words) {
                    wordPositions.push(currentPos);
                    currentPos += word.length + 1; // +1 for space
                }
                
                // Find which word contains the match
                const matchWordIndex = wordPositions.findIndex((pos, i) => 
                    pos <= matchStart && (i === words.length - 1 || wordPositions[i + 1] > matchStart)
                );
                
                if (matchWordIndex !== -1) {
                    const contextStart = Math.max(0, matchWordIndex - contextWords);
                    const contextEnd = Math.min(words.length, matchWordIndex + contextWords + 1);
                    const contextWords_arr = words.slice(contextStart, contextEnd);
                    
                    matches.push({
                        value: match[0],
                        context: (contextStart > 0 ? '...' : '') + 
                                contextWords_arr.join(' ') + 
                                (contextEnd < words.length ? '...' : '')
                    });
                }
                
                if (matches.length >= 10) break; // Limit matches per document
            }
            
            if (matches.length > 0) {
                results.push({ doc, matches });
            }
            
            // Reset regex for next document
            pattern.lastIndex = 0;
        }
        
        return {
            info_type: infoType,
            pattern: customPattern || patterns[infoType]?.source,
            found: results.length,
            total_matches: results.reduce((sum, r) => sum + r.matches.length, 0),
            results: results.map(r => ({
                title: r.doc.title,
                path: r.doc.path,
                matches: r.matches
            }))
        };
    }

    private async searchRecentNotes(
        count: number,
        contentFilter?: string,
        dateType: string = 'modified',
        daysBack?: number
    ): Promise<any> {
        const documents = (this.knowledgeGraph as any).documents as Map<string, DocumentNode>;
        let results: DocumentNode[] = Array.from(documents.values());
        
        // Filter by time if specified
        if (daysBack) {
            const cutoffTime = Date.now() - (daysBack * 24 * 60 * 60 * 1000);
            results = results.filter(doc => {
                const checkDate = dateType === 'created' ? doc.created : doc.modified;
                return checkDate >= cutoffTime;
            });
        }
        
        // Filter by content if specified
        if (contentFilter) {
            const filter = contentFilter.toLowerCase();
            results = results.filter(doc => 
                doc.content.toLowerCase().includes(filter) ||
                doc.title.toLowerCase().includes(filter) ||
                doc.tags.some(tag => tag.toLowerCase().includes(filter))
            );
        }
        
        // Sort by date (newest first)
        results.sort((a, b) => {
            const dateA = dateType === 'created' ? a.created : a.modified;
            const dateB = dateType === 'created' ? b.created : b.modified;
            return dateB - dateA;
        });
        
        return {
            count: count,
            content_filter: contentFilter,
            date_type: dateType,
            days_back: daysBack,
            found: results.length,
            results: results.slice(0, count).map(doc => ({
                title: doc.title,
                path: doc.path,
                created: new Date(doc.created).toISOString(),
                modified: new Date(doc.modified).toISOString(),
                content_preview: doc.content.substring(0, 200) + '...',
                tags: doc.tags
            }))
        };
    }
}