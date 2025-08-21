# Chat with Notes 💬📝

> Simple AI chat interface for Obsidian - ask questions and get responses from multiple LLM providers.

[![Tests](https://github.com/straitstreet/obsidian-notes-chat/actions/workflows/test.yml/badge.svg)](https://github.com/straitstreet/obsidian-notes-chat/actions/workflows/test.yml)
[![Coverage](https://codecov.io/gh/straitstreet/obsidian-notes-chat/branch/main/graph/badge.svg)](https://codecov.io/gh/straitstreet/obsidian-notes-chat)

## ✨ Features

### 🚀 **Multi-Provider LLM Support**
- **OpenAI**: GPT-4.1, GPT-4.1-mini, GPT-4.1-nano, O3, O4-mini (latest 2025 models)
- **Anthropic**: Claude 4 Opus 4.1, Claude 4 Sonnet, Claude 3.7 Sonnet
- **Google**: Gemini 2.5 Pro/Flash/Flash-Lite, Gemini 2.0 Flash Thinking
- **Local Models**: Ollama, Groq, Together AI
- **Unified Interface**: Powered by Vercel AI SDK

### 💬 **Simple Chat Interface**
- **Easy Access**: Click the chat icon in the ribbon or use command palette
- **Provider Selection**: Switch between different AI providers
- **Optional Context**: Include your notes as context when enabled
- **Conversation History**: Messages saved between sessions

### 🧠 **Smart Context**
- **Local Embeddings**: Uses Transformers.js for client-side processing  
- **Semantic Search**: Find conceptually related notes with AI
- **Context Integration**: Automatically includes relevant notes in responses
- **Real-time Indexing**: Updates as you create and modify notes
- **Enabled by Default**: Works out of the box for better responses

### 💰 **Budget Tracking (Optional)**
- **Cost Monitoring**: Track spending per request and monthly totals
- **Spending Limits**: Set monthly budgets with warnings
- **Usage Display**: See costs and token usage in real-time
- **Budget Protection**: Get notified when approaching limits

### 🔒 **Privacy & Security**
- **Local Processing**: Embeddings generated client-side with Transformers.js
- **Secure Storage**: API keys encrypted and stored locally
- **No Data Sharing**: Your notes never leave your device
- **Open Source**: Full transparency with auditable code

### 💻 **User-Friendly Design**
- **Single Conversation**: Simple, focused chat experience
- **Provider Switching**: Change AI models mid-conversation
- **Context Toggle**: Enable/disable note context as needed
- **Budget Display**: Monitor spending while chatting (when enabled)
- **Markdown Support**: Rich formatting in AI responses

## 🚀 Quick Start

### Installation

1. **From Obsidian Community Plugins** (Coming Soon)
   - Search for "Chat with Notes" in Community Plugins
   - Install and enable

2. **Manual Installation**
   ```bash
   git clone https://github.com/straitstreet/obsidian-notes-chat.git
   cd obsidian-notes-chat
   npm install
   npm run build
   ```

3. **Direct Download**
   - Download latest release from [GitHub Releases](https://github.com/straitstreet/obsidian-notes-chat/releases)
   - Extract to your vault's `.obsidian/plugins/` directory
   - Enable in Obsidian settings

### Configuration

1. Open plugin settings in Obsidian
2. Configure your preferred LLM providers:
   ```json
   {
     "providers": {
       "openai": { 
         "enabled": true, 
         "apiKey": "your-openai-api-key" 
       },
       "anthropic": { 
         "enabled": true, 
         "apiKey": "your-anthropic-api-key" 
       },
       "google": { 
         "enabled": true, 
         "apiKey": "your-gemini-api-key" 
       }
     }
   }
   ```
3. Set budget limits if desired (optional)
4. Smart context is enabled by default for better responses
5. Start chatting with your notes!

## 🎯 Usage

### 🔄 Chat Interface
- **Open Chat View**: Click the chat icon in the ribbon or use the command palette
- **Multi-Session Support**: Create and switch between different chat sessions
- **Context Toggle**: Enable/disable automatic context injection from your notes
- **Provider Selection**: Switch between different LLM providers mid-conversation

### ⚡ Hotkey Actions
- **Quick Query** (`Ctrl+Shift+L`): Instant AI responses - creates a new note with results
- **Knowledge Search** (`Ctrl+Shift+K`): Semantic search across your vault with similarity scores
- **Context Chat** (`Ctrl+Shift+C`): AI chat with automatic context from relevant notes
- **Explain Selection** (`Ctrl+Shift+E`): Explain highlighted text inline in your current note
- **Summarize Selection** (`Ctrl+Shift+S`): Generate summaries of selected content

### 📊 Knowledge Graph
- **Enable in Settings**: Turn on embedding generation and semantic indexing
- **Automatic Indexing**: Notes are processed as you create/modify them
- **Semantic Search**: Find related notes based on meaning, not just keywords
- **Context Injection**: Relevant notes automatically included in AI conversations

### 💰 Budget Management
- **Real-time Monitoring**: See current spending and remaining budget in chat interface
- **Customizable Limits**: Set monthly budgets with warning and alert thresholds
- **Usage Analytics**: Export detailed spending data for analysis
- **Smart Alerts**: Notifications when approaching or exceeding limits

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
obsidian-notes-chat/
├── src/
│   ├── llm/                    # Multi-provider LLM management
│   │   └── provider-manager.ts # Unified LLM interface
│   ├── budget/                 # Budget tracking system
│   │   ├── budget-manager.ts   # Cost tracking and limits
│   │   └── budget-notifications.ts # Spending alerts
│   ├── kb/                     # Knowledge graph system
│   │   ├── embeddings.ts       # Local embedding generation
│   │   └── knowledge-graph.ts  # Semantic indexing & search
│   └── ui/                     # User interface components
│       ├── chat-view.ts        # Main chat interface
│       └── hotkey-manager.ts   # Hotkey-driven modals
├── tests/                      # Comprehensive test suite
│   ├── unit/                   # Component tests
│   └── integration/            # System tests
└── scripts/                    # Build and deployment tools
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

### ✅ Completed (v1.0)
- [x] Multi-provider LLM support (OpenAI, Anthropic, Google, Ollama, Groq, Together)
- [x] Comprehensive budget tracking with real-time cost calculation
- [x] Local knowledge graph with Transformers.js embeddings
- [x] Full hotkey system with 5 different actions
- [x] Modern chat UI with multi-session support
- [x] Complete test infrastructure with CI/CD
- [x] Production-ready packaging and deployment

### 🔄 Next Release (v1.1)
- [ ] Voice input for hands-free interaction
- [ ] Advanced knowledge graph visualization
- [ ] Export conversations to various formats
- [ ] Plugin API for extensions
- [ ] Mobile-optimized interface
- [ ] Community plugin marketplace submission

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built on the [Vercel AI SDK](https://sdk.vercel.ai/) for multi-provider support
- Inspired by the Obsidian community's need for intelligent note interaction
- Uses latest 2025 LLM models for optimal performance

---

**Made with ❤️ by [StraitStreet](https://github.com/straitstreet)**