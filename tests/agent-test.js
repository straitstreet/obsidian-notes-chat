#!/usr/bin/env node

/**
 * Standalone Agent Tester
 * Test the knowledge agent without Obsidian
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Mock Obsidian classes
class MockTFile {
    constructor(filepath, content) {
        this.path = filepath;
        this.basename = path.basename(filepath, '.md');
        this.extension = 'md';
        this.stat = {
            ctime: Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000, // Random date in last 30 days
            mtime: Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000    // Random date in last 7 days
        };
        this.content = content;
    }
}

class MockVault {
    constructor() {
        this.files = new Map();
    }

    async read(file) {
        return file.content || '';
    }

    getMarkdownFiles() {
        return Array.from(this.files.values()).filter(f => f.extension === 'md');
    }

    addFile(filepath, content) {
        const file = new MockTFile(filepath, content);
        this.files.set(filepath, file);
        return file;
    }
}

class MockMetadataCache {
    constructor() {
        this.cache = new Map();
    }

    getFileCache(file) {
        // Parse basic metadata from content
        const content = file.content || '';
        const metadata = {
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

// Mock LLM Provider Manager
class MockLLMProviderManager {
    constructor() {
        this.mockResponses = {
            'search_recent_notes': 'TOOL_CALL: search_recent_notes({"content_filter": "love", "count": 5})',
            'find_specific_info': 'TOOL_CALL: find_specific_info({"info_type": "vin"})',
            'semantic_search': 'TOOL_CALL: semantic_search({"query": "love relationships", "topK": 5})',
            'default': 'FINAL_ANSWER: Based on the search results, I found the following information in your notes.'
        };
    }

    async generateResponse(provider, model, messages, options) {
        const userMessage = messages[messages.length - 1].content.toLowerCase();
        
        let response = this.mockResponses.default;
        
        if (userMessage.includes('last') && userMessage.includes('love')) {
            response = this.mockResponses.search_recent_notes;
        } else if (userMessage.includes('vin')) {
            response = this.mockResponses.find_specific_info;
        } else if (userMessage.includes('love') || userMessage.includes('relationship')) {
            response = this.mockResponses.semantic_search;
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

    async *generateStreamingResponse(provider, model, messages, options) {
        const response = await this.generateResponse(provider, model, messages, options);
        const words = response.content.split(' ');
        
        for (const word of words) {
            yield word + ' ';
            await new Promise(resolve => setTimeout(resolve, 50)); // Simulate streaming delay
        }
    }
}

// Mock Embedding Manager
class MockEmbeddingManager {
    constructor() {
        this.isReady = true;
    }

    async initialize() {
        console.log('🧠 Mock embedding model initialized');
    }

    async generateEmbedding(text) {
        // Generate a simple mock embedding based on text content
        const words = text.toLowerCase().split(/\s+/);
        const embedding = new Array(384).fill(0);
        
        // Simple hash-based embedding
        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            const hash = this.simpleHash(word);
            for (let j = 0; j < embedding.length; j++) {
                embedding[j] += Math.sin(hash + j) * 0.1;
            }
        }
        
        // Normalize
        const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
        return embedding.map(val => magnitude > 0 ? val / magnitude : 0);
    }

    async generateEmbeddings(texts) {
        return Promise.all(texts.map(text => this.generateEmbedding(text)));
    }

    calculateCosineSimilarity(a, b) {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        
        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        
        normA = Math.sqrt(normA);
        normB = Math.sqrt(normB);
        
        return normA > 0 && normB > 0 ? dotProduct / (normA * normB) : 0;
    }

    findMostSimilar(queryEmbedding, documents, topK = 10, threshold = 0.3) {
        const results = [];
        
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
        
        return results
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, topK);
    }

    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash);
    }

    isReady() {
        return this.isReady;
    }

    updateConfig() {}
}

async function loadTestData(vault) {
    const testVaultPath = path.join(__dirname, '../test-vault');
    
    try {
        await loadNotesFromDirectory(vault, testVaultPath, '');
        console.log(`📚 Loaded ${vault.files.size} test notes`);
    } catch (error) {
        console.error('Failed to load test data:', error);
        // Add some fallback test data
        vault.addFile('Personal/Car-Info.md', `# Car Information

## Vehicle Details
- **Make**: Toyota
- **Model**: Camry
- **Year**: 2020
- **VIN**: 1HGBH41JXMN109186

#car #vehicle`);

        vault.addFile('Personal/Love-Letters.md', `# Love Letters and Memories

## Valentine's Day 2024
Received the most beautiful love letter from Sarah today.

#love #relationships #memories`);

        vault.addFile('Personal/Recent-Thoughts.md', `# Recent Thoughts About Love and Life

Been thinking a lot about love lately. How it changes and evolves.

#love #philosophy #recent`);

        console.log('📝 Created fallback test data');
    }
}

async function loadNotesFromDirectory(vault, dirPath, relativePath) {
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
    const vault = new MockVault();
    const metadataCache = new MockMetadataCache();
    const llmManager = new MockLLMProviderManager();
    const embeddingManager = new MockEmbeddingManager();
    
    // Load test data
    await loadTestData(vault);
    
    // Import our classes (need to handle ES modules in Node.js context)
    const { KnowledgeGraph } = await import('../src/kb/knowledge-graph.js').catch(() => {
        console.log('⚠️  Could not import ES modules directly. Using mock knowledge graph.');
        return { KnowledgeGraph: MockKnowledgeGraph };
    });
    
    const { KnowledgeAgent } = await import('../src/agent/knowledge-agent.js').catch(() => {
        console.log('⚠️  Could not import ES modules directly. Using mock agent.');
        return { KnowledgeAgent: MockKnowledgeAgent };
    });
    
    // Initialize components
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
        vault,
        metadataCache
    );
    
    await knowledgeGraph.initialize();
    console.log('📊 Knowledge graph initialized\n');
    
    const agent = new KnowledgeAgent(
        llmManager,
        knowledgeGraph,
        {
            provider: 'mock',
            model: 'mock-model',
            maxIterations: 5,
            temperature: 0.7
        }
    );
    
    return { agent, knowledgeGraph, vault };
}

// Mock implementations for when imports fail
class MockKnowledgeGraph {
    constructor() {
        this.documents = new Map();
        this.embeddings = new Map();
    }
    
    async initialize() {}
    async searchSemantic() { return { results: [], context: '' }; }
    getStats() { return { documentsCount: 0, embeddingsCount: 0, connectionsCount: 0 }; }
}

class MockKnowledgeAgent {
    constructor() {}
    
    async processQuery(query) {
        return {
            content: `Mock response for: ${query}`,
            toolCalls: [],
            finished: true
        };
    }
}

async function runInteractiveCLI(agent, knowledgeGraph) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    console.log('🤖 Knowledge Agent Test CLI');
    console.log('═'.repeat(50));
    console.log('Enter queries to test the agent. Type "quit" to exit.');
    console.log('Try queries like:');
    console.log('  - "When was the last note about love?"');
    console.log('  - "What\'s my VIN?"');
    console.log('  - "Find notes about relationships"');
    console.log('  - "Show me recent notes"');
    console.log('');
    
    const stats = knowledgeGraph.getStats();
    console.log(`📈 Knowledge Graph: ${stats.documentsCount} docs, ${stats.embeddingsCount} embeddings`);
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
                console.log('─'.repeat(30));
                console.log(response.content);
                
                if (response.toolCalls && response.toolCalls.length > 0) {
                    console.log('\n🛠️  Tools Used:');
                    response.toolCalls.forEach((call, i) => {
                        console.log(`  ${i + 1}. ${call.toolName}`);
                        console.log(`     Parameters: ${JSON.stringify(call.parameters)}`);
                        if (call.result) {
                            console.log(`     Results: ${JSON.stringify(call.result, null, 2).substring(0, 200)}...`);
                        }
                    });
                }
                
                console.log(`\n⚡ Completed in ${endTime - startTime}ms\n`);
                
            } catch (error) {
                console.error('❌ Error:', error.message);
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
        "Find my phone number"
    ];
    
    const { agent } = await setupAgent();
    
    for (const query of testQueries) {
        console.log(`🔍 Testing: "${query}"`);
        console.log('─'.repeat(40));
        
        try {
            const response = await agent.processQuery(query);
            console.log(`✅ Response: ${response.content.substring(0, 100)}...`);
            console.log(`🛠️  Tools used: ${response.toolCalls.map(c => c.toolName).join(', ')}`);
        } catch (error) {
            console.log(`❌ Error: ${error.message}`);
        }
        
        console.log('');
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--test') || args.includes('-t')) {
        await runTestSuite();
    } else {
        const { agent, knowledgeGraph } = await setupAgent();
        await runInteractiveCLI(agent, knowledgeGraph);
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { 
    setupAgent, 
    runTestSuite, 
    MockVault, 
    MockMetadataCache, 
    MockLLMProviderManager, 
    MockEmbeddingManager 
};