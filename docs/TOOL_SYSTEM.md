# Tool System Documentation

## Overview

The Chat with Notes plugin features an advanced tool system that allows the AI agent to intelligently search and retrieve information from your notes. The system consists of 8 specialized tools, each designed for specific types of queries.

## Tool Architecture

### Base Interface

All tools implement the `AgentTool` interface:

```typescript
interface AgentTool {
    name: string;
    description: string;
    parameters: any; // JSON schema for parameters
    execute: (params: any) => Promise<any>;
}
```

### Tool Execution Flow

1. **Query Analysis**: LLM analyzes user query and available tools
2. **Tool Selection**: LLM chooses appropriate tool based on query type
3. **Parameter Extraction**: LLM provides parameters in JSON format
4. **Tool Execution**: Tool searches knowledge graph and returns results
5. **Context Building**: Results added to conversation context
6. **Iteration**: Process repeats until LLM has sufficient information

## Available Tools

### 1. Semantic Search (`semantic_search`)

**Purpose**: Find notes based on meaning and conceptual similarity using vector embeddings.

**When to Use**: 
- General conceptual queries
- Finding related topics
- Thematic searches

**Parameters**:
```typescript
{
    query: string;          // The search query
    topK?: number;          // Number of results (default: 5)
    threshold?: number;     // Similarity threshold (default: 0.3)
}
```

**Example Queries**:
- "notes about relationships"
- "find content related to machine learning"
- "show me philosophical thoughts"

**Implementation Details**:
- Uses `Xenova/all-MiniLM-L6-v2` embeddings (384 dimensions)
- Cosine similarity calculation
- Configurable similarity threshold
- Returns results sorted by relevance

### 2. Text Search (`text_search`)

**Purpose**: Find exact text matches within note content with surrounding context.

**When to Use**:
- Exact phrase searches
- Finding specific mentions
- Locating quoted text

**Parameters**:
```typescript
{
    query: string;              // Text to search for
    case_sensitive?: boolean;   // Case sensitivity (default: false)
    max_results?: number;       // Max results (default: 10)
}
```

**Example Queries**:
- "find Toyota Camry"
- "search for 'quarterly report'"
- "locate the phrase 'action items'"

**Implementation Details**:
- String matching with context extraction
- Highlights matches with surrounding text
- Multiple matches per document
- Position tracking for context

### 3. Recent Notes Search (`search_recent_notes`)

**Purpose**: Find recently created or modified notes with optional content filtering.

**When to Use**:
- Temporal queries
- Finding latest work
- Recent thoughts on topics

**Parameters**:
```typescript
{
    count?: number;           // Number of notes (default: 10)
    content_filter?: string;  // Optional text filter
    date_type?: string;       // 'created' or 'modified' (default: 'modified')
    days_back?: number;       // Limit to recent days
}
```

**Example Queries**:
- "when was the last note about love?"
- "show me recent notes"
- "latest work from this week"

**Implementation Details**:
- Sorts by modification or creation date
- Optional content filtering
- Configurable time windows
- Returns with date information

### 4. Date Range Search (`search_by_date`)

**Purpose**: Find notes within specific time periods with flexible date parsing.

**When to Use**:
- Time-bounded searches
- Historical note retrieval
- Period-specific analysis

**Parameters**:
```typescript
{
    date_type?: string;       // 'created', 'modified', or 'both'
    start_date?: string;      // Start date (ISO or relative)
    end_date?: string;        // End date (ISO or relative)
    sort_order?: string;      // 'newest' or 'oldest'
    max_results?: number;     // Max results (default: 20)
}
```

**Supported Date Formats**:
- Relative: "7 days ago", "last week", "2 months ago"
- Absolute: "2025-01-01", "today", "yesterday"
- ISO format: "2025-01-20T00:00:00Z"

**Example Queries**:
- "notes from last month"
- "show me notes created yesterday"
- "find notes modified in the last week"

### 5. Specific Information Finder (`find_specific_info`)

**Purpose**: Extract specific types of information using regex patterns.

**When to Use**:
- Finding structured data
- Extracting contact information
- Locating identification numbers

**Parameters**:
```typescript
{
    info_type: string;        // Type of info to find
    pattern?: string;         // Custom regex pattern
    context_words?: number;   // Context words around match (default: 10)
}
```

**Supported Info Types**:
- `vin`: Vehicle Identification Numbers (17 characters)
- `phone`: Phone numbers (various formats)
- `email`: Email addresses
- `address`: Street addresses
- `url`: Web URLs
- `number`: Numbers with 3+ digits
- `date`: Date patterns

**Example Queries**:
- "what's my VIN?"
- "find my phone numbers"
- "show me email addresses"
- "locate the project number"

**Pattern Examples**:
```javascript
vin: /\b[A-HJ-NPR-Z0-9]{17}\b/gi
phone: /(\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g
email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g
```

### 6. Tag-Based Search (`search_by_tags`)

**Purpose**: Find notes containing specific tags.

**When to Use**:
- Category-based searches
- Tag filtering
- Organizational queries

**Parameters**:
```typescript
{
    tags: string[];           // Array of tags to search
    require_all?: boolean;    // Require all tags vs any (default: false)
}
```

**Example Queries**:
- "notes tagged with love"
- "find #work and #project notes"
- "show me #personal tagged content"

### 7. Link-Based Search (`search_by_links`)

**Purpose**: Find notes connected by wiki-links or outgoing links.

**When to Use**:
- Exploring note relationships
- Finding connected content
- Network analysis

**Parameters**:
```typescript
{
    note_path: string;        // Path of the note to find connections for
    direction?: string;       // 'incoming', 'outgoing', or 'both'
}
```

**Example Queries**:
- "what links to this note?"
- "show me outgoing links from Car Info"
- "find notes connected to my daily notes"

### 8. Note Details Retrieval (`get_note_details`)

**Purpose**: Get complete information about a specific note.

**When to Use**:
- Full note content retrieval
- Detailed note analysis
- Metadata extraction

**Parameters**:
```typescript
{
    note_path: string;        // Path of the note to get details for
}
```

**Returns**:
- Complete note content
- Metadata (tags, links, dates)
- Connection statistics
- File information

## Tool Selection Logic

The agent uses specific patterns to determine tool selection:

### Query Pattern Matching

| Query Pattern | Selected Tool | Reasoning |
|---------------|---------------|-----------|
| "when was the last..." | `search_recent_notes` | Temporal + content filter |
| "what's my [specific info]" | `find_specific_info` | Pattern extraction needed |
| "find text [phrase]" | `text_search` | Exact match required |
| "notes about [topic]" | `semantic_search` | Conceptual similarity |
| "notes tagged with [tag]" | `search_by_tags` | Tag-based filtering |
| "show me recent..." | `search_recent_notes` | Date-based sorting |
| "from last [time period]" | `search_by_date` | Time range query |

### LLM Prompt Engineering

The system prompt includes clear guidance for tool selection:

```
TOOL SELECTION GUIDE:
- "when was the last..." or "recent..." → use search_recent_notes
- "what's my VIN/phone/email" → use find_specific_info  
- "find text ABC" → use text_search
- "notes about relationships" → use semantic_search
- "notes tagged with X" → use search_by_tags

EXAMPLES:
User: "When was the last note about love?"
You: TOOL_CALL: search_recent_notes({"content_filter": "love", "count": 5})
```

## Response Format

Tools return structured results that the agent can interpret:

### Standard Response Structure
```typescript
{
    found: number;                    // Number of results found
    results: Array<{
        title: string;                // Note title
        path: string;                 // File path
        content_preview?: string;     // Content snippet
        similarity?: number;          // Relevance score
        modified?: string;            // Last modified date
        matches?: Array<{             // For text search
            value: string;            // Matched text
            context: string;          // Surrounding context
        }>;
    }>;
    // Tool-specific additional fields
}
```

## Error Handling

### Tool-Level Errors
- Invalid parameters are caught and logged
- Missing dependencies are gracefully handled
- Search failures return empty results with error information

### Agent-Level Recovery
- Tool execution failures are included in context
- Agent can try alternative tools
- Error information helps with debugging

## Performance Optimization

### Caching
- Embedding results are cached in localStorage
- Document parsing is cached until file changes
- Connection maps are rebuilt only when needed

### Batching
- Multiple documents processed together
- Configurable batch sizes for memory management
- Progress tracking for large operations

### Indexing
- Incremental updates on file changes
- Background processing for large vaults
- Efficient data structures for fast lookups

## Debugging Tools

### Debug Logging
Each tool includes detailed logging:
```javascript
console.log(`🛠️ Executing tool: ${toolName}`, parameters);
console.log(`✅ Tool result:`, { found: result.found, resultKeys: Object.keys(result) });
```

### Test Tools
- Standalone tool testing without LLM integration
- Mock data for predictable results
- Performance profiling for optimization

### Validation
- Parameter validation against JSON schemas
- Result structure verification
- Error reporting for malformed responses

## Extending the Tool System

### Adding New Tools

1. **Define Tool Interface**:
```typescript
const newTool: AgentTool = {
    name: 'custom_search',
    description: 'Custom search functionality',
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
};
```

2. **Add to Tool List**:
```typescript
// In KnowledgeGraphTools.getTools()
return [
    // ... existing tools
    newTool
];
```

3. **Update System Prompt**:
```typescript
// Add to tool descriptions and selection guide
```

### Tool Guidelines

- **Single Responsibility**: Each tool should have one clear purpose
- **Consistent Interface**: Follow the standard parameter and response patterns
- **Error Handling**: Gracefully handle all error conditions
- **Performance**: Optimize for typical use cases
- **Documentation**: Clear descriptions and examples

## Best Practices

### For Tool Developers
1. Use clear, descriptive tool names
2. Provide comprehensive parameter schemas
3. Return consistent result structures
4. Handle edge cases gracefully
5. Include helpful error messages

### For Agent Prompting
1. Provide clear selection criteria
2. Include concrete examples
3. Explain parameter usage
4. Guide error recovery
5. Optimize for common queries

### For Performance
1. Cache expensive operations
2. Use efficient data structures
3. Implement progressive loading
4. Profile and optimize bottlenecks
5. Monitor memory usage

This tool system provides the foundation for intelligent note searching and retrieval, enabling natural language queries to be converted into precise, targeted searches across your knowledge base.