# Chat with Notes - Claude Code Memory

## Project Overview
This is an Obsidian plugin that allows users to chat with their notes using AI. The plugin supports multiple LLM providers with budget tracking and knowledge graph integration.

## Current Implementation Status

### ✅ Completed Features
- **Plugin Structure**: Full Obsidian plugin setup with TypeScript
- **Multi-Provider LLM Support**: Using Token.js for unified interface with native tool calling
  - OpenAI: gpt-4.5-preview, gpt-4.1, gpt-4o, gpt-4o-mini, o3-mini, o1-mini
  - Anthropic: claude-3-7-sonnet-latest, claude-3-5-sonnet-latest, claude-3-5-haiku
  - Google Gemini: gemini-2.0-flash-001, gemini-1.5-pro, gemini-1.5-flash
  - Groq: llama-3.3-70b-versatile, llama-3.1-8b-instant, mixtral-8x7b
  - Mistral: mistral-large-latest, open-mixtral-8x22b, codestral-latest
  - Cohere: command-r-plus, command-r, command-nightly
  - Perplexity: llama-3.1-sonar models with online search
  - OpenRouter: Access to 180+ models from various providers
  - Local: Ollama support via OpenAI-compatible API
- **Native Tool Calling**: Full function calling support across all compatible providers
- **Testing Infrastructure**: Jest with unit/integration tests, CI/CD pipeline
- **Test Vault**: Generated sample vault with realistic content
- **Build System**: esbuild configuration for development and production
- **Packaging Scripts**: Automated packaging and deployment scripts

### ✅ Recently Completed
- **Always-On Context**: Removed toggle, made note search the core feature
- **Smart Context Management**: Cline-inspired context gathering and prioritization
- **8 Specialized Search Tools**: Comprehensive note discovery capabilities
- **Intelligent Incremental Indexing**: Hourly updates with change detection only
- **Real-Time Progress Display**: Live feedback during note search
- **Context Window Management**: Smart token prioritization and truncation
- **Fallback Systems**: Works with or without embeddings

## Sample Commands for Testing

### Knowledge Discovery
```
What did I learn about machine learning?
Show me my thoughts on productivity systems
What are my key insights about relationships?
Find notes about project management strategies
```

### Time-Based Queries  
```
What did I write last week?
Show me recent notes about work
Find notes from December about goals
What did I capture recently about reading?
```

### Enhanced Search Commands
```
/search What are my core values?
/agent Analyze my writing patterns over time
/tools Find connections between creativity and productivity
```

### Analysis Requests
```
What patterns do you see in my thinking?
Summarize my key learnings from this year
Connect my notes about habit formation and productivity
```

## Technical Architecture

### Core Components
```
src/
├── llm/provider-manager.ts    # Multi-provider LLM management
├── budget/                    # Budget tracking (pending)
├── kb/                       # Knowledge graph (pending)
└── ui/                       # User interface (pending)
```

### Key Design Decisions
1. **Token.js**: Chosen for unified multi-provider interface with native tool calling support
2. **TypeScript**: Full type safety throughout
3. **Jest Testing**: Comprehensive test coverage with mocks
4. **Standalone Testing**: Can test core functionality without Obsidian
5. **Native Function Calling**: OpenAI-compatible tool calling across all supported providers

### Scripts Available
```bash
npm run dev                    # Development mode with watch
npm run build                 # Production build
npm run test:ci               # CI tests with coverage
npm run generate-vault        # Create test vault
npm run dev-install           # Build and install to test vault
npm run dev-uninstall         # Remove from test vault
npm run package              # Create release package
npm run deploy               # Deploy to repository
```

## Configuration Structure
```json
{
  "providers": {
    "openai": { "enabled": true, "apiKey": "..." },
    "anthropic": { "enabled": true, "apiKey": "..." },
    "google": { "enabled": true, "apiKey": "..." },
    "groq": { "enabled": true, "apiKey": "..." },
    "mistral": { "enabled": false, "apiKey": "..." },
    "cohere": { "enabled": false, "apiKey": "..." },
    "perplexity": { "enabled": false, "apiKey": "..." },
    "openrouter": { "enabled": false, "apiKey": "..." },
    "ollama": { "enabled": true, "baseUrl": "http://localhost:11434" }
  },
  "budget": {
    "monthlyLimit": 25.00,
    "warningThreshold": 0.8
  },
  "hotkeys": {
    "quickQuery": "Ctrl+Shift+L",
    "searchKnowledge": "Ctrl+Shift+K"
  }
}
```

## Development Guidelines

### Testing
- Unit tests for core functionality
- Integration tests for plugin lifecycle
- Standalone tests that work without Obsidian
- Mock implementations for all external dependencies

### Code Style
- TypeScript with strict settings
- No unnecessary comments unless complex logic
- Follow Obsidian plugin conventions
- Use existing libraries (Token.js) over custom implementations
- Native function calling for tool use across all providers

### Development Process
1. **Quick Testing**: `npm run dev-install` - builds and installs to test-vault
2. **Development**: `npm run dev` - auto-rebuilds on changes
3. **Update Test Vault**: `npm run dev-install` - after making changes
4. **Remove from Test**: `npm run dev-uninstall` - clean test environment

### Deployment Process
1. Run tests: `npm run test:ci`
2. Build plugin: `npm run build`
3. Package release: `npm run package`
4. Deploy: `npm run deploy`
5. Create GitHub release with generated assets

## Current Repository Structure
```
obsidian-notes-chat/
├── src/                      # Source code
├── tests/                    # Test suites
├── scripts/                  # Build and deployment scripts
├── test-vault/              # Sample vault for testing
├── docs/                    # Documentation (auto-generated)
├── manifest.json            # Obsidian plugin manifest
├── package.json             # Node.js package configuration
└── README.md               # User documentation
```

## Next Steps
1. Complete rebranding to "obsidian-notes-chat"
2. Implement budget tracking system
3. Build knowledge graph with local embeddings
4. Create hotkey system for quick access
5. Design and implement chat UI
6. Submit to Obsidian Community Plugins

## Budget Tracking Design (Pending)
- Real-time cost calculation for all providers
- Monthly limits with configurable thresholds
- Usage analytics and spending reports
- Alert system when approaching limits
- Historical usage data storage

## Knowledge Graph Design (Pending)
- Local embedding of vault content using Transformers.js
- Semantic search across notes
- Context injection for LLM queries
- Relationship mapping between notes
- Vector similarity search

## UI Design (Pending)
- Chat panel in sidebar
- Hotkey-triggered quick query modal
- Settings page for provider configuration
- Budget monitoring dashboard
- Knowledge graph visualization

## Repository Information
- **Name**: obsidian-notes-chat
- **Display Name**: Chat with Notes
- **Description**: Chat with your notes using AI - supports multiple LLM providers with budget tracking
- **GitHub**: https://github.com/straitstreet/obsidian-notes-chat (pending rename)
- **License**: MIT
- **Author**: StraitStreet