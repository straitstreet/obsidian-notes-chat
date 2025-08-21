# Architecture Documentation

## Overview

Chat with Notes is built with a modular architecture that separates concerns into distinct layers:

```
┌─────────────────────┐
│   User Interface    │  ← Chat UI, Settings, Hotkeys
├─────────────────────┤
│   Knowledge Agent   │  ← Tool orchestration, Query routing
├─────────────────────┤
│   Search Tools      │  ← 8 specialized search capabilities
├─────────────────────┤
│   Knowledge Base    │  ← Embeddings, Document indexing
├─────────────────────┤
│   LLM Providers     │  ← Multi-provider interface
└─────────────────────┘
```

## Core Components

### 1. Knowledge Agent (`src/agent/knowledge-agent.ts`)

**Purpose**: Orchestrates the interaction between user queries and specialized tools.

**Key Methods**:
- `processQuery(query)` - Main entry point for processing user questions
- `planNextAction()` - Decides which tool to use based on LLM reasoning
- `parseAgentDecision()` - Parses LLM responses for tool calls vs final answers

**Flow**:
1. Receives user query
2. Sends query + context to LLM with tool descriptions
3. Parses LLM response for tool calls or final answers
4. Executes tools if needed
5. Builds context with results
6. Repeats until LLM provides final answer

### 2. Agent Tools (`src/agent/agent-tools.ts`)

**Purpose**: Provides 8 specialized search capabilities for the agent.

| Tool | Purpose | Example Use Case |
|------|---------|------------------|
| `semantic_search` | Vector similarity search | "notes about relationships" |
| `text_search` | Exact text matching | "find Toyota Camry" |
| `search_recent_notes` | Date-sorted filtering | "last note about love" |
| `search_by_date` | Time range queries | "notes from last week" |
| `find_specific_info` | Pattern extraction | "what's my VIN?" |
| `search_by_tags` | Tag filtering | "notes tagged with #work" |
| `search_by_links` | Link relationships | "what links to this note?" |
| `get_note_details` | Full note content | "show me the Car Info note" |

**Interface**:
```typescript
interface AgentTool {
    name: string;
    description: string;
    parameters: any; // JSON schema
    execute: (params: any) => Promise<any>;
}
```

### 3. Knowledge Graph (`src/kb/knowledge-graph.ts`)

**Purpose**: Maintains an indexed representation of all vault documents with embeddings and relationships.

**Key Features**:
- Document parsing and text extraction
- Batch embedding generation
- Link and tag relationship mapping
- Incremental updates on file changes
- Persistent storage in localStorage

**Data Structures**:
```typescript
interface DocumentNode {
    id: string;
    path: string;
    title: string;
    content: string;
    outlinks: string[];
    inlinks: string[];
    tags: string[];
    created: number;
    modified: number;
}
```

### 4. Embedding Manager (`src/kb/embeddings.ts`)

**Purpose**: Generates and manages vector embeddings using Transformers.js.

**Model**: `Xenova/all-MiniLM-L6-v2` (384-dimensional embeddings)
- Lightweight and fast
- Good semantic understanding
- Runs entirely client-side
- No API calls required

**Key Operations**:
- Batch embedding generation
- Cosine similarity calculation
- Vector search with thresholds
- Text truncation and preprocessing

### 5. LLM Provider Manager (`src/llm/provider-manager.ts`)

**Purpose**: Unified interface for multiple LLM providers with cost tracking.

**Supported Providers**:
- OpenAI (GPT-5, GPT-4.1, etc.)
- Anthropic (Claude 4 Opus 4.1, Claude 4 Sonnet)
- Google (Gemini 2.5 Pro, Gemini 2.0 Flash)
- Ollama (Local models)
- Groq, Together AI

**Features**:
- Automatic cost calculation
- Usage tracking per request
- Budget limit enforcement
- Provider-specific model lists
- Streaming response support

## Data Flow

### Query Processing Flow

```
User Query
    ↓
Agent receives query
    ↓
LLM analyzes query + available tools
    ↓
LLM responds with TOOL_CALL or FINAL_ANSWER
    ↓
If TOOL_CALL:
    ↓
Execute specific tool
    ↓
Tool searches knowledge graph
    ↓
Returns results to agent
    ↓
Agent builds context with results
    ↓
Repeat until FINAL_ANSWER
    ↓
Return response to user
```

### Knowledge Graph Building

```
File Change Detected
    ↓
Read file content
    ↓
Extract text (remove markdown)
    ↓
Generate embedding (Transformers.js)
    ↓
Parse metadata (tags, links)
    ↓
Update document in graph
    ↓
Rebuild connections
    ↓
Persist to localStorage
```

## Tool Selection Logic

The agent uses an improved prompt system to guide tool selection:

```typescript
// Example LLM prompt structure
const systemPrompt = `
AVAILABLE TOOLS:
- semantic_search: Search notes by meaning
- text_search: Search for exact text matches  
- find_specific_info: Find VINs, phones, emails
...

TOOL SELECTION GUIDE:
- "when was the last..." → use search_recent_notes
- "what's my VIN/phone" → use find_specific_info
- "find text ABC" → use text_search
- "notes about X" → use semantic_search

EXAMPLES:
User: "When was the last note about love?"
You: TOOL_CALL: search_recent_notes({"content_filter": "love", "count": 5})
`;
```

## Error Handling

### Agent Level
- Tool execution failures are captured and included in context
- Unknown tools are logged with available tool list
- Max iteration limits prevent infinite loops

### Tool Level
- Individual tools handle their own error cases
- Results include error information when failures occur
- Graceful degradation when embeddings aren't available

### LLM Level
- Enhanced error messages with full API response details
- Fallback to non-streaming when streaming fails
- Provider switching when one provider fails

## Performance Considerations

### Embedding Generation
- Batch processing (configurable batch size)
- Progress tracking for large vaults
- Incremental updates for file changes
- Local storage persistence

### Memory Usage
- Streaming responses for large outputs
- Pagination for search results
- Configurable document limits
- Efficient vector storage

### Response Time
- Tool caching where appropriate
- Parallel processing where possible
- Early termination when sufficient results found
- Smart context truncation

## Configuration

### Agent Configuration
```typescript
interface AgentConfig {
    provider: string;        // LLM provider to use
    model: string;          // Specific model name
    maxIterations: number;  // Max tool use cycles
    temperature: number;    // Response creativity
}
```

### Knowledge Graph Configuration
```typescript
interface KnowledgeGraphConfig {
    enabled: boolean;
    autoIndex: boolean;
    indexInterval: number;     // minutes
    includeFolders: string[];
    excludeFolders: string[];
    fileTypes: string[];
    minContentLength: number;
    maxDocuments: number;
}
```

### Embedding Configuration
```typescript
interface EmbeddingConfig {
    modelName: string;     // Transformers.js model
    batchSize: number;     // Documents per batch
    maxTokens: number;     // Max tokens per document
    enabled: boolean;
}
```

## Testing Strategy

### Unit Tests
- Individual tool functionality
- Embedding generation and similarity
- LLM provider interfaces
- Budget calculations

### Integration Tests
- Agent orchestration
- Knowledge graph building
- End-to-end query processing
- File watching and updates

### Standalone Tests
- Mock agent with realistic data
- Tool selection verification
- Response parsing validation
- Performance benchmarking

### Manual Tests
- Real LLM integration
- Obsidian environment testing
- UI interaction testing
- Edge case handling

## Debugging

### Debug Logging
The agent includes comprehensive logging:
```
🤖 Agent processing query: "..."
🔄 Agent iteration 1/5
🧠 LLM decision: {finished: false, toolCall: {...}}
🛠️ Executing tool: search_recent_notes
✅ Tool result: {found: 3, ...}
```

### Console Tools
- `console.log` statements throughout agent flow
- Tool execution timing
- Result structure inspection
- Error stack traces

### Test Tools
- Interactive CLI for isolated testing
- Mock data for predictable results
- Performance profiling
- Memory usage monitoring

This architecture provides:
- **Modularity**: Clear separation of concerns
- **Extensibility**: Easy to add new tools or providers
- **Testability**: Each component can be tested independently
- **Maintainability**: Well-documented interfaces and flows
- **Performance**: Efficient processing and caching strategies