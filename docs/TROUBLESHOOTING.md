# Troubleshooting Guide

## Common Issues and Solutions

### 🤖 Agent & Tool Use Issues

#### Agent Not Using Tools

**Symptoms**:
- Agent provides generic responses without searching notes
- No tool calls visible in debug logs
- Direct responses without context

**Debugging Steps**:
1. **Check Console Logs**:
   ```
   Open Developer Console (Ctrl+Shift+I)
   Look for:
   🤖 Agent processing query: "..."
   🧠 LLM decision: {finished: true/false, toolCall: {...}}
   ```

2. **Verify Tool Initialization**:
   ```
   Look for: 🤖 KnowledgeAgent initialized with 8 tools: [...]
   If missing, check knowledge graph initialization
   ```

3. **Check LLM Response Parsing**:
   ```
   Look for: 🔍 Parsing LLM response: "..."
   Should show TOOL_CALL: or FINAL_ANSWER: format
   ```

**Common Causes & Solutions**:

| Cause | Solution |
|-------|----------|
| LLM not following tool format | Switch to a different model (GPT-4, Claude 3.5 work well) |
| Tools not initialized | Enable knowledge graph in settings |
| Incorrect prompt | Check system prompt includes tool examples |
| Model too small | Use larger models for better instruction following |

#### Tool Execution Failures

**Symptoms**:
- Tools execute but return no results
- Error messages in console
- Empty search results

**Debugging Steps**:
1. **Check Tool Execution Logs**:
   ```
   🛠️ Executing tool: semantic_search {"query": "love"}
   ✅ Tool result: {found: 0, resultKeys: [...]}
   ```

2. **Verify Knowledge Graph State**:
   ```javascript
   // In console
   const stats = knowledgeGraph.getStats();
   console.log(stats); // Should show documents and embeddings
   ```

**Common Solutions**:
- **No Documents**: Ensure vault has markdown files
- **No Embeddings**: Wait for initial indexing to complete
- **Permission Errors**: Check file access permissions
- **Memory Issues**: Reduce batch size in settings

### 🧠 Knowledge Graph Issues

#### Embeddings Not Generating

**Symptoms**:
- "Knowledge graph loaded: 5 documents, 0 embeddings"
- Semantic search returns no results
- Long loading times without progress

**Debugging Steps**:
1. **Check Embedding Model Loading**:
   ```
   Look for: 🧠 Mock embedding model initialized
   Or: Loading embedding model: {...}
   ```

2. **Monitor Memory Usage**:
   ```
   Task Manager → Check RAM usage
   Reduce batch size if high memory usage
   ```

3. **Check Network Issues**:
   ```
   Model downloads from HuggingFace
   Ensure internet connection for first load
   ```

**Solutions**:
- **First Time Setup**: Wait for model download (can take 5-10 minutes)
- **Memory Issues**: Reduce `batchSize` in settings from 10 to 5
- **Network Issues**: Check firewall/proxy settings
- **Storage Issues**: Ensure sufficient disk space for model files

#### Knowledge Graph Not Updating

**Symptoms**:
- New notes not appearing in search results
- Outdated content in responses
- Missing recently modified files

**Solutions**:
1. **Manual Rebuild**:
   ```
   Settings → Knowledge Graph Status → Rebuild Index
   ```

2. **Check File Watchers**:
   ```
   Ensure .md files are being detected
   Check exclude folders don't contain your notes
   ```

3. **Verify Settings**:
   ```json
   {
     "knowledgeGraph": {
       "enabled": true,
       "autoIndex": true,
       "fileTypes": ["md"]
     }
   }
   ```

### 🔌 LLM Provider Issues

#### API Key Errors

**Symptoms**:
- "Invalid API key" errors
- Authentication failures
- 401/403 HTTP errors

**Solutions**:
1. **Verify API Keys**:
   - Check key format (starts with correct prefix)
   - Ensure key has sufficient credits/usage limits
   - Test key with provider's official tools

2. **Check Provider Settings**:
   ```json
   {
     "providers": {
       "openai": {
         "enabled": true,
         "apiKey": "sk-..." // Must start with sk-
       }
     }
   }
   ```

#### Model Not Found Errors

**Symptoms**:
- "model: claude-4-opus-4.1" errors
- Invalid model name responses
- Provider rejecting requests

**Solutions**:
1. **Check Model Availability**:
   - Verify model name matches provider's current offerings
   - Some models require special access/waitlists
   - Regional availability may vary

2. **Use Fallback Models**:
   ```json
   {
     "anthropic": {
       "models": [
         "claude-3-5-sonnet-20241022", // Widely available
         "claude-3-opus-20240229"     // Backup option
       ]
     }
   }
   ```

#### Rate Limiting

**Symptoms**:
- "Rate limit exceeded" errors
- Slow responses
- Temporary failures

**Solutions**:
- **Reduce Request Frequency**: Wait between queries
- **Use Local Models**: Switch to Ollama for development
- **Check Provider Limits**: Review your tier/plan limits

### 💰 Budget Tracking Issues

#### Incorrect Cost Calculations

**Symptoms**:
- Costs seem too high/low
- Missing usage data
- Budget warnings not appearing

**Solutions**:
1. **Update Pricing Data**:
   ```typescript
   // Check src/llm/provider-manager.ts
   // Ensure pricing matches current provider rates
   ```

2. **Verify Usage Tracking**:
   ```
   Enable budget display in settings
   Check usage appears after each query
   ```

#### Budget Limits Not Enforced

**Solutions**:
1. **Enable Budget Tracking**:
   ```json
   {
     "enableBudgetTracking": true,
     "budget": {
       "monthlyLimit": 25.00,
       "enabled": true
     }
   }
   ```

2. **Check Monthly Reset**:
   - Budget resets at start of calendar month
   - Verify current month's usage

### 🖥️ User Interface Issues

#### Chat View Not Loading

**Symptoms**:
- Empty chat panel
- No response to queries
- UI elements missing

**Solutions**:
1. **Check Plugin Status**:
   ```
   Settings → Community Plugins → Chat with Notes (enabled)
   ```

2. **Restart Obsidian**:
   ```
   Close and reopen Obsidian
   Plugin will reinitialize
   ```

3. **Clear Plugin Data**:
   ```
   Disable plugin → Enable plugin
   This resets localStorage data
   ```

#### Settings Not Saving

**Solutions**:
1. **Check File Permissions**: Ensure Obsidian can write to plugin directory
2. **Restart After Changes**: Some settings require restart
3. **Manual Configuration**: Edit `data.json` in plugin folder if needed

### 📱 Performance Issues

#### Slow Response Times

**Possible Causes & Solutions**:

| Issue | Solution |
|-------|----------|
| Large vault indexing | Reduce `maxDocuments` limit |
| Heavy embedding generation | Lower `batchSize` |
| Network latency | Use local models (Ollama) |
| Multiple tool calls | Reduce `maxIterations` |

#### High Memory Usage

**Solutions**:
1. **Reduce Batch Size**:
   ```json
   {
     "embedding": {
       "batchSize": 5  // Down from 10
     }
   }
   ```

2. **Limit Document Count**:
   ```json
   {
     "knowledgeGraph": {
       "maxDocuments": 500  // Down from 1000
     }
   }
   ```

3. **Exclude Large Folders**:
   ```json
   {
     "knowledgeGraph": {
       "excludeFolders": [".obsidian", ".trash", "Archive"]
     }
   }
   ```

## Debug Mode

### Enabling Debug Logging

1. **Open Developer Console**: `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Opt+I` (Mac)
2. **Enable Verbose Logging**: The plugin automatically logs detailed information
3. **Filter Logs**: Use browser's filter to focus on specific components:
   - `🤖` - Agent operations
   - `🛠️` - Tool execution
   - `🧠` - LLM decisions
   - `📊` - Knowledge graph operations

### Key Log Messages

```
✅ Success indicators:
🤖 KnowledgeAgent initialized with 8 tools: [...]
✅ Plugin built successfully
✅ Knowledge graph ready: X docs, Y embeddings

⚠️ Warning indicators:
⚠️ Couldn't parse response, treating as final answer
⚠️ No embeddings available, using empty results

❌ Error indicators:
❌ Unknown tool: tool_name
❌ Tool execution failed: error_message
❌ Failed to parse tool parameters: {...}
```

### Performance Profiling

```javascript
// In Developer Console
console.time('query');
// Run your query
console.timeEnd('query');

// Check memory usage
console.log(performance.memory);
```

## Testing & Validation

### Standalone Testing

```bash
# Test agent logic without Obsidian
npm run test:agent-suite

# Interactive testing
npm run test:agent

# Tool parsing validation
node tests/test-tool-use.js
```

### Integration Testing

```bash
# Test in Obsidian environment
npm run dev-install

# Check console for initialization logs
# Test with sample queries
```

### Network Diagnostics

```bash
# Test API connectivity
curl -H "Authorization: Bearer sk-your-key" https://api.openai.com/v1/models

# Test local Ollama
curl http://localhost:11434/api/tags
```

## Getting Help

### Before Reporting Issues

1. **Check Console Logs**: Most issues are visible in developer console
2. **Test Standalone**: Use `npm run test:agent-suite` to isolate issues
3. **Verify Configuration**: Ensure all required settings are correct
4. **Test with Different Models**: Some models work better than others

### Reporting Bugs

Include in your report:
1. **Console Logs**: Copy relevant error messages
2. **Configuration**: Sanitized version of your settings (remove API keys)
3. **Steps to Reproduce**: Exact query and expected vs actual behavior
4. **Environment**: Obsidian version, plugin version, OS
5. **Vault Details**: Number of notes, file types, special characters

### Community Support

- **GitHub Issues**: https://github.com/straitstreet/obsidian-notes-chat/issues
- **Obsidian Forum**: Look for "Chat with Notes" discussions
- **Discord**: Join plugin development channels

## Quick Fixes

### Reset Everything
```bash
# Disable plugin
# Delete plugin folder
# Reinstall fresh copy
# Reconfigure settings
```

### Emergency Disable
```
Settings → Community Plugins → Chat with Notes → Disable
```

### Clear Cache
```javascript
// In Developer Console
localStorage.removeItem('chat-with-notes-knowledge-graph');
localStorage.removeItem('chat-with-notes-messages');
```

This troubleshooting guide covers the most common issues. For complex problems, the debug logging system provides detailed information about what's happening at each step of the process.