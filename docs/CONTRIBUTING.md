# Contributing to Chat with Notes

We welcome contributions from the community! This guide will help you get started with contributing to the project.

## 🚀 Quick Start for Contributors

### Prerequisites
- Node.js 16+ and npm
- TypeScript knowledge (helpful but not required)
- Basic understanding of Obsidian plugins
- Git for version control

### Development Setup

1. **Fork and Clone**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/obsidian-notes-chat.git
   cd obsidian-notes-chat
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Run Tests**:
   ```bash
   npm run test:ci
   ```

4. **Start Development**:
   ```bash
   npm run dev
   ```

5. **Test Your Changes**:
   ```bash
   npm run dev-install  # Installs to test-vault
   ```

## 📋 Types of Contributions

### 🐛 Bug Fixes
- Fix reported issues
- Improve error handling
- Performance optimizations
- Edge case handling

### ✨ New Features
- Additional search tools
- New LLM providers
- UI improvements
- Integration enhancements

### 📚 Documentation
- Code comments and JSDoc
- User guides and tutorials
- API documentation
- Examples and demos

### 🧪 Testing
- Unit test coverage
- Integration tests
- Performance benchmarks
- Edge case testing

## 🏗️ Architecture Overview

Understanding the codebase structure will help you contribute effectively:

```
src/
├── agent/              # AI Agent System
│   ├── knowledge-agent.ts    # Main orchestrator
│   └── agent-tools.ts        # Search tool implementations
├── kb/                 # Knowledge Base
│   ├── knowledge-graph.ts    # Document indexing
│   └── embeddings.ts         # Vector embeddings
├── llm/                # LLM Integration
│   └── provider-manager.ts   # Multi-provider support
├── budget/             # Cost Management
│   ├── budget-manager.ts     # Usage tracking
│   └── budget-notifications.ts # Alerts
└── ui/                 # User Interface
    └── simple-chat-view.ts   # Chat interface
```

## 🛠️ Development Workflow

### 1. Planning Your Contribution

Before starting work:
1. **Check existing issues** for similar requests
2. **Open an issue** to discuss major changes
3. **Get feedback** on your approach
4. **Break down** large features into smaller PRs

### 2. Setting Up Your Branch

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/issue-description
```

### 3. Development Process

#### For Tool Development
```bash
# Test tools standalone
npm run test:agent

# Interactive testing
npm run test:agent -- --interactive

# Full integration test
npm run dev-install
```

#### For LLM Provider Addition
```bash
# Add provider to provider-manager.ts
# Update configuration interfaces
# Add to default settings
# Test with real API
```

#### For UI Changes
```bash
# Modify UI components
# Test in Obsidian environment
# Verify responsive design
# Check accessibility
```

### 4. Testing Your Changes

#### Required Tests
- **CI Tests**: `npm run test:ci` (unit tests only, no network)
- **Unit Tests**: `npm run test:unit`  
- **Integration Tests**: `npm run test:integration` (local only)
- **Agent Tests**: `npm run test:agent-suite`
- **Manual Testing**: Test in actual Obsidian environment

#### Writing Tests
```typescript
// Example unit test
describe('AgentTool', () => {
    it('should execute search correctly', async () => {
        const tool = new SemanticSearchTool(mockKnowledgeGraph);
        const result = await tool.execute({ query: 'test' });
        expect(result.found).toBeGreaterThan(0);
    });
});
```

### 5. Code Quality

#### TypeScript Standards
- Use strict TypeScript settings
- Provide proper type annotations
- Follow existing code patterns
- Use descriptive variable names

#### Code Style
```typescript
// Good
async function processUserQuery(query: string): Promise<AgentResponse> {
    const toolCalls: AgentToolCall[] = [];
    // Implementation...
}

// Avoid
function doStuff(q: any) {
    // Implementation...
}
```

#### Documentation
```typescript
/**
 * Executes semantic search using vector embeddings
 * @param query - The search query string
 * @param topK - Number of results to return
 * @returns Promise with search results
 */
async function semanticSearch(query: string, topK = 5): Promise<SearchResult[]> {
    // Implementation...
}
```

## 🔧 Specific Contribution Guides

### Adding a New Search Tool

1. **Define the Tool Interface**:
```typescript
// In agent-tools.ts
{
    name: 'my_new_tool',
    description: 'What this tool does',
    parameters: {
        type: 'object',
        properties: {
            query: { type: 'string', description: 'Search query' }
        },
        required: ['query']
    },
    execute: async (params) => {
        // Implementation
        return { found: 0, results: [] };
    }
}
```

2. **Implement the Logic**:
```typescript
private async myNewSearch(query: string): Promise<any> {
    // Access knowledge graph data
    const documents = this.knowledgeGraph.documents;
    
    // Process search
    const results = [];
    
    // Return standardized format
    return {
        found: results.length,
        results: results.map(doc => ({
            title: doc.title,
            path: doc.path,
            content_preview: doc.content.substring(0, 200) + '...'
        }))
    };
}
```

3. **Update System Prompt**:
```typescript
// Add to buildSystemPrompt() in knowledge-agent.ts
TOOL SELECTION GUIDE:
- "specific use case" → use my_new_tool
```

4. **Add Tests**:
```typescript
// In tests/
it('should handle new tool correctly', async () => {
    const result = await agent.processQuery('trigger new tool');
    expect(result.toolCalls).toContainEqual(
        expect.objectContaining({ toolName: 'my_new_tool' })
    );
});
```

### Adding a New LLM Provider

1. **Add Provider Configuration**:
```typescript
// In provider-manager.ts
if (this.config.newProvider?.enabled && this.config.newProvider.apiKey) {
    this.providers.set('newProvider', {
        name: 'New Provider',
        models: ['model1', 'model2'],
        isLocal: false,
        supportsStreaming: true,
        enabled: true
    });
}
```

2. **Implement API Integration**:
```typescript
// Create provider instance
this.aiProviders.set('newProvider', createNewProvider({
    apiKey: this.config.newProvider.apiKey,
    // Provider-specific configuration
}));
```

3. **Add Cost Calculation**:
```typescript
// In calculateCost method
newProvider: {
    'model1': { input: 0.001, output: 0.002 },
    'model2': { input: 0.002, output: 0.004 }
}
```

4. **Update Configuration Types**:
```typescript
interface LLMProviderConfig {
    newProvider?: {
        enabled: boolean;
        apiKey?: string;
        models?: string[];
    };
}
```

### Improving UI Components

1. **Follow Obsidian Design Patterns**:
```typescript
// Use Obsidian's CSS classes
const button = containerEl.createEl('button', {
    cls: 'mod-cta'  // Obsidian's primary button style
});
```

2. **Handle State Properly**:
```typescript
private updateUIState(processing: boolean) {
    this.sendButton.disabled = processing;
    this.sendButton.textContent = processing ? 'Sending...' : 'Send';
}
```

3. **Add Accessibility**:
```typescript
button.setAttribute('aria-label', 'Send message');
input.setAttribute('placeholder', 'Type your message...');
```

## 📊 Testing Guidelines

### Running Tests

```bash
# CI tests (unit only, no network access)
npm run test:ci

# Full test suite (includes integration tests)
npm run test:all

# Specific test types
npm run test:unit
npm run test:integration
npm run test:agent-suite

# Interactive testing
npm run test:agent
```

### Test Categories

#### Unit Tests
- Individual component testing
- Isolated function testing
- Mock dependencies
- Fast execution

#### Integration Tests
- Component interaction testing
- Real API testing (with test keys)
- End-to-end workflows
- Performance testing

#### Manual Tests
- UI interaction testing
- Real-world scenario testing
- Cross-platform compatibility
- User experience validation

### Performance Testing

```bash
# Benchmark agent performance
npm run test:agent-suite | grep "Completed in"

# Memory usage monitoring
node --max-old-space-size=4096 tests/performance-test.js
```

## 📝 Pull Request Process

### Before Submitting

1. **Run All Tests**: Ensure `npm run test:ci` passes
2. **Test Manually**: Install and test in Obsidian
3. **Update Documentation**: Add/update relevant docs
4. **Check Code Style**: Follow existing patterns
5. **Add Tests**: Include tests for new functionality

### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Performance improvement

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed
- [ ] Agent testing successful

## Checklist
- [ ] Code follows style guidelines
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] No breaking changes (or documented)
```

### Review Process

1. **Automated Checks**: CI/CD pipeline runs tests
2. **Code Review**: Maintainers review changes
3. **Testing**: Additional testing if needed
4. **Merge**: After approval and all checks pass

## 🎯 Contribution Ideas

### Easy First Issues
- Fix typos in documentation
- Add examples to README
- Improve error messages
- Add unit tests for existing functions

### Medium Complexity
- Add new search tools
- Improve UI components
- Add new LLM providers
- Performance optimizations

### Advanced Features
- Voice input support
- Advanced visualizations
- Plugin API for extensions
- Mobile optimizations

## 🏷️ Issue Labels

Understanding our issue labels helps you find good contribution opportunities:

- `good-first-issue`: Good for beginners
- `bug`: Something isn't working
- `enhancement`: New feature request
- `documentation`: Documentation improvements
- `help-wanted`: Extra attention needed
- `performance`: Performance related
- `ui`: User interface changes

## 🤝 Community Guidelines

### Code of Conduct
- Be respectful and inclusive
- Help others learn and grow
- Focus on constructive feedback
- Acknowledge contributions

### Communication
- **GitHub Issues**: Bug reports and feature requests
- **Pull Requests**: Code discussions
- **Documentation**: For clarification requests

### Recognition
Contributors are recognized in:
- Release notes
- Contributors list
- Special mentions for significant contributions

## 📚 Resources

### Documentation
- [Architecture Guide](./ARCHITECTURE.md)
- [Tool System Guide](./TOOL_SYSTEM.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)

### External Resources
- [Obsidian Plugin API](https://docs.obsidian.md/Plugins)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vercel AI SDK](https://sdk.vercel.ai/)

### Getting Help
- Check existing documentation first
- Search closed issues for similar problems
- Ask questions in GitHub Discussions
- Join community Discord for real-time help

## 🎉 Recognition

We value all contributions, big and small! Contributors will be:
- Listed in our contributors section
- Mentioned in release notes
- Acknowledged for their specific contributions
- Invited to help shape the project's future

Thank you for considering contributing to Chat with Notes! Your efforts help make this plugin better for the entire Obsidian community.