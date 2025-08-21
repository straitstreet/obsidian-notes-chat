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
        console.log(`🤖 Agent processing query: "${userQuery}"`);
        const toolCalls: AgentToolCall[] = [];
        let currentContext = userQuery;
        let iteration = 0;
        
        while (iteration < this.config.maxIterations) {
            iteration++;
            console.log(`🔄 Agent iteration ${iteration}/${this.config.maxIterations}`);
            
            // Ask the LLM what to do next
            const decision = await this.planNextAction(currentContext, toolCalls);
            console.log(`🧠 LLM decision:`, { finished: decision.finished, toolCall: decision.toolCall });
            
            if (decision.finished) {
                console.log(`✅ Agent finished with final answer`);
                return {
                    content: decision.content || 'No response provided',
                    toolCalls,
                    finished: true
                };
            }
            
            // Execute tool calls if any
            if (decision.toolCall) {
                console.log(`🛠️ Executing tool: ${decision.toolCall.toolName}`, decision.toolCall.parameters);
                const tool = this.toolMap.get(decision.toolCall.toolName);
                if (!tool) {
                    console.error(`❌ Unknown tool: ${decision.toolCall.toolName}`);
                    console.log(`Available tools: ${Array.from(this.toolMap.keys()).join(', ')}`);
                    continue;
                }
                
                try {
                    const result = await tool.execute(decision.toolCall.parameters);
                    console.log(`✅ Tool result:`, { found: result.found, resultKeys: Object.keys(result) });
                    
                    const toolCall: AgentToolCall = {
                        toolName: decision.toolCall.toolName,
                        parameters: decision.toolCall.parameters,
                        result
                    };
                    
                    toolCalls.push(toolCall);
                    
                    // Update context with the new information
                    currentContext = this.buildContextWithResults(userQuery, toolCalls);
                    
                } catch (error) {
                    console.error(`❌ Tool execution failed:`, error);
                    toolCalls.push({
                        toolName: decision.toolCall.toolName,
                        parameters: decision.toolCall.parameters,
                        result: { error: (error as Error).message }
                    });
                }
            }
        }
        
        // If we've reached max iterations, generate final response
        console.log(`⏳ Max iterations reached, generating final response with ${toolCalls.length} tool calls`);
        const finalResponse = await this.generateFinalResponse(userQuery, toolCalls);
        
        return {
            content: finalResponse,
            toolCalls,
            finished: true
        };
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
        
        return `You are a helpful assistant that searches through a user's personal notes to find information.

AVAILABLE TOOLS:
${toolDescriptions}

INSTRUCTIONS:
1. For each user query, decide which tool(s) will help find the answer
2. Use tools by responding with: TOOL_CALL: tool_name({"param": "value"})
3. After getting tool results, provide a final answer with: FINAL_ANSWER: [your answer]

TOOL SELECTION GUIDE:
- "when was the last..." or "recent..." → use search_recent_notes
- "what's my VIN/phone/email" → use find_specific_info  
- "find text ABC" → use text_search
- "notes about relationships" → use semantic_search
- "notes tagged with X" → use search_by_tags

EXAMPLES:
User: "When was the last note about love?"
You: TOOL_CALL: search_recent_notes({"content_filter": "love", "count": 5})

User: "What's my VIN?" 
You: TOOL_CALL: find_specific_info({"info_type": "vin"})

User: "Find notes about relationships"
You: TOOL_CALL: semantic_search({"query": "relationships", "topK": 5})

Always use tools first to gather information, then provide a comprehensive final answer.`;
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
        let context = `Original Query: ${originalQuery}\n\n`;
        context += `Information gathered so far:\n`;
        
        for (const call of toolCalls) {
            context += `\n--- ${call.toolName} ---\n`;
            context += `Parameters: ${JSON.stringify(call.parameters)}\n`;
            context += `Results: ${JSON.stringify(call.result, null, 2)}\n`;
        }
        
        return context;
    }

    private async generateFinalResponse(userQuery: string, toolCalls: AgentToolCall[]): Promise<string> {
        const systemPrompt = `You are a helpful assistant that synthesizes information from multiple sources to answer user questions about their personal notes. 

Provide a comprehensive, well-structured answer based on the tool results. Include:
- Direct answers to the user's question
- Relevant information found in their notes
- Specific note references (titles and paths)
- Suggestions for further exploration if relevant

Be conversational and helpful. Structure your response clearly with headings if appropriate.`;

        const userPrompt = `User Query: ${userQuery}

Information gathered from knowledge base:
${this.buildContextWithResults(userQuery, toolCalls)}

Please provide a comprehensive answer to the user's query based on this information.`;

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

        return response.content;
    }

    private async *generateFinalResponseStreaming(userQuery: string, toolCalls: AgentToolCall[]): AsyncGenerator<{
        type: 'response_chunk';
        data: { chunk: string };
    }> {
        const systemPrompt = `You are a helpful assistant that synthesizes information from multiple sources to answer user questions about their personal notes. 

Provide a comprehensive, well-structured answer based on the tool results. Include:
- Direct answers to the user's question
- Relevant information found in their notes
- Specific note references (titles and paths)
- Suggestions for further exploration if relevant

Be conversational and helpful. Structure your response clearly with headings if appropriate.`;

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
}