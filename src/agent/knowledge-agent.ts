import { LLMProviderManager } from '../llm/provider-manager';
import { KnowledgeGraphTools, AgentTool, AgentToolCall, AgentResponse } from './agent-tools';
import { KnowledgeGraph } from '../kb/knowledge-graph';

/**
 * Configuration for the Knowledge Agent
 */
export interface AgentConfig {
    /** LLM provider to use (e.g., 'openai', 'anthropic', 'ollama') */
    provider: string;
    /** Specific model name to use */
    model: string;
    /** Maximum number of tool use iterations before forcing final answer */
    maxIterations: number;
    /** Temperature for LLM responses (0.0 = deterministic, 1.0 = creative) */
    temperature: number;
}

/**
 * AI Agent that orchestrates tool use for intelligent note searching and retrieval.
 * 
 * The KnowledgeAgent acts as an intermediary between user queries and the knowledge base,
 * using LLMs to determine which tools to use and how to combine their results into
 * comprehensive answers.
 * 
 * Features:
 * - 8 specialized search tools (semantic, text, date, pattern matching, etc.)
 * - Iterative tool use with context building
 * - Streaming response support
 * - Configurable LLM providers and models
 * 
 * @example
 * ```typescript
 * const agent = new KnowledgeAgent(llmManager, knowledgeGraph, {
 *   provider: 'openai',
 *   model: 'gpt-4',
 *   maxIterations: 5,
 *   temperature: 0.7
 * });
 * 
 * const result = await agent.processQuery("When was the last note about love?");
 * ```
 */
export class KnowledgeAgent {
    private tools: AgentTool[];
    private toolMap: Map<string, AgentTool>;
    
    /**
     * Creates a new KnowledgeAgent instance.
     * 
     * @param llmManager - Manager for LLM provider interactions
     * @param knowledgeGraph - Knowledge graph containing indexed documents
     * @param config - Agent configuration settings
     */
    constructor(
        private llmManager: LLMProviderManager,
        private knowledgeGraph: KnowledgeGraph,
        private config: AgentConfig
    ) {
        const kgTools = new KnowledgeGraphTools(knowledgeGraph);
        this.tools = kgTools.getTools();
        this.toolMap = new Map(this.tools.map(tool => [tool.name, tool]));
        
        console.log(`🤖 KnowledgeAgent initialized with ${this.tools.length} tools:`, this.tools.map(t => t.name));
        console.log(`📊 Config:`, this.config);
    }

    /**
     * Processes a user query using iterative tool selection and execution.
     * 
     * This is the main entry point for the agent. It:
     * 1. Analyzes the user query using the LLM
     * 2. Selects and executes appropriate tools based on query type
     * 3. Builds context from tool results
     * 4. Generates a comprehensive final answer
     * 
     * @param userQuery - The user's natural language query
     * @returns Promise resolving to agent response with content and tool call history
     * 
     * @example
     * ```typescript
     * const response = await agent.processQuery("What's my VIN?");
     * console.log(response.content); // "I found your VIN: 1HGBH41JXMN109186..."
     * console.log(response.toolCalls); // [{ toolName: 'find_specific_info', ... }]
     * ```
     */
    async processQuery(userQuery: string): Promise<AgentResponse> {
        console.log(`🤖 Agent processing query using native tool calling: "${userQuery}"`);
        console.log(`🎯 Agent config:`, {
            provider: this.config.provider,
            model: this.config.model,
            temperature: this.config.temperature,
            maxIterations: this.config.maxIterations
        });
        
        // Prepare tools for LLM
        const aiTools = this.tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
        }));
        
        console.log(`🛠️ Agent has ${this.tools.length} tools available:`);
        this.tools.forEach((tool, index) => {
            console.log(`  ${index + 1}. ${tool.name}: ${tool.description}`);
            const requiredParams = tool.parameters?.required || [];
            const allParams = Object.keys(tool.parameters?.properties || {});
            console.log(`     📝 Parameters: ${allParams.join(', ')} ${requiredParams.length > 0 ? `(required: ${requiredParams.join(', ')})` : ''}`);
        });

        const systemPrompt = `You are a specialized knowledge assistant that ALWAYS searches through the user's personal notes to answer questions. Your PRIMARY GOAL is to find relevant information from their note collection.

CRITICAL INSTRUCTIONS:
- ALWAYS use search tools first before answering any question
- NEVER provide general knowledge answers without checking the user's notes
- ASSUME the answer exists somewhere in their notes and search thoroughly
- Use multiple search approaches if the first attempt doesn't yield results
- Even for seemingly general questions, search for related content in their notes first

MANDATORY WORKFLOW:
1. Immediately identify which search tool(s) would find relevant notes
2. Call at least ONE search tool for every query (no exceptions)
3. If first search yields poor results, try different tools or search terms
4. Only after exhausting note searches should you acknowledge if information isn't available
5. ALWAYS ground your response in what was found in their actual notes

The user has a comprehensive note collection - assume it contains valuable context for their questions. Your job is to be their personal knowledge retrieval system, not a general AI assistant.`;

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userQuery }
        ];

        try {
            console.log(`🚀 Calling LLM with system prompt (${systemPrompt.length} chars) and user query`);
            
            // Use native tool calling
            const llmResponse = await this.llmManager.generateResponseWithTools(
                this.config.provider || 'ollama',
                this.config.model || 'llama3.2',
                messages,
                aiTools,
                { temperature: this.config.temperature }
            );

            console.log(`📥 LLM Response Summary:`);
            console.log(`  📝 Content: ${llmResponse.content?.substring(0, 200)}${llmResponse.content?.length > 200 ? '...' : ''}`);
            console.log(`  🔧 Tool calls: ${llmResponse.toolCalls?.length || 0}`);
            console.log(`  💰 Usage: ${llmResponse.usage?.totalTokens || 0} tokens`);

            const toolCalls: AgentToolCall[] = [];
            
            // Execute any tool calls the LLM made
            if (llmResponse.toolCalls && llmResponse.toolCalls.length > 0) {
                console.log(`🛠️ Executing ${llmResponse.toolCalls.length} tool calls from LLM:`);
                
                for (const [index, toolCall] of llmResponse.toolCalls.entries()) {
                    console.log(`\n🔍 Tool ${index + 1}/${llmResponse.toolCalls.length}: ${toolCall.toolName}`);
                    console.log(`  📥 Arguments:`, JSON.stringify(toolCall.args, null, 2));
                    
                    const tool = this.toolMap.get(toolCall.toolName);
                    if (tool) {
                        try {
                            console.log(`  ⏳ Executing ${toolCall.toolName}...`);
                            const startTime = Date.now();
                            const result = await tool.execute(toolCall.args);
                            const duration = Date.now() - startTime;
                            
                            // Check if semantic search returned no results and try intelligent text search
                            if (toolCall.toolName === 'semantic_search' && result.found === 0) {
                                console.log(`  🎯 Semantic search found no results, generating intelligent text search...`);
                                const textSearchQuery = await this.generateTextSearchQuery(toolCall.args.query);
                                
                                if (textSearchQuery && textSearchQuery !== toolCall.args.query) {
                                    console.log(`  📝 Generated text search query: "${textSearchQuery}"`);
                                    
                                    // Execute text search with the intelligent query
                                    const textSearchTool = this.toolMap.get('text_search');
                                    if (textSearchTool) {
                                        try {
                                            const textSearchResult = await textSearchTool.execute({
                                                query: textSearchQuery,
                                                topK: toolCall.args.topK || 5
                                            });
                                            
                                            if (textSearchResult.found > 0) {
                                                console.log(`  ✨ Intelligent text search found ${textSearchResult.found} results!`);
                                                // Use the text search results instead
                                                result.found = textSearchResult.found;
                                                result.results = textSearchResult.results;
                                                result.context = textSearchResult.context;
                                                result.fallback_query = textSearchQuery;
                                            }
                                        } catch (textSearchError) {
                                            console.error(`  ❌ Intelligent text search failed:`, textSearchError);
                                        }
                                    }
                                }
                            }
                            
                            toolCalls.push({
                                toolName: toolCall.toolName,
                                parameters: toolCall.args,
                                result
                            });
                            
                            console.log(`  ✅ ${toolCall.toolName} completed in ${duration}ms`);
                            console.log(`  📊 Result summary:`, {
                                found: result.found || 0,
                                error: result.error || null,
                                resultKeys: Object.keys(result)
                            });
                            
                            if (result.results && result.results.length > 0) {
                                console.log(`  📄 Top results:`);
                                result.results.slice(0, 3).forEach((res: any, i: number) => {
                                    console.log(`    ${i + 1}. ${res.title || res.path || 'Unknown'} ${res.similarity ? `(${Math.round(res.similarity * 100)}% match)` : ''}`);
                                });
                            }
                        } catch (error) {
                            console.error(`  ❌ Tool ${toolCall.toolName} failed:`, (error as Error).message);
                            console.error(`  🔍 Error details:`, error);
                            toolCalls.push({
                                toolName: toolCall.toolName,
                                parameters: toolCall.args,
                                result: { error: (error as Error).message }
                            });
                        }
                    } else {
                        console.error(`  ❌ Unknown tool: ${toolCall.toolName}`);
                        console.error(`  🛠️ Available tools:`, Array.from(this.toolMap.keys()));
                    }
                }

                // If we have tool results, generate a final response with context
                if (toolCalls.length > 0) {
                    console.log(`\n🧠 Generating final response with context from ${toolCalls.length} tool results`);
                    const totalResults = toolCalls.reduce((sum, call) => sum + (call.result?.found || 0), 0);
                    console.log(`  📊 Total items found across all tools: ${totalResults}`);
                    
                    const finalResponse = await this.generateFinalResponse(userQuery, toolCalls);
                    console.log(`  📝 Final response generated: ${finalResponse.length} characters`);
                    
                    return {
                        content: finalResponse,
                        toolCalls,
                        finished: true
                    };
                } else {
                    console.log(`⚠️ Tools were called but no valid results returned`);
                }
            }
            
            // If no tools were called, return the LLM's direct response
            console.log(`💬 No tools called - returning direct LLM response`);
            return {
                content: llmResponse.content || 'No response generated',
                toolCalls: [],
                finished: true
            };
            
        } catch (error) {
            console.error(`❌ Agent processing failed:`, error);
            return {
                content: `Error processing query: ${(error as Error).message}`,
                toolCalls: [],
                finished: true
            };
        }
    }

    async *processQueryStreaming(userQuery: string): AsyncGenerator<{
        type: 'tool_start' | 'tool_result' | 'response_start' | 'response_chunk' | 'response_end';
        data: any;
    }> {
        const toolCalls: AgentToolCall[] = [];
        let currentContext = userQuery;
        let iteration = 0;
        
        while (iteration < this.config.maxIterations) {
            iteration++;
            
            // Ask the LLM what to do next
            const decision = await this.planNextAction(currentContext, toolCalls);
            
            if (decision.finished) {
                yield {
                    type: 'response_start',
                    data: { content: decision.content, toolCalls }
                };
                
                // Stream the final response if it wasn't provided in the decision
                if (!decision.content) {
                    const finalResponse = await this.generateFinalResponseStreaming(userQuery, toolCalls);
                    for await (const chunk of finalResponse) {
                        yield chunk;
                    }
                } else {
                    yield {
                        type: 'response_chunk',
                        data: { chunk: decision.content }
                    };
                }
                
                yield {
                    type: 'response_end',
                    data: { toolCalls, finished: true }
                };
                
                return;
            }
            
            // Execute tool calls if any
            if (decision.toolCall) {
                yield {
                    type: 'tool_start',
                    data: {
                        toolName: decision.toolCall.toolName,
                        parameters: decision.toolCall.parameters
                    }
                };
                
                const tool = this.toolMap.get(decision.toolCall.toolName);
                if (!tool) {
                    console.error(`Unknown tool: ${decision.toolCall.toolName}`);
                    yield {
                        type: 'tool_result',
                        data: { error: `Unknown tool: ${decision.toolCall.toolName}` }
                    };
                    continue;
                }
                
                try {
                    const result = await tool.execute(decision.toolCall.parameters);
                    const toolCall: AgentToolCall = {
                        toolName: decision.toolCall.toolName,
                        parameters: decision.toolCall.parameters,
                        result
                    };
                    
                    toolCalls.push(toolCall);
                    
                    yield {
                        type: 'tool_result',
                        data: { toolCall }
                    };
                    
                    // Update context with the new information
                    currentContext = this.buildContextWithResults(userQuery, toolCalls);
                    
                } catch (error) {
                    console.error(`Tool execution failed:`, error);
                    const errorToolCall = {
                        toolName: decision.toolCall.toolName,
                        parameters: decision.toolCall.parameters,
                        result: { error: (error as Error).message }
                    };
                    
                    toolCalls.push(errorToolCall);
                    
                    yield {
                        type: 'tool_result',
                        data: { toolCall: errorToolCall }
                    };
                }
            }
        }
        
        // If we've reached max iterations, generate final response
        yield {
            type: 'response_start',
            data: { toolCalls }
        };
        
        const finalResponse = this.generateFinalResponseStreaming(userQuery, toolCalls);
        for await (const chunk of finalResponse) {
            yield chunk;
        }
        
        yield {
            type: 'response_end',
            data: { toolCalls, finished: true }
        };
    }

    private async planNextAction(
        context: string, 
        previousToolCalls: AgentToolCall[]
    ): Promise<{ 
        finished: boolean; 
        content?: string; 
        toolCall?: { toolName: string; parameters: any } 
    }> {
        const systemPrompt = this.buildSystemPrompt();
        const userPrompt = this.buildPlanningPrompt(context, previousToolCalls);
        
        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ];
        
        const response = await this.llmManager.generateResponse(
            this.config.provider || 'ollama',
            this.config.model || 'llama3.2',
            messages,
            { temperature: this.config.temperature }
        );
        
        return this.parseAgentDecision(response.content);
    }

    private buildSystemPrompt(): string {
        const toolDescriptions = this.tools.map(tool => 
            `- ${tool.name}: ${tool.description}`
        ).join('\n');
        
        return `You are a specialized note search agent. Your ONLY purpose is to search the user's personal knowledge base and provide answers based EXCLUSIVELY on their notes.

AVAILABLE TOOLS:
${toolDescriptions}

CRITICAL MANDATES:
- ALWAYS search notes first - NO EXCEPTIONS  
- NEVER provide answers without searching
- Use multiple tools if first search yields insufficient results
- Every query must trigger at least one tool call
- Focus on finding information that exists in their note collection
- Format responses exactly as specified below

REQUIRED RESPONSE FORMATS:

To use a tool:
TOOL_CALL: tool_name({"param": "value"})

To provide final answer:
FINAL_ANSWER: [your comprehensive response]

TOOL SELECTION:
- Conceptual/meaning questions → semantic_search
- Exact text/phrases → text_search
- Recent activity → search_recent_notes
- Time-based → search_by_date
- Specific data (phone, VIN) → find_specific_info
- Tagged content → search_by_tags
- Note relationships → search_by_links
- Detailed note info → get_note_details

EXAMPLES:

User: "What did I learn about productivity?"
You: TOOL_CALL: semantic_search({"query": "productivity", "topK": 5})

User: "Find where I mentioned deep work"
You: TOOL_CALL: text_search({"query": "deep work", "max_results": 5})

User: "What did I write recently?"
You: TOOL_CALL: search_recent_notes({"count": 5})

User: "Notes from last month"
You: TOOL_CALL: search_by_date({"start_date": "1 month ago", "end_date": "today"})

IMPORTANT: Always use tools first. Never give direct answers without searching first.`;
    }

    private buildPlanningPrompt(context: string, toolCalls: AgentToolCall[]): string {
        let prompt = `User Query: ${context}\n\n`;
        
        if (toolCalls.length > 0) {
            prompt += `Previous tool calls and results:\n`;
            for (const call of toolCalls) {
                prompt += `\nTool: ${call.toolName}\nParameters: ${JSON.stringify(call.parameters)}\nResult: ${JSON.stringify(call.result, null, 2)}\n`;
            }
            prompt += `\nBased on the above results, what should I do next to better answer the user's query?`;
        } else {
            prompt += `This is a new query. What tool should I use first to find relevant information?`;
        }
        
        return prompt;
    }

    private parseAgentDecision(response: string): { 
        finished: boolean; 
        content?: string; 
        toolCall?: { toolName: string; parameters: any } 
    } {
        const trimmed = response.trim();
        console.log(`🔍 Parsing LLM response: "${trimmed.substring(0, 100)}..."`);
        
        if (trimmed.startsWith('FINAL_ANSWER:')) {
            console.log(`✅ Parsed as FINAL_ANSWER`);
            return {
                finished: true,
                content: trimmed.substring('FINAL_ANSWER:'.length).trim()
            };
        }
        
        if (trimmed.startsWith('TOOL_CALL:')) {
            const toolCallStr = trimmed.substring('TOOL_CALL:'.length).trim();
            console.log(`🛠️ Parsing TOOL_CALL: "${toolCallStr}"`);
            
            // Parse tool call: tool_name({"param": "value"})
            const match = toolCallStr.match(/^(\w+)\((.*)\)$/);
            if (match) {
                const [, toolName, paramsStr] = match;
                console.log(`🎯 Matched tool: ${toolName}, params: ${paramsStr}`);
                try {
                    const parameters = JSON.parse(paramsStr);
                    console.log(`✅ Successfully parsed tool call`);
                    return {
                        finished: false,
                        toolCall: { toolName, parameters }
                    };
                } catch (error) {
                    console.error('❌ Failed to parse tool parameters:', paramsStr, error);
                }
            } else {
                console.error('❌ Failed to match tool call pattern:', toolCallStr);
            }
        }
        
        // If we can't parse the response properly, assume it's a final answer
        console.log(`⚠️ Couldn't parse response, treating as final answer`);
        return {
            finished: true,
            content: response
        };
    }

    private buildContextWithResults(originalQuery: string, toolCalls: AgentToolCall[]): string {
        let context = `Query: "${originalQuery}"\n\n`;
        
        // Prioritize and structure the results for better context management
        const prioritizedResults: Array<{tool: string, results: any[], priority: number}> = [];
        
        for (const call of toolCalls) {
            if (call.result && call.result.results && call.result.results.length > 0) {
                // Assign priority based on tool type and result relevance
                let priority = this.calculateToolPriority(call.toolName);
                if (call.result.results[0].similarity !== undefined) {
                    priority += call.result.results[0].similarity * 10; // Boost semantic matches
                }
                
                prioritizedResults.push({
                    tool: call.toolName,
                    results: call.result.results.slice(0, 3), // Limit to top 3 per tool
                    priority: priority
                });
            }
        }
        
        // Sort by priority (highest first)
        prioritizedResults.sort((a, b) => b.priority - a.priority);
        
        // Build context with smart truncation
        let totalTokens = 0;
        const maxTokens = 4000; // Conservative context window management
        
        for (const group of prioritizedResults) {
            const groupHeader = `\n=== ${group.tool.toUpperCase()} RESULTS ===\n`;
            context += groupHeader;
            totalTokens += this.estimateTokens(groupHeader);
            
            for (const result of group.results) {
                if (totalTokens > maxTokens) break;
                
                const resultText = this.formatResultForContext(result);
                if (totalTokens + this.estimateTokens(resultText) > maxTokens) {
                    context += `\n[Additional results truncated to manage context window]\n`;
                    break;
                }
                
                context += resultText + '\n';
                totalTokens += this.estimateTokens(resultText);
            }
            
            if (totalTokens > maxTokens) break;
        }
        
        return context;
    }
    
    private calculateToolPriority(toolName: string): number {
        const priorities: { [key: string]: number } = {
            'semantic_search': 10,      // Highest priority - conceptual matches
            'find_specific_info': 9,    // High priority - specific data
            'text_search': 8,           // High priority - exact matches
            'search_recent_notes': 7,   // Medium-high - recent activity
            'search_by_date': 6,        // Medium - time-based
            'search_by_tags': 5,        // Medium-low - categorical
            'search_by_links': 4,       // Low - relationship data
            'get_note_details': 3       // Lowest - supplementary info
        };
        return priorities[toolName] || 5;
    }
    
    private formatResultForContext(result: any): string {
        let formatted = `\n**${result.title || result.path}**`;
        if (result.path && result.title !== result.path) {
            formatted += ` (${result.path})`;
        }
        if (result.similarity !== undefined) {
            formatted += ` - Match: ${Math.round(result.similarity * 100)}%`;
        }
        formatted += '\n';
        
        // Add content preview, intelligently truncated
        if (result.content) {
            const preview = result.content.length > 300 
                ? result.content.substring(0, 300) + '...'
                : result.content;
            formatted += preview + '\n';
        }
        
        return formatted;
    }
    
    private estimateTokens(text: string): number {
        // Rough token estimation: ~4 characters per token
        return Math.ceil(text.length / 4);
    }

    private async generateFinalResponse(userQuery: string, toolCalls: AgentToolCall[]): Promise<string> {
        const totalResults = toolCalls.reduce((sum, call) => sum + (call.result?.found || 0), 0);
        
        console.log(`🔬 Final response generation details:`);
        console.log(`  📊 Processing ${toolCalls.length} tool results with ${totalResults} total findings`);
        console.log(`  🎯 Original query: "${userQuery}"`);
        
        toolCalls.forEach((call, index) => {
            console.log(`  📋 Tool ${index + 1}: ${call.toolName} → ${call.result?.found || 0} results`);
        });
        
        const systemPrompt = `You are a personal knowledge synthesis assistant that creates comprehensive answers EXCLUSIVELY from the user's note collection.

SYNTHESIS REQUIREMENTS:
- Build your entire response around information found in their notes
- Quote specific excerpts and reference exact note titles with dates
- Highlight connections between different notes when relevant
- If the notes don't contain direct answers, synthesize insights from related content
- NEVER add external knowledge - only work with what's in their notes
- Reference note titles and creation dates for credibility
- Connect related concepts across different notes
- Highlight key insights and patterns discovered
- Suggest follow-up questions or areas to explore

RESPONSE STRUCTURE:
1. **Direct Answer** - Address the user's question immediately
2. **Key Findings** - Highlight the most important information found
3. **Note References** - Show which notes contributed to the answer
4. **Connections** - Point out relationships between different notes/ideas
5. **Next Steps** - Suggest related questions or areas to explore (if appropriate)

Be conversational yet authoritative. The user trusts these are their own notes, so speak with confidence about the content.`;

        const userPrompt = `User Query: "${userQuery}"

CONTEXT DISCOVERED:
Found ${totalResults} relevant notes through intelligent search.

SEARCH RESULTS:
${this.buildContextWithResults(userQuery, toolCalls)}

Please synthesize this information into a comprehensive, well-structured response that directly addresses the user's query. Focus on the most relevant and recent information first.`;

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ];

        console.log(`  🚀 Calling LLM for final synthesis...`);
        const contextLength = this.buildContextWithResults(userQuery, toolCalls).length;
        console.log(`  📏 Context provided: ${contextLength} characters`);
        
        const response = await this.llmManager.generateResponse(
            this.config.provider || 'ollama',
            this.config.model || 'llama3.2',
            messages,
            { temperature: this.config.temperature }
        );

        console.log(`  ✅ Final synthesis complete: ${response.content.length} characters generated`);
        console.log(`  💰 Synthesis usage: ${response.usage?.totalTokens || 0} tokens`);

        return response.content;
    }

    private async *generateFinalResponseStreaming(userQuery: string, toolCalls: AgentToolCall[]): AsyncGenerator<{
        type: 'response_chunk';
        data: { chunk: string };
    }> {
        const systemPrompt = `You are a personal knowledge assistant that creates answers EXCLUSIVELY from the user's note collection.

Your response MUST:
- Be entirely grounded in the notes found by the search tools
- Quote specific passages with note titles and dates
- Never add general knowledge or external information
- Synthesize insights across multiple notes when relevant
- Acknowledge when information isn't found in their notes
- Structure responses clearly with note references

Focus entirely on what exists in their personal knowledge base.`;

        const userPrompt = `User Query: ${userQuery}

Information gathered from knowledge base:
${this.buildContextWithResults(userQuery, toolCalls)}

Please provide a comprehensive answer to the user's query based on this information.`;

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ];

        try {
            const responseGenerator = this.llmManager.generateStreamingResponse(
                this.config.provider || 'ollama',
                this.config.model || 'llama3.2',
                messages,
                { temperature: this.config.temperature }
            );

            for await (const chunk of responseGenerator) {
                yield {
                    type: 'response_chunk',
                    data: { chunk }
                };
            }
        } catch (error) {
            console.error('Streaming failed, falling back to regular response:', error);
            const response = await this.llmManager.generateResponse(
                this.config.provider || 'ollama',
                this.config.model || 'llama3.2',
                messages,
                { temperature: this.config.temperature }
            );
            
            yield {
                type: 'response_chunk',
                data: { chunk: response.content }
            };
        }
    }

    updateConfig(newConfig: Partial<AgentConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * Generate an intelligent text search query when semantic search fails
     * Uses the LLM to create more specific search terms based on the original query
     */
    private async generateTextSearchQuery(originalQuery: string): Promise<string | null> {
        try {
            const prompt = `You are helping to improve search results. A semantic search for "${originalQuery}" found no results.

Your task is to generate a better, more specific text search query that might find relevant notes. Consider:

1. Alternative keywords and synonyms
2. More specific technical terms
3. Common abbreviations or acronyms
4. Related concepts that might be mentioned in notes
5. Breaking down complex queries into simpler terms

Examples:
- "machine learning models" → "ML model neural network algorithm"
- "database migration strategy" → "database migration SQL schema change"
- "react components" → "React component JSX props state"
- "project management" → "project plan timeline milestone task"

Generate ONLY the improved search query as a response, no explanation needed.

Original query: "${originalQuery}"
Improved query:`;

            const response = await this.llmManager.generateResponse(
                this.config.provider,
                this.config.model,
                [{ role: 'user', content: prompt }],
                { 
                    temperature: 0.1, // Low temperature for consistent, focused results
                    maxTokens: 100    // Short response needed
                }
            );

            const improvedQuery = response.content?.trim();
            
            // Validate the response
            if (improvedQuery && improvedQuery.length > 0 && improvedQuery !== originalQuery) {
                return improvedQuery;
            }
            
            return null;
        } catch (error) {
            console.error('Failed to generate intelligent text search query:', error);
            return null;
        }
    }
}