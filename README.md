# MindBridge 🧠⚡

> Intelligent LLM companion for Obsidian with hotkey access, knowledge graph integration, and budget tracking across multiple providers.

[![Tests](https://github.com/straitstreet/obsidian-mindbridge/actions/workflows/test.yml/badge.svg)](https://github.com/straitstreet/obsidian-mindbridge/actions/workflows/test.yml)
[![Coverage](https://codecov.io/gh/straitstreet/obsidian-mindbridge/branch/main/graph/badge.svg)](https://codecov.io/gh/straitstreet/obsidian-mindbridge)

## ✨ Features

### 🚀 **Multi-Provider LLM Support**
- **OpenAI**: GPT-4.1, GPT-4.1-mini, GPT-4.1-nano, O3, O4-mini (latest 2025 models)
- **Anthropic**: Claude 4 Opus 4.1, Claude 4 Sonnet, Claude 3.7 Sonnet
- **Google**: Gemini 2.5 Pro/Flash/Flash-Lite, Gemini 2.0 Flash Thinking
- **Local Models**: Ollama, Groq, Together AI
- **Unified Interface**: Powered by Vercel AI SDK

### ⚡ **Hotkey-Driven Interface**
- Quick LLM queries with customizable hotkeys
- Context-aware conversations using your vault
- Streaming responses for real-time interaction

### 🧠 **Knowledge Graph Integration**
- Local embedding and indexing of your notes
- Semantic search across your knowledge base
- Intelligent context injection for LLM queries

### 💰 **Budget Tracking & Limits**
- Real-time cost calculation for all providers
- Monthly budget limits with alerts
- Usage analytics and spending reports

### 🔒 **Privacy & Security**
- Local knowledge processing
- Secure API key management
- No data sent to third parties

## 🚀 Quick Start

### Installation

1. **From Obsidian Community Plugins** (Coming Soon)
   - Search for "MindBridge" in Community Plugins
   - Install and enable

2. **Manual Installation**
   ```bash
   git clone https://github.com/straitstreet/obsidian-mindbridge.git
   cd obsidian-mindbridge
   npm install
   npm run build
   ```

### Configuration

1. Open plugin settings in Obsidian
2. Configure your preferred LLM providers:
   ```json
   {
     "providers": {
       "openai": { 
         "enabled": true, 
         "apiKey": "your-api-key" 
       },
       "anthropic": { 
         "enabled": true, 
         "apiKey": "your-api-key" 
       }
     }
   }
   ```
3. Set budget limits and hotkeys
4. Start using MindBridge!

## 🎯 Usage

### Quick Query
- Press `Ctrl+Shift+L` (customizable) 
- Type your question
- Get intelligent responses with vault context

### Knowledge Search
- Press `Ctrl+Shift+K` (customizable)
- Search semantically across your notes
- Find connections you never noticed

### Budget Monitoring
- View real-time spending in settings
- Get alerts when approaching limits
- Analyze usage patterns

## 🛠️ Development

### Setup
```bash
npm install
npm run generate-vault  # Create test vault
npm run load-docs       # Load Obsidian docs
```

### Testing
```bash
npm run test            # Run all tests
npm run test:ci         # CI tests with coverage
npm run test:standalone # Test without Obsidian
```

### Building
```bash
npm run dev             # Development mode
npm run build          # Production build
```

## 📁 Project Structure

```
obsidian-mindbridge/
├── src/
│   ├── llm/            # LLM provider management
│   ├── kb/             # Knowledge graph & embedding
│   ├── budget/         # Budget tracking system
│   └── ui/             # User interface components
├── tests/
│   ├── unit/           # Unit tests
│   └── integration/    # Integration tests
├── scripts/
│   ├── generate-test-vault.js  # Test vault generator
│   └── load-obsidian-docs.js   # Documentation loader
└── test-vault/         # Sample vault for testing
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make changes and add tests
4. Ensure tests pass: `npm run test:ci`
5. Commit changes: `git commit -m 'Add amazing feature'`
6. Push to branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

## 📋 Roadmap

- [x] Multi-provider LLM support
- [x] Budget tracking system
- [x] Test infrastructure
- [ ] Knowledge graph implementation
- [ ] Hotkey system
- [ ] UI panel interface
- [ ] Voice input support
- [ ] Mobile compatibility
- [ ] Plugin marketplace submission

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built on the [Vercel AI SDK](https://sdk.vercel.ai/) for multi-provider support
- Inspired by the Obsidian community's need for intelligent note interaction
- Uses latest 2025 LLM models for optimal performance

---

**Made with ❤️ by [StraitStreet](https://github.com/straitstreet)**