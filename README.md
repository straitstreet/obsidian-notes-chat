# Chat with Notes 💬📝

> Intelligent AI assistant that searches through your Obsidian notes to provide contextual answers. Built for knowledge discovery and note exploration.

[![Tests](https://github.com/straitstreet/obsidian-notes-chat/actions/workflows/test.yml/badge.svg)](https://github.com/straitstreet/obsidian-notes-chat/actions/workflows/test.yml)
[![Coverage](https://codecov.io/gh/straitstreet/obsidian-notes-chat/branch/main/graph/badge.svg)](https://codecov.io/gh/straitstreet/obsidian-notes-chat)

## ✨ Features

### 🚀 **Multi-Provider LLM Support**
- **OpenAI**: GPT-4.1, GPT-4.1-mini, GPT-4.1-nano, O3, O4-mini (latest 2025 models)
- **Anthropic**: Claude 4 Opus 4.1, Claude 4 Sonnet, Claude 3.7 Sonnet
- **Google**: Gemini 2.5 Pro/Flash/Flash-Lite, Gemini 2.0 Flash Thinking
- **Local Models**: Ollama, Groq, Together AI
- **Unified Interface**: Powered by Vercel AI SDK

### 💬 **Intelligent Note Discovery**
- **Always-On Search**: Automatically searches your notes for relevant context
- **Real-Time Progress**: See which notes are being found and analyzed
- **Smart Context Ranking**: Prioritizes most relevant and recent information
- **Simple Q&A Mode**: Each conversation is independent and focused

### 🧠 **Advanced Knowledge Graph**
- **8 Specialized Search Tools**: Semantic, text, date, pattern, tag, link, recent, and detail search
- **Local Embeddings**: Uses Transformers.js for client-side processing  
- **Smart Fallback**: Automatically uses text search when embeddings unavailable
- **Hourly Sync**: Intelligent incremental indexing of changed files only
- **Context Window Management**: Prioritizes most relevant results to fit LLM limits

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

## 💡 Sample Commands

### 🔍 **Knowledge Discovery**
Ask questions about concepts, ideas, and topics in your notes:

```
What did I learn about machine learning?
Show me my thoughts on productivity systems
What are my key insights about relationships?
Find notes about project management strategies
What did I write about meditation techniques?
```

### 📅 **Time-Based Queries**
Find information based on when you wrote it:

```
What did I write last week?
Show me recent notes about work
What was I thinking about yesterday?
Find notes from December about goals
What did I capture recently about reading?
```

### 🔎 **Specific Information**
Search for exact data, quotes, or specific content:

```
Find my phone number
What's my VIN number?
Show me where I mentioned "deep work"
Find the exact quote about creativity
What email addresses do I have saved?
```

### 🏷️ **Tag and Category Searches**
Explore notes by tags and organization:

```
Show me all notes tagged #productivity
What's in my #ideas category?
Find notes tagged both #work and #goals
Show me everything tagged #book-notes
What did I tag as #important?
```

### 🔗 **Relationship Discovery**
Find connections between your notes and ideas:

```
What notes are connected to my goal-setting note?
Show me notes that link to my project plan
Find related notes about habits
What's connected to my learning system?
Show me notes that reference each other
```

### ⚡ **Enhanced Search Commands**
Use special commands for deeper analysis:

```
/search What are my core values?
/agent Analyze my writing patterns over time
/tools Find connections between creativity and productivity
/search Recent insights about technology trends
/agent Compare my old vs new thinking on leadership
```

### 📊 **Analysis and Synthesis**
Ask for analysis and connections across your knowledge:

```
What patterns do you see in my thinking?
Summarize my key learnings from this year
What are my most common themes?
Connect my notes about habit formation and productivity
What insights can you draw from my journal entries?
```

### 🎯 **Specific Use Cases**
Real-world examples of how to use the plugin:

```
"Help me prepare for my presentation on AI" 
→ Finds all AI-related notes, extracts key points, suggests structure

"What did I decide about the new marketing strategy?"
→ Searches recent notes for marketing decisions and reasoning

"Show me my book highlights about leadership"
→ Finds notes tagged #books with leadership content

"What were my main takeaways from the conference?"
→ Searches for conference notes and summarizes insights

"Find my thoughts on work-life balance solutions"
→ Semantic search for balance-related concepts and strategies
```

## 🎯 Usage

### 🔄 Chat Interface
- **Open Chat View**: Click the chat icon in the ribbon or use the command palette
- **Always-On Context**: Automatically searches your notes for every question
- **Real-Time Progress**: Watch as the AI searches through your knowledge base
- **Provider Selection**: Switch between different LLM providers
- **Simple Q&A**: Each conversation is independent and focused

### ⚡ Enhanced Search Commands
Built-in commands for deeper note exploration:
- **`/search [query]`**: Enhanced semantic search with detailed results
- **`/agent [query]`**: Deep analysis using multiple search tools
- **`/tools [query]`**: Multi-tool search across different note dimensions

### 📊 Intelligent Context Discovery
- **8 Search Tools**: Semantic, text, date, pattern, tag, link, recent, detail analysis
- **Smart Prioritization**: Most relevant and recent notes get priority
- **Context Window Management**: Automatically fits results within AI token limits
- **Progressive Display**: See search progress and results in real-time
- **Fallback Support**: Works with or without embeddings

### 💰 Budget Management
- **Real-time Monitoring**: See current spending and remaining budget in chat interface
- **Customizable Limits**: Set monthly budgets with warning and alert thresholds
- **Usage Analytics**: Export detailed spending data for analysis
- **Smart Alerts**: Notifications when approaching or exceeding limits

## 💡 Tips for Best Results

### 📝 **Optimize Your Notes for AI Search**
- **Use descriptive titles**: "Machine Learning Insights" vs "Notes 1"
- **Add relevant tags**: #productivity #books #ideas #goals
- **Include context in notes**: Date important insights and decisions
- **Link related notes**: Create connections the AI can discover
- **Write clearly**: Well-structured notes yield better search results

### 🎯 **Query Techniques**
- **Be specific**: "What did I learn about React hooks?" vs "React stuff"
- **Use time references**: "recent", "last week", "December insights"
- **Mention note types**: "meeting notes", "book highlights", "journal entries"  
- **Ask for connections**: "How do my productivity notes relate to my goals?"
- **Request analysis**: "What patterns do you see in my learning?"

### ⚡ **Power User Tips**
- **Use force commands**: `/search`, `/agent`, `/tools` for enhanced results
- **Combine search types**: The AI automatically uses the best search tools
- **Ask follow-up questions**: Build on previous answers in the same session
- **Request specific formats**: "Create a summary", "Make a list", "Show connections"
- **Explore relationships**: "What notes link to this concept?"

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