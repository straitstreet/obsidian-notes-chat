import { generateText, streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOllama } from 'ollama-ai-provider';
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
    private aiProviders = new Map<string, any>();
    private budgetManager?: BudgetManager;
    private budgetNotifications?: BudgetNotifications;

    constructor(config: LLMProviderConfig, budgetManager?: BudgetManager, budgetNotifications?: BudgetNotifications) {
        this.config = config;
        this.budgetManager = budgetManager;
        this.budgetNotifications = budgetNotifications;
        this.initializeProviders();
    }

    private initializeProviders() {
        // OpenAI
        if (this.config.openai?.enabled && this.config.openai.apiKey) {
            this.providers.set('openai', {
                name: 'OpenAI',
                models: this.config.openai.models || [
                    'gpt-5',
                    'gpt-5-mini',
                    'gpt-5-nano',
                    'gpt-4.1',
                    'gpt-4.1-mini',
                    'gpt-4.1-nano',
                    'gpt-4.5',
                    'o3-mini',
                    'gpt-4o',
                    'gpt-4o-mini'
                ],
                isLocal: false,
                supportsStreaming: true,
                enabled: true
            });

            this.aiProviders.set('openai', createOpenAI({
                apiKey: this.config.openai.apiKey,
                ...(this.config.openai.baseUrl && { baseURL: this.config.openai.baseUrl }),
                fetch: async (url, init) => {
                    const response = await requestUrl({
                        url: url.toString(),
                        method: init?.method as any || 'GET',
                        headers: init?.headers as Record<string, string>,
                        body: init?.body as string,
                        throw: false
                    });
                    return new Response(response.text, {
                        status: response.status,
                        headers: response.headers
                    });
                }
            }));
        }

        // Anthropic
        if (this.config.anthropic?.enabled && this.config.anthropic.apiKey) {
            this.providers.set('anthropic', {
                name: 'Anthropic',
                models: this.config.anthropic.models || [
                    'claude-4-opus-4.1',
                    'claude-4-sonnet',
                    'claude-3.7-sonnet',
                    'claude-3-5-sonnet-20241022',
                    'claude-3-5-haiku-20241022',
                    'claude-3-opus-20240229'
                ],
                isLocal: false,
                supportsStreaming: true,
                enabled: true
            });

            this.aiProviders.set('anthropic', createAnthropic({
                apiKey: this.config.anthropic.apiKey,
                ...(this.config.anthropic.baseUrl && { baseURL: this.config.anthropic.baseUrl }),
                fetch: async (url, init) => {
                    const response = await requestUrl({
                        url: url.toString(),
                        method: init?.method as any || 'GET',
                        headers: init?.headers as Record<string, string>,
                        body: init?.body as string,
                        throw: false
                    });
                    return new Response(response.text, {
                        status: response.status,
                        headers: response.headers
                    });
                }
            }));
        }

        // Google
        if (this.config.google?.enabled && this.config.google.apiKey) {
            this.providers.set('google', {
                name: 'Google Gemini',
                models: this.config.google.models || [
                    'gemini-2.5-pro',
                    'gemini-2.5-flash',
                    'gemini-2.5-flash-lite',
                    'gemini-2.0-flash',
                    'gemini-2.0-pro',
                    'gemini-2.0-flash-lite',
                    'gemini-1.5-pro-latest',
                    'gemini-1.5-flash-latest'
                ],
                isLocal: false,
                supportsStreaming: true,
                enabled: true
            });

            this.aiProviders.set('google', createGoogleGenerativeAI({
                apiKey: this.config.google.apiKey,
                ...(this.config.google.baseUrl && { baseURL: this.config.google.baseUrl }),
                fetch: async (url, init) => {
                    const response = await requestUrl({
                        url: url.toString(),
                        method: init?.method as any || 'GET',
                        headers: init?.headers as Record<string, string>,
                        body: init?.body as string,
                        throw: false
                    });
                    return new Response(response.text, {
                        status: response.status,
                        headers: response.headers
                    });
                }
            }));
        }

        // Ollama (Local)
        if (this.config.ollama?.enabled) {
            this.providers.set('ollama', {
                name: 'Ollama (Local)',
                models: this.config.ollama.models || [
                    'llama3.2',
                    'llama3.1',
                    'llama2',
                    'codellama',
                    'mistral',
                    'mixtral',
                    'qwen2.5'
                ],
                isLocal: true,
                supportsStreaming: true,
                enabled: true
            });

            this.aiProviders.set('ollama', createOllama({
                baseURL: this.config.ollama.baseUrl || 'http://localhost:11434'
            }));
        }

        // Groq
        if (this.config.groq?.enabled && this.config.groq.apiKey) {
            this.providers.set('groq', {
                name: 'Groq',
                models: this.config.groq.models || [
                    'llama-3.1-70b-versatile',
                    'llama-3.1-8b-instant',
                    'mixtral-8x7b-32768',
                    'gemma2-9b-it'
                ],
                isLocal: false,
                supportsStreaming: true,
                enabled: true
            });
        }

        // Together
        if (this.config.together?.enabled && this.config.together.apiKey) {
            this.providers.set('together', {
                name: 'Together AI',
                models: this.config.together.models || [
                    'meta-llama/Llama-3-70b-chat-hf',
                    'meta-llama/Llama-3-8b-chat-hf',
                    'mistralai/Mixtral-8x7B-Instruct-v0.1',
                    'NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO'
                ],
                isLocal: false,
                supportsStreaming: true,
                enabled: true
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
        const aiProvider = this.aiProviders.get(provider);
        if (!aiProvider) {
            throw new Error(`Provider ${provider} not configured or not supported`);
        }

        try {
            // Use the pre-configured provider

            const result = await generateText({
                model: aiProvider(model),
                messages: messages as any,
                maxTokens: options.maxTokens || 1000,
                temperature: options.temperature || 0.7,
            });

            const usage = result.usage ? {
                inputTokens: result.usage.promptTokens,
                outputTokens: result.usage.completionTokens,
                totalTokens: result.usage.totalTokens,
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
                content: result.text,
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

    async *generateStreamingResponse(
        provider: string,
        model: string,
        messages: Array<{ role: string; content: string }>,
        options: {
            maxTokens?: number;
            temperature?: number;
        } = {}
    ) {
        const aiProvider = this.aiProviders.get(provider);
        if (!aiProvider) {
            throw new Error(`Provider ${provider} not configured or not supported`);
        }

        const result = await streamText({
            model: aiProvider(model),
            messages: messages as any,
            maxTokens: options.maxTokens || 1000,
            temperature: options.temperature || 0.7,
        });

        for await (const delta of result.textStream) {
            yield delta;
        }

        const finalUsage = await result.usage;
        if (finalUsage) {
            return {
                usage: {
                    inputTokens: finalUsage.promptTokens,
                    outputTokens: finalUsage.completionTokens,
                    totalTokens: finalUsage.totalTokens,
                    cost: this.calculateCost(provider, model, finalUsage)
                },
                provider,
                model
            };
        }
    }

    private calculateCost(provider: string, model: string, usage: any): number {
        // Simplified cost calculation - you can make this more detailed
        const costPer1kTokens: { [key: string]: { [model: string]: { input: number; output: number } } } = {
            openai: {
                'gpt-5': { input: 0.01, output: 0.03 },
                'gpt-5-mini': { input: 0.002, output: 0.008 },
                'gpt-5-nano': { input: 0.0005, output: 0.002 },
                'gpt-4.1': { input: 0.008, output: 0.025 },
                'gpt-4.1-mini': { input: 0.001, output: 0.004 },
                'gpt-4.1-nano': { input: 0.0003, output: 0.001 },
                'gpt-4.5': { input: 0.006, output: 0.02 },
                'o3-mini': { input: 0.004, output: 0.016 },
                'gpt-4o': { input: 0.005, output: 0.015 },
                'gpt-4o-mini': { input: 0.00015, output: 0.0006 }
            },
            anthropic: {
                'claude-4-opus-4.1': { input: 0.015, output: 0.075 },
                'claude-4-sonnet': { input: 0.003, output: 0.015 },
                'claude-3.7-sonnet': { input: 0.003, output: 0.015 },
                'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
                'claude-3-5-haiku-20241022': { input: 0.00025, output: 0.00125 },
                'claude-3-opus-20240229': { input: 0.015, output: 0.075 }
            },
            google: {
                'gemini-2.5-pro': { input: 0.004, output: 0.012 },
                'gemini-2.5-flash': { input: 0.0001, output: 0.0004 },
                'gemini-2.5-flash-lite': { input: 0.00005, output: 0.0002 },
                'gemini-2.0-flash': { input: 0.0002, output: 0.0008 },
                'gemini-2.0-pro': { input: 0.005, output: 0.015 },
                'gemini-2.0-flash-lite': { input: 0.00005, output: 0.0002 },
                'gemini-1.5-pro-latest': { input: 0.0035, output: 0.0105 },
                'gemini-1.5-flash-latest': { input: 0.000075, output: 0.0003 }
            },
            ollama: {},  // Local models are free
            groq: {
                'llama-3.1-70b-versatile': { input: 0.00059, output: 0.00079 },
                'llama-3.1-8b-instant': { input: 0.00005, output: 0.00008 }
            }
        };

        const providerPricing = costPer1kTokens[provider];
        if (!providerPricing || !providerPricing[model]) {
            return 0; // Unknown pricing or local model
        }

        const modelPricing = providerPricing[model];
        const inputCost = (usage.promptTokens / 1000) * modelPricing.input;
        const outputCost = (usage.completionTokens / 1000) * modelPricing.output;
        
        return inputCost + outputCost;
    }

    updateConfig(newConfig: LLMProviderConfig) {
        this.config = { ...this.config, ...newConfig };
        this.providers.clear();
        this.aiProviders.clear();
        this.initializeProviders();
    }

    getProviderStatus(): { [provider: string]: { enabled: boolean; configured: boolean; models: number } } {
        const status: any = {};
        
        for (const [name, provider] of this.providers) {
            status[name] = {
                enabled: provider.enabled,
                configured: this.aiProviders.has(name),
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
            promptTokens: estimatedInputTokens,
            completionTokens: estimatedOutputTokens,
            totalTokens: estimatedInputTokens + estimatedOutputTokens
        });
    }

    setBudgetManager(budgetManager: BudgetManager): void {
        this.budgetManager = budgetManager;
    }

    setBudgetNotifications(budgetNotifications: BudgetNotifications): void {
        this.budgetNotifications = budgetNotifications;
    }
}