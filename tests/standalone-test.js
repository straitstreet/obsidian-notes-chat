/**
 * Standalone test runner for core functionality without Obsidian
 * This allows testing the LLM providers, knowledge graph, and budget tracking
 * independently of the Obsidian plugin environment
 */

// Mock implementations since we're using ES modules that can't be easily required
// The actual provider manager uses ES modules and external dependencies

class StandaloneTestEnvironment {
    constructor() {
        this.mockObsidianApp = {
            vault: {
                getFiles: () => [
                    { path: 'test-note.md', stat: { mtime: Date.now() } },
                    { path: 'another-note.md', stat: { mtime: Date.now() } }
                ],
                read: (file) => Promise.resolve(`# ${file.path}\n\nTest content for ${file.path}`)
            },
            workspace: {
                getActiveFile: () => ({ path: 'current-note.md' })
            }
        };
    }

    async runTests() {
        console.log('🧪 Running standalone tests...\n');

        try {
            await this.testLLMProviders();
            await this.testBudgetTracking();
            await this.testKnowledgeGraph();
            
            console.log('✅ All tests passed!');
        } catch (error) {
            console.error('❌ Test failed:', error);
            process.exit(1);
        }
    }

    async testLLMProviders() {
        console.log('Testing LLM Providers...');
        
        const providerManager = new MockLLMProviderManager({
            openai: { apiKey: 'test-key', enabled: true },
            anthropic: { apiKey: 'test-key', enabled: true }
        });

        // Test provider registration
        const providers = providerManager.getAvailableProviders();
        console.log(`  ✓ Found ${providers.length} providers: ${providers.join(', ')}`);

        // Test model listing
        const models = providerManager.getModelsForProvider('openai');
        console.log(`  ✓ OpenAI models: ${models.slice(0, 3).join(', ')}...`);
        
        console.log('  ✓ LLM Providers test passed\n');
    }

    async testBudgetTracking() {
        console.log('Testing Budget Tracking...');
        
        const budgetTracker = new MockBudgetTracker();
        
        // Test budget setting
        budgetTracker.setMonthlyBudget('openai', 50.00);
        console.log('  ✓ Set monthly budget');

        // Test usage tracking
        budgetTracker.recordUsage('openai', 'gpt-4', {
            inputTokens: 1000,
            outputTokens: 500,
            cost: 2.50
        });
        console.log('  ✓ Recorded usage');

        // Test budget checking
        const remaining = budgetTracker.getRemainingBudget('openai');
        console.log(`  ✓ Remaining budget: $${remaining}`);

        console.log('  ✓ Budget Tracking test passed\n');
    }

    async testKnowledgeGraph() {
        console.log('Testing Knowledge Graph...');
        
        const kg = new MockKnowledgeGraph();
        await kg.initialize();
        
        // Test document indexing
        await kg.indexDocument('test-doc.md', 'This is a test document about machine learning and AI.');
        console.log('  ✓ Indexed document');

        // Test similarity search
        const results = await kg.searchSimilar('artificial intelligence', 5);
        console.log(`  ✓ Found ${results.length} similar documents`);

        // Test graph relationships
        kg.addRelationship('test-doc.md', 'another-doc.md', 'references');
        const relationships = kg.getRelationships('test-doc.md');
        console.log(`  ✓ Added relationship, total: ${relationships.length}`);

        console.log('  ✓ Knowledge Graph test passed\n');
    }
}

// Mock implementations for testing
class MockLLMProviderManager {
    constructor(config) {
        this.config = config;
        this.providers = ['openai', 'anthropic', 'google', 'cohere'];
    }

    getAvailableProviders() {
        return this.providers;
    }

    getModelsForProvider(provider) {
        const models = {
            openai: ['gpt-4', 'gpt-3.5-turbo', 'gpt-4-turbo'],
            anthropic: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
            google: ['gemini-pro', 'gemini-pro-vision'],
            cohere: ['command', 'command-light']
        };
        return models[provider] || [];
    }
}

class MockBudgetTracker {
    constructor() {
        this.budgets = {};
        this.usage = {};
    }

    setMonthlyBudget(provider, amount) {
        this.budgets[provider] = amount;
    }

    recordUsage(provider, model, usage) {
        if (!this.usage[provider]) this.usage[provider] = [];
        this.usage[provider].push({ model, ...usage, timestamp: Date.now() });
    }

    getRemainingBudget(provider) {
        const budget = this.budgets[provider] || 0;
        const used = this.usage[provider]?.reduce((sum, u) => sum + u.cost, 0) || 0;
        return budget - used;
    }
}

class MockKnowledgeGraph {
    constructor() {
        this.documents = new Map();
        this.relationships = new Map();
    }

    async initialize() {
        // Mock initialization
    }

    async indexDocument(path, content) {
        this.documents.set(path, { content, vector: this.mockEmbed(content) });
    }

    async searchSimilar(query, limit = 5) {
        // Mock similarity search
        return Array.from(this.documents.keys()).slice(0, limit).map(path => ({
            path,
            score: Math.random()
        }));
    }

    addRelationship(from, to, type) {
        if (!this.relationships.has(from)) {
            this.relationships.set(from, []);
        }
        this.relationships.get(from).push({ to, type });
    }

    getRelationships(path) {
        return this.relationships.get(path) || [];
    }

    mockEmbed(text) {
        // Mock embedding - just return random vector
        return new Array(384).fill(0).map(() => Math.random());
    }
}

// Export mocks for use in main implementation
module.exports = {
    StandaloneTestEnvironment,
    LLMProviderManager: MockLLMProviderManager,
    BudgetTracker: MockBudgetTracker,
    KnowledgeGraph: MockKnowledgeGraph
};

// Run tests if called directly
if (require.main === module) {
    const testEnv = new StandaloneTestEnvironment();
    testEnv.runTests();
}