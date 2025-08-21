#!/usr/bin/env node

/**
 * Standalone Agent Tester (TypeScript)
 * Test the knowledge agent without Obsidian
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { KnowledgeGraph, KnowledgeGraphConfig, DocumentNode } from '../src/kb/knowledge-graph';
import { EmbeddingManager, EmbeddingConfig, DocumentEmbedding } from '../src/kb/embeddings';
import { KnowledgeAgent, AgentConfig } from '../src/agent/knowledge-agent';
import { LLMProviderManager, LLMProviderConfig } from '../src/llm/provider-manager';

// Mock Obsidian interfaces
interface MockTFile {
    path: string;
    basename: string;
    extension: string;
    stat: {
        ctime: number;
        mtime: number;
    };
    content?: string;
}

interface MockVault {
    files: Map<string, MockTFile>;
    read(file: MockTFile): Promise<string>;
    getMarkdownFiles(): MockTFile[];
    addFile(filepath: string, content: string): MockTFile;
}

interface MockMetadataCache {
    cache: Map<string, any>;
    getFileCache(file: MockTFile): any;
}

// Mock implementations
class MockTFileImpl implements MockTFile {
    path: string;
    basename: string;
    extension: string;
    stat: { ctime: number; mtime: number };
    content?: string;

    constructor(filepath: string, content: string) {
        this.path = filepath;
        this.basename = path.basename(filepath, '.md');
        this.extension = 'md';
        this.stat = {
            ctime: Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000,
            mtime: Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000
        };
        this.content = content;
    }
}

class MockVaultImpl implements MockVault {
    files = new Map<string, MockTFile>();

    async read(file: MockTFile): Promise<string> {
        return file.content || '';
    }

    getMarkdownFiles(): MockTFile[] {
        return Array.from(this.files.values()).filter(f => f.extension === 'md');
    }

    addFile(filepath: string, content: string): MockTFile {
        const file = new MockTFileImpl(filepath, content);
        this.files.set(filepath, file);
        return file;
    }
}

class MockMetadataCacheImpl implements MockMetadataCache {
    cache = new Map<string, any>();

    getFileCache(file: MockTFile) {
        const content = file.content || '';
        const metadata: any = {
            links: [],
            tags: [],
            frontmatter: {}
        };

        // Extract tags
        const tagMatches = content.match(/#[\w\-]+/g);
        if (tagMatches) {
            metadata.tags = tagMatches.map(tag => ({ tag }));
        }

        // Extract links
        const linkMatches = content.match(/\[\[(.*?)\]\]/g);
        if (linkMatches) {
            metadata.links = linkMatches.map(match => {
                const link = match.slice(2, -2);
                return { link };
            });
        }

        return metadata;
    }
}

class MockLLMProviderManager extends LLMProviderManager {
    private mockResponses: { [key: string]: string } = {
        'search_recent_notes': 'TOOL_CALL: search_recent_notes({"content_filter": "love", "count": 5})',
        'find_specific_info': 'TOOL_CALL: find_specific_info({"info_type": "vin"})',
        'semantic_search': 'TOOL_CALL: semantic_search({"query": "love relationships", "topK": 5})',
        'text_search': 'TOOL_CALL: text_search({"query": "Toyota Camry"})',
        'default': 'FINAL_ANSWER: Based on the search results, I found the following information in your notes.'
    };

    constructor() {
        super({
            ollama: { enabled: true, baseUrl: 'http://localhost:11434' }
        });
    }

    async generateResponse(provider: string, model: string, messages: any[], options: any = {}) {
        const userMessage = messages[messages.length - 1].content.toLowerCase();
        
        let response = this.mockResponses.default;
        
        if (userMessage.includes('last') && userMessage.includes('love')) {
            response = this.mockResponses.search_recent_notes;
        } else if (userMessage.includes('vin')) {
            response = this.mockResponses.find_specific_info;
        } else if (userMessage.includes('toyota') || userMessage.includes('camry')) {
            response = this.mockResponses.text_search;
        } else if (userMessage.includes('love') || userMessage.includes('relationship')) {
            response = this.mockResponses.semantic_search;
        }

        // Simulate planning iterations
        if (userMessage.includes('tool_call:') || userMessage.includes('previous tool calls')) {
            response = this.mockResponses.default; // Final answer after tools
        }

        return {
            content: response,
            usage: {
                inputTokens: 100,
                outputTokens: 50,
                totalTokens: 150
            },
            provider,
            model
        };
    }

    async *generateStreamingResponse(provider: string, model: string, messages: any[], options: any = {}) {
        const response = await this.generateResponse(provider, model, messages, options);
        const words = response.content.split(' ');
        
        for (const word of words) {
            yield word + ' ';
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    }
}

async function loadTestData(vault: MockVault): Promise<void> {
    const testVaultPath = path.join(__dirname, '../test-vault');
    
    try {
        await loadNotesFromDirectory(vault, testVaultPath, '');
        console.log(`📚 Loaded ${vault.files.size} test notes`);
    } catch (error) {
        console.error('Failed to load test data, using fallback:', error);
        
        // Add fallback test data
        vault.addFile('Personal/Car-Info.md', `# Car Information

## Vehicle Details
- **Make**: Toyota
- **Model**: Camry
- **Year**: 2020
- **VIN**: 1HGBH41JXMN109186

## Insurance
- **Phone**: (555) 123-4567

#car #vehicle #important`);

        vault.addFile('Personal/Love-Letters.md', `# Love Letters and Memories

## Valentine's Day 2024
Received the most beautiful love letter from Sarah today. She wrote about how our relationship has grown.

## Anniversary Reflections  
June 12, 2023 - Our 5th anniversary. We talked about love and commitment.

#love #relationships #memories #personal`);

        vault.addFile('Personal/Recent-Thoughts.md', `# Recent Thoughts About Love and Life

*Created: January 20, 2025*

Been thinking a lot about love lately. How it changes, evolves, and deepens over time.

Love isn't just butterflies - it's choosing to be kind when tired, choosing to listen when you'd rather be heard.

#love #philosophy #personal #recent`);

        console.log('📝 Created fallback test data');
    }
}

async function loadNotesFromDirectory(vault: MockVault, dirPath: string, relativePath: string): Promise<void> {
    if (!fs.existsSync(dirPath)) return;
    
    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
        const fullPath = path.join(dirPath, item);
        const relativeItemPath = path.join(relativePath, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !item.startsWith('.')) {
            await loadNotesFromDirectory(vault, fullPath, relativeItemPath);
        } else if (item.endsWith('.md')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            vault.addFile(relativeItemPath, content);
        }
    }
}

async function setupAgent() {
    console.log('🚀 Setting up standalone agent test environment...\n');
    
    // Create mock dependencies
    const vault = new MockVaultImpl();
    const metadataCache = new MockMetadataCacheImpl();
    const llmManager = new MockLLMProviderManager();
    
    // Load test data
    await loadTestData(vault);
    
    // Create embedding manager
    const embeddingManager = new EmbeddingManager({
        modelName: 'Xenova/all-MiniLM-L6-v2',
        batchSize: 5,
        maxTokens: 256,
        enabled: true
    });
    
    // Initialize components
    console.log('🧠 Initializing embedding model...');
    await embeddingManager.initialize();
    
    const knowledgeGraph = new KnowledgeGraph(
        {
            enabled: true,
            autoIndex: false,
            indexInterval: 60,
            includeFolders: [],
            excludeFolders: [],
            fileTypes: ['md'],
            minContentLength: 10,
            maxDocuments: 1000
        },
        embeddingManager,
        vault as any,
        metadataCache as any
    );
    
    console.log('📊 Building knowledge graph...');
    await knowledgeGraph.initialize();
    
    const stats = knowledgeGraph.getStats();
    console.log(`✅ Knowledge graph ready: ${stats.documentsCount} docs, ${stats.embeddingsCount} embeddings\n`);
    
    const agent = new KnowledgeAgent(
        llmManager,
        knowledgeGraph,
        {
            provider: 'mock',
            model: 'mock-model',
            maxIterations: 3,
            temperature: 0.7
        }
    );
    
    return { agent, knowledgeGraph, vault };
}

async function runInteractiveCLI(agent: KnowledgeAgent, knowledgeGraph: KnowledgeGraph) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    console.log('🤖 Knowledge Agent Test CLI');
    console.log('═'.repeat(60));
    console.log('Enter queries to test the agent. Type "quit" to exit.');
    console.log('\n💡 Try these example queries:');
    console.log('  • "When was the last note about love?"');
    console.log('  • "What\'s my VIN?"');
    console.log('  • "Find my phone number"');
    console.log('  • "Show me notes about Toyota Camry"');
    console.log('  • "Find recent notes from the last week"');
    console.log('  • "Search for notes tagged with love"');
    console.log('');
    
    const stats = knowledgeGraph.getStats();
    console.log(`📊 Stats: ${stats.documentsCount} documents, ${stats.embeddingsCount} embeddings, ${stats.connectionsCount} connections`);
    console.log('');
    
    function askQuestion() {
        rl.question('🔍 Query: ', async (query) => {
            if (query.toLowerCase() === 'quit' || query.toLowerCase() === 'exit') {
                console.log('\n👋 Goodbye!');
                rl.close();
                return;
            }
            
            if (!query.trim()) {
                askQuestion();
                return;
            }
            
            console.log('⏳ Processing...\n');
            
            try {
                const startTime = Date.now();
                const response = await agent.processQuery(query);
                const endTime = Date.now();
                
                console.log('🎯 Response:');
                console.log('─'.repeat(50));
                console.log(response.content);
                
                if (response.toolCalls && response.toolCalls.length > 0) {
                    console.log('\n🛠️  Tools Used:');
                    response.toolCalls.forEach((call, i) => {
                        console.log(`  ${i + 1}. ${call.toolName}`);
                        console.log(`     Parameters: ${JSON.stringify(call.parameters, null, 2)}`);
                        if (call.result && call.result.found !== undefined) {
                            console.log(`     Found: ${call.result.found} results`);
                        }
                    });
                }
                
                console.log(`\n⚡ Completed in ${endTime - startTime}ms\n`);
                
            } catch (error) {
                console.error('❌ Error:', error);
                console.log('');
            }
            
            askQuestion();
        });
    }
    
    askQuestion();
}

async function runTestSuite() {
    console.log('🧪 Running automated test suite...\n');
    
    const testQueries = [
        "When was the last note about love?",
        "What's my VIN?", 
        "Find notes about relationships",
        "Show me recent notes",
        "Find my phone number",
        "Search for Toyota Camry",
        "Find notes tagged with love"
    ];
    
    const { agent } = await setupAgent();
    
    for (const query of testQueries) {
        console.log(`🔍 Testing: "${query}"`);
        console.log('─'.repeat(50));
        
        try {
            const response = await agent.processQuery(query);
            console.log(`✅ Response: ${response.content.substring(0, 150)}...`);
            console.log(`🛠️  Tools: ${response.toolCalls.map(c => c.toolName).join(', ') || 'none'}`);
            
            if (response.toolCalls.length > 0) {
                const foundResults = response.toolCalls
                    .filter(call => call.result && call.result.found)
                    .reduce((sum, call) => sum + call.result.found, 0);
                console.log(`📊 Found: ${foundResults} total results`);
            }
            
        } catch (error) {
            console.log(`❌ Error: ${error}`);
        }
        
        console.log('');
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    
    try {
        if (args.includes('--test') || args.includes('-t')) {
            await runTestSuite();
        } else {
            const { agent, knowledgeGraph } = await setupAgent();
            await runInteractiveCLI(agent, knowledgeGraph);
        }
    } catch (error) {
        console.error('💥 Setup failed:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch(console.error);
}