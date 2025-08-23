# Chat with Notes - Obsidian Plugin

## Overview
An Obsidian plugin for chatting with your notes using AI. Supports multiple LLM providers with budget tracking and semantic search.

## Features
- **Multi-Provider LLM Support**: OpenAI, Anthropic, Google Gemini, Groq, Mistral, Cohere, Perplexity, OpenRouter, Local (Ollama)
- **Smart Context Management**: 8 specialized search tools for note discovery
- **Native Tool Calling**: Function calling support across providers using Token.js
- **Semantic Search**: Local embeddings with fallback to text search
- **Budget Tracking**: Monthly limits and usage monitoring
- **Real-time Progress**: Live feedback during note search

## Architecture
```
src/
├── agent/           # Knowledge agent and tools
├── llm/            # Provider management
├── kb/             # Knowledge base and embeddings  
├── budget/         # Usage tracking
├── context/        # Vault context management
└── ui/             # Chat interface
```

## Development

### Scripts
- `npm run dev` - Development with watch
- `npm run build` - Production build
- `npm run test` - Unit tests
- `npm run generate-vault` - Create test vault
- `npm run dev-install` - Install to test vault
- `npm run package` - Create release package
- `npm run deploy` - Deploy release

## Configuration
```json
{
  "providers": {
    "openai": { "enabled": true, "apiKey": "..." },
    "anthropic": { "enabled": true, "apiKey": "..." },
    "google": { "enabled": true, "apiKey": "..." },
    "ollama": { "enabled": true, "baseUrl": "http://localhost:11434" }
  },
  "budget": { "monthlyLimit": 25.00, "warningThreshold": 0.8 }
}
```

## Testing
- `npm run test` - Unit tests  
- `npm run test:integration` - Integration tests
- `npm run test:agent` - Agent functionality tests

## Repository Structure
```
├── src/                 # Source code
├── tests/              # Test suites
├── scripts/            # Build scripts
├── test-vault/         # Test data
├── manifest.json       # Plugin manifest
└── package.json        # Dependencies
```