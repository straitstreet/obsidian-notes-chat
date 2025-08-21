# Quick Reference Guide

## 🚀 Getting Started

### Installation
```bash
npm install && npm run build
```

### Development
```bash
npm run dev              # Auto-rebuild on changes
npm run dev-install      # Build and install to test vault
npm run test:agent       # Test agent without Obsidian
```

## 🛠️ Tool System

### 8 Available Tools

| Tool | Purpose | Example Query |
|------|---------|---------------|
| `semantic_search` | Vector similarity | "notes about love" |
| `text_search` | Exact text match | "find Toyota Camry" |
| `search_recent_notes` | Latest with filter | "last note about X" |
| `search_by_date` | Time range | "notes from last week" |
| `find_specific_info` | Pattern extract | "what's my VIN?" |
| `search_by_tags` | Tag filter | "notes tagged #work" |
| `search_by_links` | Link relations | "what links to this?" |
| `get_note_details` | Full note info | "show Car Info note" |

### Tool Response Format
```typescript
{
    found: number;           // Number of results
    results: Array<{
        title: string;       // Note title
        path: string;        // File path
        content_preview?: string;
        similarity?: number;
        modified?: string;
    }>;
}
```

## 🧠 LLM Integration

### Supported Providers
- **OpenAI**: GPT-5, GPT-4.1, GPT-4o
- **Anthropic**: Claude 4 Opus 4.1, Claude 4 Sonnet
- **Google**: Gemini 2.5 Pro, Gemini 2.0 Flash
- **Local**: Ollama models

### Tool Call Format
```
TOOL_CALL: tool_name({"param": "value"})
FINAL_ANSWER: Your comprehensive response
```

## 📊 Configuration

### Plugin Settings
```json
{
  "providers": {
    "openai": { "enabled": true, "apiKey": "sk-..." }
  },
  "knowledgeGraph": {
    "enabled": true,
    "maxDocuments": 1000
  },
  "embedding": {
    "modelName": "Xenova/all-MiniLM-L6-v2",
    "batchSize": 10
  }
}
```

### Agent Configuration
```typescript
{
    provider: 'openai',      // LLM provider
    model: 'gpt-4',          // Model name
    maxIterations: 5,        // Max tool loops
    temperature: 0.7         // Creativity (0-1)
}
```

## 🧪 Testing

### Test Commands
```bash
npm run test:ci              # All tests with coverage
npm run test:unit            # Unit tests only
npm run test:agent           # Interactive agent test
npm run test:agent-suite     # Automated agent tests
node tests/test-tool-use.js  # Tool parsing validation
```

### Manual Testing
```bash
# Install to test vault
npm run dev-install

# Open test-vault in Obsidian
# Enable Developer Console (Ctrl+Shift+I)
# Look for debug logs with 🤖 🛠️ 🧠 icons
```

## 🔍 Debugging

### Console Logs
```
🤖 Agent processing query: "..."     # Query received
🔄 Agent iteration 1/5               # Tool use loop
🧠 LLM decision: {finished: false}   # Tool vs final answer
🛠️ Executing tool: semantic_search   # Tool execution
✅ Tool result: {found: 3}           # Results returned
```

### Common Issues
| Issue | Check | Solution |
|-------|-------|----------|
| No tool use | LLM response format | Use better model (GPT-4, Claude) |
| No results | Knowledge graph stats | Rebuild index in settings |
| API errors | Console error details | Check API keys and model names |
| Slow performance | Embedding batch size | Reduce from 10 to 5 |

## 📁 File Structure

```
src/
├── agent/                   # 🤖 AI Agent
│   ├── knowledge-agent.ts   # Main orchestrator
│   └── agent-tools.ts       # 8 search tools
├── kb/                      # 📚 Knowledge Base
│   ├── knowledge-graph.ts   # Document indexing
│   └── embeddings.ts        # Vector embeddings
├── llm/                     # 💬 LLM Integration
│   └── provider-manager.ts  # Multi-provider support
└── ui/                      # 🖥️ User Interface
    └── simple-chat-view.ts  # Chat interface
```

## 🎯 Common Patterns

### Adding New Tool
```typescript
{
    name: 'my_tool',
    description: 'What it does',
    parameters: {
        type: 'object',
        properties: {
            query: { type: 'string' }
        }
    },
    execute: async (params) => ({
        found: 0,
        results: []
    })
}
```

### Agent Query Processing
```
User Query → LLM Analysis → Tool Selection → Tool Execution → Result Context → Final Answer
```

### Error Handling
```typescript
try {
    const result = await tool.execute(params);
    // Process result
} catch (error) {
    console.error('Tool failed:', error);
    // Include error in context
}
```

## 🔧 Performance Tips

### Optimization
- Reduce `batchSize` for memory constraints
- Limit `maxDocuments` for large vaults
- Use `excludeFolders` to skip irrelevant content
- Enable `autoIndex: false` for manual control

### Monitoring
```javascript
// In console
console.log(knowledgeGraph.getStats());
// {documentsCount: 50, embeddingsCount: 50, connectionsCount: 123}
```

## 🎨 UI Integration

### Chat Interface
```typescript
// Enable knowledge agent
this.queryOptions.includeContext = true;

// Process with agent
const response = await this.knowledgeAgent.processQuery(message);

// Display tool calls
response.toolCalls.forEach(call => {
    console.log(`Used: ${call.toolName}`);
});
```

### Settings Panel
```typescript
// Add knowledge graph status
const stats = this.knowledgeGraph.getStats();
statusEl.textContent = `📚 ${stats.documentsCount} docs`;
```

## 💡 Best Practices

### For Contributors
1. Follow TypeScript strict mode
2. Add JSDoc comments to public methods
3. Include unit tests for new features
4. Test with standalone agent runner
5. Update documentation for changes

### For Users
1. Enable knowledge graph for better results
2. Use specific queries for better tool selection
3. Check console for debugging information
4. Try different models if tools aren't used
5. Rebuild index after major vault changes

## 📚 Resources

- [Architecture Guide](./ARCHITECTURE.md) - Detailed system design
- [Tool System Guide](./TOOL_SYSTEM.md) - Complete tool documentation  
- [Troubleshooting](./TROUBLESHOOTING.md) - Common issues and solutions
- [Contributing](./CONTRIBUTING.md) - Development guidelines

## 🔗 Quick Links

- **Test Agent**: `npm run test:agent`
- **Debug Logs**: `Ctrl+Shift+I` → Console
- **Rebuild Index**: Settings → Knowledge Graph → Rebuild
- **Tool Testing**: `node tests/test-tool-use.js --interactive`

This quick reference covers the most common tasks and information needed for working with the Chat with Notes plugin.