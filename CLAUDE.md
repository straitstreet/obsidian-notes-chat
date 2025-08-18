# Chat with Notes - Claude Code Memory

## Project Overview
This is an Obsidian plugin that allows users to chat with their notes using AI. The plugin supports multiple LLM providers with budget tracking and knowledge graph integration.

## Current Implementation Status

### ✅ Completed Features
- **Plugin Structure**: Full Obsidian plugin setup with TypeScript
- **Multi-Provider LLM Support**: Using Vercel AI SDK for unified interface
  - OpenAI: GPT-4.1, GPT-4.1-mini, GPT-4.1-nano, O3, O4-mini (latest 2025 models)
  - Anthropic: Claude 4 Opus 4.1, Claude 4 Sonnet, Claude 3.7 Sonnet
  - Google: Gemini 2.5 Pro/Flash/Flash-Lite, Gemini 2.0 Flash Thinking
  - Local: Ollama, Groq, Together AI support
- **Testing Infrastructure**: Jest with unit/integration tests, CI/CD pipeline
- **Test Vault**: Generated sample vault with realistic content
- **Build System**: esbuild configuration for development and production
- **Packaging Scripts**: Automated packaging and deployment scripts

### 🚧 In Progress
- Updating branding from "MindBridge" to "Chat with Notes"
- Creating GitHub repository with proper naming

### 📋 Pending Features
- Budget tracking and limits system
- Local file embedding and knowledge graph
- Hotkey system for LLM queries
- UI pane for chat interactions

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
1. **Vercel AI SDK**: Chosen for unified multi-provider interface
2. **TypeScript**: Full type safety throughout
3. **Jest Testing**: Comprehensive test coverage with mocks
4. **Standalone Testing**: Can test core functionality without Obsidian

### Scripts Available
```bash
npm run dev                    # Development mode
npm run build                 # Production build
npm run test:ci               # CI tests with coverage
npm run generate-vault        # Create test vault
npm run package              # Create release package
npm run deploy               # Deploy to repository
```

## Configuration Structure
```json
{
  "providers": {
    "openai": { "enabled": true, "apiKey": "..." },
    "anthropic": { "enabled": true, "apiKey": "..." },
    "google": { "enabled": false },
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
- Use existing libraries (Vercel AI SDK) over custom implementations

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