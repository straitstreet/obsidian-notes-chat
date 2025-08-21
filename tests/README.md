# Agent Testing

This directory contains tools for testing the knowledge agent functionality outside of Obsidian.

## Test Scripts

### Simple Agent Test (`simple-agent-test.js`)
A lightweight simulator that demonstrates how the agent would handle different types of queries.

**Features:**
- 🤖 Mock agent that simulates tool selection based on query type
- 📚 Sample test data with realistic notes
- 🛠️ Demonstrates all 8 tool types (semantic search, text search, date search, info extraction, etc.)
- ⚡ Fast execution without actual LLM calls

**Usage:**
```bash
# Interactive CLI - test queries one by one
npm run test:agent

# Automated test suite - run all predefined queries  
npm run test:agent-suite
```

**Example Queries to Test:**
- `"When was the last note about love?"` → Uses `search_recent_notes`
- `"What's my VIN?"` → Uses `find_specific_info` with VIN pattern
- `"Find my phone numbers"` → Uses `find_specific_info` with phone pattern  
- `"Show me notes about Toyota Camry"` → Uses `text_search`
- `"Show me recent notes"` → Uses `search_recent_notes`
- `"Find notes about relationships"` → Uses `semantic_search`

### Full Agent Test (`agent-test.ts`)
A comprehensive test that uses the actual TypeScript modules with real embeddings.

**Features:**
- 🧠 Real embedding model (Transformers.js)
- 📊 Actual knowledge graph with vector similarity
- 🔗 Full agent reasoning loop
- 💻 TypeScript with proper type checking

**Usage:**
```bash
# Interactive mode (requires tsx)
npx tsx tests/agent-test.ts

# Test suite mode
npx tsx tests/agent-test.ts --test
```

## Test Data

The test scripts use realistic sample notes:

- **Car-Info.md** - Contains VIN, phone numbers, vehicle details
- **Love-Letters.md** - Personal notes about relationships  
- **Recent-Thoughts.md** - Latest thoughts about love (recent date)
- **Machine-Learning-Pipeline.md** - Technical project notes
- **Daily/20250120.md** - Daily note with phone numbers and references

## Tool Coverage

The tests demonstrate all agent tools:

| Tool | What it does | Example Query |
|------|-------------|---------------|
| `semantic_search` | Meaning-based search using embeddings | "notes about relationships" |
| `text_search` | Exact text matching | "Toyota Camry" |  
| `search_recent_notes` | Most recent notes with optional filtering | "last note about love" |
| `search_by_date` | Notes within date ranges | "notes from last week" |
| `find_specific_info` | Pattern matching (VINs, phones, emails) | "what's my VIN?" |
| `search_by_tags` | Notes with specific tags | "notes tagged with love" |
| `search_by_links` | Notes linked to/from others | "what links to this note?" |
| `get_note_details` | Full note information | "details about Car-Info" |

## Output Examples

### VIN Query
```
🔍 Query: "What's my VIN?"

🎯 Response:
I found your VIN: **1HGBH41JXMN109186**
This VIN is stored in **Car-Info** (Personal/Car-Info.md). 
It belongs to your 2020 Toyota Camry.

🛠️ Tools Used:
  1. find_specific_info
     Parameters: {"info_type":"vin","context_words":10}  
     Found: 1 result
```

### Love Notes Query
```
🔍 Query: "When was the last note about love?"

🎯 Response:
The most recent note about love is **Recent-Thoughts** (Personal/Recent-Thoughts.md), 
last modified on 1/20/2025.

In this note, you reflected on how love changes and evolves over time...

🛠️ Tools Used:
  1. search_recent_notes
     Parameters: {"content_filter":"love","count":5,"date_type":"modified"}
     Found: 3 results
```

## Development Workflow

1. **Quick Testing**: Run `npm run test:agent-suite` to verify all tools work
2. **Interactive Testing**: Run `npm run test:agent` to test specific queries
3. **Real Testing**: Use `npx tsx tests/agent-test.ts` with actual embeddings
4. **Integration Testing**: Test in Obsidian with the full plugin

This testing setup allows you to rapidly iterate on agent logic without needing to:
- Start Obsidian
- Configure API keys  
- Wait for embeddings to generate
- Navigate through the UI

Perfect for development and debugging! 🚀