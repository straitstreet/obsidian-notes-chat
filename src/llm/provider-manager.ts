import { TokenJS, ChatCompletionTool } from 'token.js';
import { requestUrl } from 'obsidian';
import { BudgetManager } from '../budget/budget-manager';
import { BudgetNotifications } from '../budget/budget-notifications';

export interface LLMProvider {
    name: string;
    models: string[];
    isLocal: boolean;
    supportsStreaming: boolean;
    enabled: boolean;
}

export interface LLMResponse {
    content: string;
    usage?: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
        cost?: number;
    };
    provider: string;
    model: string;
    toolCalls?: Array<{
        toolName: string;
        args: any;
    }>;
}

export interface LLMProviderConfig {
    [key: string]: {
        apiKey?: string;
        baseUrl?: string;
        enabled: boolean;
        models?: string[];
    };
}

export class LLMProviderManager {
    private providers = new Map<string, LLMProvider>();
    private config: LLMProviderConfig;
    private tokenjs: TokenJS;
    private budgetManager?: BudgetManager;
    private budgetNotifications?: BudgetNotifications;

    constructor(config: LLMProviderConfig, budgetManager?: BudgetManager, budgetNotifications?: BudgetNotifications) {
        this.config = config;
        this.budgetManager = budgetManager;
        this.budgetNotifications = budgetNotifications;
        this.tokenjs = new TokenJS();
        this.initializeProviders();
    }

    private initializeProviders() {
        // Set environment variables for Token.js
        if (this.config.openai?.apiKey) {
            process.env.OPENAI_API_KEY = this.config.openai.apiKey;
        }
        if (this.config.anthropic?.apiKey) {
            process.env.ANTHROPIC_API_KEY = this.config.anthropic.apiKey;
        }
        if (this.config.google?.apiKey) {
            process.env.GEMINI_API_KEY = this.config.google.apiKey;
        }
        if (this.config.groq?.apiKey) {
            process.env.GROQ_API_KEY = this.config.groq.apiKey;
        }
        if (this.config.mistral?.apiKey) {
            process.env.MISTRAL_API_KEY = this.config.mistral.apiKey;
        }
        // Cohere removed - using only Token.js supported providers
        if (this.config.perplexity?.apiKey) {
            process.env.PERPLEXITY_API_KEY = this.config.perplexity.apiKey;
        }
        if (this.config.openrouter?.apiKey) {
            process.env.OPENROUTER_API_KEY = this.config.openrouter.apiKey;
        }

        // OpenAI
        if (this.config.openai?.enabled) {
            this.providers.set('openai', {
                name: 'OpenAI',
                models: this.config.openai.models || [
                    'gpt-4.5-preview',
                    'gpt-4.1',
                    'gpt-4o',
                    'gpt-4o-mini',
                    'o3-mini',
                    'o1-mini',
                    'gpt-4-turbo',
                    'gpt-3.5-turbo'
                ],
                isLocal: false,
                supportsStreaming: true,
                enabled: true
            });
        }

        // Anthropic
        if (this.config.anthropic?.enabled) {
            this.providers.set('anthropic', {
                name: 'Anthropic',
                models: this.config.anthropic.models || [
                    'claude-3-5-sonnet-latest',
                    'claude-3-5-haiku-20241022'
                ],
                isLocal: false,
                supportsStreaming: true,
                enabled: true
            });
        }

        // Google Gemini
        if (this.config.google?.enabled) {
            this.providers.set('gemini', {
                name: 'Google Gemini',
                models: this.config.google.models || [
                    'gemini-2.0-flash-001',
                    'gemini-2.0-flash-lite-preview-02-05',
                    'gemini-1.5-pro',
                    'gemini-1.5-flash',
                    'gemini-1.5-flash-8b',
                    'gemini-1.0-pro'
                ],
                isLocal: false,
                supportsStreaming: true,
                enabled: true
            });
        }

        // Groq
        if (this.config.groq?.enabled) {
            this.providers.set('groq', {
                name: 'Groq',
                models: this.config.groq.models || [
                    'llama-3.3-70b-versatile',
                    'llama-3.1-8b-instant',
                    'llama3-70b-8192',
                    'mixtral-8x7b-32768',
                    'gemma2-9b-it'
                ],
                isLocal: false,
                supportsStreaming: true,
                enabled: true
            });
        }

        // Mistral
        if (this.config.mistral?.enabled) {
            this.providers.set('mistral', {
                name: 'Mistral',
                models: this.config.mistral.models || [
                    'mistral-large-latest',
                    'mistral-large-2402',
                    'open-mixtral-8x22b',
                    'open-mixtral-8x7b',
                    'codestral-latest'
                ],
                isLocal: false,
                supportsStreaming: true,
                enabled: true
            });
        }

        // Cohere removed - causing bundling issues with process/ module

        // Perplexity
        if (this.config.perplexity?.enabled) {
            this.providers.set('perplexity', {
                name: 'Perplexity',
                models: this.config.perplexity.models || [
                    'llama-3.1-sonar-large-128k-online',
                    'llama-3.1-sonar-small-128k-online',
                    'llama-3.1-sonar-huge-128k-online'
                ],
                isLocal: false,
                supportsStreaming: true,
                enabled: true
            });
        }

        // OpenRouter
        if (this.config.openrouter?.enabled) {
            this.providers.set('openrouter', {
                name: 'OpenRouter',
                models: this.config.openrouter.models || [
                    'anthropic/claude-3.5-sonnet',
                    'openai/gpt-4-turbo',
                    'meta-llama/llama-3.1-70b-instruct',
                    'google/gemini-pro-1.5'
                ],
                isLocal: false,
                supportsStreaming: true,
                enabled: true
            });
        }

        // Ollama (Local) - OpenAI Compatible
        if (this.config.ollama?.enabled) {
            this.providers.set('ollama', {
                name: 'Ollama (Local)',
                models: this.config.ollama.models || [
                    'llama3.2',
                    'llama3.1',
                    'codellama',
                    'mistral',
                    'mixtral',
                    'qwen2.5'
                ],
                isLocal: true,
                supportsStreaming: true,
                enabled: true
            });
            
            // Configure Token.js for Ollama
            this.tokenjs = new TokenJS({
                baseURL: this.config.ollama.baseUrl || 'http://localhost:11434/v1/'
            });
        }
    }

    getAvailableProviders(): string[] {
        return Array.from(this.providers.keys()).filter(
            name => this.providers.get(name)?.enabled
        );
    }

    getProvider(name: string): LLMProvider | undefined {
        return this.providers.get(name);
    }

    getModelsForProvider(providerName: string): string[] {
        const provider = this.providers.get(providerName);
        return provider?.enabled ? provider.models : [];
    }

    async generateResponse(
        provider: string,
        model: string,
        messages: Array<{ role: string; content: string }>,
        options: {
            maxTokens?: number;
            temperature?: number;
            stream?: boolean;
        } = {}
    ): Promise<LLMResponse> {
        // Check budget before making request
        if (this.budgetManager) {
            const estimatedCost = this.estimateRequestCost(provider, model, messages, options.maxTokens);
            if (!this.budgetManager.canAffordRequest(estimatedCost)) {
                const status = this.budgetManager.getBudgetStatus();
                throw new Error(`Budget exceeded. Current spend: $${status.currentSpend.toFixed(2)}/${status.monthlyLimit.toFixed(2)}`);
            }
        }
        
        const providerConfig = this.providers.get(provider);
        if (!providerConfig?.enabled) {
            throw new Error(`Provider ${provider} not configured or not supported`);
        }

        try {
            // Use Token.js for unified provider access
            const tokenjsProvider = provider === 'google' ? 'gemini' : provider;
            const result = await this.tokenjs.chat.completions.create({
                provider: tokenjsProvider as any,
                model,
                messages: messages.map(m => ({
                    role: m.role as 'user' | 'assistant' | 'system',
                    content: m.content
                })),
                max_tokens: options.maxTokens || 1000,
                temperature: options.temperature || 0.7,
            });

            const usage = result.usage ? {
                inputTokens: result.usage.prompt_tokens,
                outputTokens: result.usage.completion_tokens,
                totalTokens: result.usage.total_tokens,
                cost: this.calculateCost(provider, model, result.usage)
            } : undefined;

            // Record usage in budget manager
            if (this.budgetManager && usage) {
                this.budgetManager.recordUsage({
                    provider,
                    model,
                    cost: usage.cost || 0,
                    inputTokens: usage.inputTokens,
                    outputTokens: usage.outputTokens,
                    totalTokens: usage.totalTokens
                });

                // Check budget status and show notifications
                if (this.budgetNotifications) {
                    const status = this.budgetManager.getBudgetStatus();
                    this.budgetNotifications.checkAndNotify(status);
                    this.budgetNotifications.showCostNotification(usage.cost || 0, provider, model);
                }
            }

            return {
                content: result.choices[0]?.message?.content || '',
                usage,
                provider,
                model
            };
        } catch (error: any) {
            // Preserve original error details for better debugging
            const errorMessage = error.message || 'Unknown error';
            const errorDetails = error.response?.data || error.cause || error.stack || '';
            const fullError = errorDetails ? `${errorMessage}\nDetails: ${JSON.stringify(errorDetails, null, 2)}` : errorMessage;
            throw new Error(`Failed to generate response from ${provider}: ${fullError}`);
        }
    }

    async generateResponseWithTools(
        provider: string,
        model: string,
        messages: Array<{ role: string; content: string }>,
        tools: Array<{
            name: string;
            description: string;
            parameters: any;
        }>,
        options: {
            maxTokens?: number;
            temperature?: number;
        } = {}
    ): Promise<LLMResponse> {
        // Check budget before making request
        if (this.budgetManager) {
            const estimatedCost = this.estimateRequestCost(provider, model, messages, options.maxTokens);
            if (!this.budgetManager.canAffordRequest(estimatedCost)) {
                const status = this.budgetManager.getBudgetStatus();
                throw new Error(`Budget exceeded. Current spend: $${status.currentSpend.toFixed(2)}/${status.monthlyLimit.toFixed(2)}`);
            }
        }

        const providerConfig = this.providers.get(provider);
        if (!providerConfig?.enabled) {
            throw new Error(`Provider ${provider} not configured or not supported`);
        }

        try {
            // Convert tools to OpenAI function calling format for Token.js
            const aiTools: ChatCompletionTool[] = tools.map(tool => ({
                type: 'function' as const,
                function: {
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.parameters
                }
            }));
            
            console.log(`🤖 [${provider}/${model}] Generating response with ${tools.length} tools available:`);
            tools.forEach(tool => {
                console.log(`  📋 Tool: ${tool.name} - ${tool.description}`);
            });
            
            console.log(`💬 Messages sent to LLM:`, messages.map(m => ({ role: m.role, content: m.content.substring(0, 100) + '...' })));
            console.log(`⚙️ Request options:`, { maxTokens: options.maxTokens || 1000, temperature: options.temperature || 0.7 });

            const tokenjsProvider = provider === 'google' ? 'gemini' : provider;
            const result = await this.tokenjs.chat.completions.create({
                provider: tokenjsProvider as any,
                model,
                messages: messages.map(m => ({
                    role: m.role as 'user' | 'assistant' | 'system',
                    content: m.content
                })),
                tools: aiTools,
                tool_choice: 'auto',
                max_tokens: options.maxTokens || 1000,
                temperature: options.temperature || 0.7,
            });
            
            console.log(`✅ LLM response received from ${provider}:`);
            console.log(`📝 Content length:`, result.choices[0]?.message?.content?.length || 0, 'characters');
            console.log(`🔧 Tool calls received:`, result.choices[0]?.message?.tool_calls?.length || 0);
            if (result.choices[0]?.message?.tool_calls && result.choices[0].message.tool_calls.length > 0) {
                result.choices[0].message.tool_calls.forEach((call, index) => {
                    console.log(`  🛠️ Tool ${index + 1}: ${call.function?.name}`, call.function?.arguments);
                });
            }

            const usage = result.usage ? {
                inputTokens: result.usage.prompt_tokens,
                outputTokens: result.usage.completion_tokens,
                totalTokens: result.usage.total_tokens,
                cost: this.calculateCost(provider, model, result.usage)
            } : undefined;

            // Record usage in budget manager
            if (this.budgetManager && usage) {
                this.budgetManager.recordUsage({
                    provider,
                    model,
                    cost: usage.cost || 0,
                    inputTokens: usage.inputTokens,
                    outputTokens: usage.outputTokens,
                    totalTokens: usage.totalTokens
                });

                // Check budget status and show notifications
                if (this.budgetNotifications) {
                    const status = this.budgetManager.getBudgetStatus();
                    this.budgetNotifications.checkAndNotify(status);
                    this.budgetNotifications.showCostNotification(usage.cost || 0, provider, model);
                }
            }

            // Extract tool calls if any
            const toolCalls = result.choices[0]?.message?.tool_calls ? 
                result.choices[0].message.tool_calls.map(call => ({
                    toolName: call.function?.name || '',
                    args: call.function?.arguments ? JSON.parse(call.function.arguments) : {}
                })) : undefined;

            return {
                content: result.choices[0]?.message?.content || '',
                usage,
                provider,
                model,
                toolCalls
            };
        } catch (error) {
            console.error(`Error generating response with tools for ${provider}:`, error);
            throw new Error(`Failed to generate response: ${(error as Error).message}`);
        }
    }

    async *generateStreamingResponse(
        provider: string,
        model: string,
        messages: Array<{ role: string; content: string }>,
        options: {
            maxTokens?: number;
            temperature?: number;
        } = {}
    ) {
        const providerConfig = this.providers.get(provider);
        if (!providerConfig?.enabled) {
            throw new Error(`Provider ${provider} not configured or not supported`);
        }

        const tokenjsProvider = provider === 'google' ? 'gemini' : provider;
        const result = await this.tokenjs.chat.completions.create({
            provider: tokenjsProvider as any,
            model,
            messages: messages.map(m => ({
                role: m.role as 'user' | 'assistant' | 'system',
                content: m.content
            })),
            max_tokens: options.maxTokens || 1000,
            temperature: options.temperature || 0.7,
            stream: true
        }) as any;

        for await (const chunk of result) {
            const content = chunk.choices?.[0]?.delta?.content;
            if (content) {
                yield content;
            }
        }
    }

    private calculateCost(provider: string, model: string, usage: any): number {
        // Updated cost calculation with Token.js usage format
        const costPer1kTokens: { [key: string]: { [model: string]: { input: number; output: number } } } = {
            openai: {
                'gpt-4.5-preview': { input: 0.01, output: 0.03 },
                'gpt-4.1': { input: 0.008, output: 0.025 },
                'gpt-4o': { input: 0.005, output: 0.015 },
                'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
                'o3-mini': { input: 0.004, output: 0.016 },
                'o1-mini': { input: 0.003, output: 0.012 },
                'gpt-4-turbo': { input: 0.01, output: 0.03 },
                'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 }
            },
            anthropic: {
                'claude-3-5-sonnet-latest': { input: 0.003, output: 0.015 },
                'claude-3-5-haiku-20241022': { input: 0.00025, output: 0.00125 }
            },
            gemini: {
                'gemini-2.0-flash-001': { input: 0.0001, output: 0.0004 },
                'gemini-2.0-flash-lite-preview-02-05': { input: 0.00005, output: 0.0002 },
                'gemini-1.5-pro': { input: 0.0035, output: 0.0105 },
                'gemini-1.5-flash': { input: 0.000075, output: 0.0003 },
                'gemini-1.5-flash-8b': { input: 0.0000375, output: 0.00015 },
                'gemini-1.0-pro': { input: 0.0005, output: 0.0015 }
            },
            groq: {
                'llama-3.3-70b-versatile': { input: 0.00059, output: 0.00079 },
                'llama-3.1-8b-instant': { input: 0.00005, output: 0.00008 },
                'llama3-70b-8192': { input: 0.00059, output: 0.00079 },
                'mixtral-8x7b-32768': { input: 0.00024, output: 0.00024 },
                'gemma2-9b-it': { input: 0.00002, output: 0.00002 }
            },
            mistral: {
                'mistral-large-latest': { input: 0.004, output: 0.012 },
                'mistral-large-2402': { input: 0.004, output: 0.012 },
                'open-mixtral-8x22b': { input: 0.0006, output: 0.0006 },
                'open-mixtral-8x7b': { input: 0.0007, output: 0.0007 },
                'codestral-latest': { input: 0.001, output: 0.003 }
            },
            // cohere removed - causing bundling issues
            perplexity: {
                'llama-3.1-sonar-large-128k-online': { input: 0.001, output: 0.001 },
                'llama-3.1-sonar-small-128k-online': { input: 0.0002, output: 0.0002 },
                'llama-3.1-sonar-huge-128k-online': { input: 0.005, output: 0.005 }
            },
            openrouter: {},  // Variable pricing
            ollama: {}  // Local models are free
        };

        const providerPricing = costPer1kTokens[provider];
        if (!providerPricing || !providerPricing[model]) {
            return 0; // Unknown pricing or local model
        }

        const modelPricing = providerPricing[model];
        const inputTokens = usage.prompt_tokens || usage.promptTokens || 0;
        const outputTokens = usage.completion_tokens || usage.completionTokens || 0;
        const inputCost = (inputTokens / 1000) * modelPricing.input;
        const outputCost = (outputTokens / 1000) * modelPricing.output;
        
        return inputCost + outputCost;
    }

    updateConfig(newConfig: LLMProviderConfig) {
        this.config = { ...this.config, ...newConfig };
        this.providers.clear();
        this.initializeProviders();
    }

    getProviderStatus(): { [provider: string]: { enabled: boolean; configured: boolean; models: number } } {
        const status: any = {};
        
        for (const [name, provider] of this.providers) {
            status[name] = {
                enabled: provider.enabled,
                configured: true, // Token.js handles configuration
                models: provider.models.length
            };
        }
        
        return status;
    }

    private estimateRequestCost(provider: string, model: string, messages: Array<{ role: string; content: string }>, maxTokens = 1000): number {
        // Rough estimation based on input tokens and expected output
        const inputText = messages.map(m => m.content).join(' ');
        const estimatedInputTokens = Math.ceil(inputText.length / 4); // Rough approximation
        const estimatedOutputTokens = Math.min(maxTokens, 500); // Conservative estimate
        
        return this.calculateCost(provider, model, {
            prompt_tokens: estimatedInputTokens,
            completion_tokens: estimatedOutputTokens,
            total_tokens: estimatedInputTokens + estimatedOutputTokens
        });
    }

    setBudgetManager(budgetManager: BudgetManager): void {
        this.budgetManager = budgetManager;
    }

    setBudgetNotifications(budgetNotifications: BudgetNotifications): void {
        this.budgetNotifications = budgetNotifications;
    }
}