import { generateText, streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { createOllama } from 'ollama-ai-provider';

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

    constructor(config: LLMProviderConfig) {
        this.config = config;
        this.initializeProviders();
    }

    private initializeProviders() {
        // OpenAI
        if (this.config.openai?.enabled && this.config.openai.apiKey) {
            this.providers.set('openai', {
                name: 'OpenAI',
                models: this.config.openai.models || [
                    'gpt-4.1',
                    'gpt-4.1-mini',
                    'gpt-4.1-nano',
                    'gpt-4o',
                    'gpt-4o-mini',
                    'gpt-4-turbo',
                    'o3',
                    'o4-mini'
                ],
                isLocal: false,
                supportsStreaming: true,
                enabled: true
            });

            this.aiProviders.set('openai', openai);
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

            this.aiProviders.set('anthropic', anthropic);
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
                    'gemini-2.0-flash-thinking',
                    'gemini-2.0-pro',
                    'gemini-1.5-pro',
                    'gemini-1.5-flash'
                ],
                isLocal: false,
                supportsStreaming: true,
                enabled: true
            });

            this.aiProviders.set('google', google);
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
        const aiProvider = this.aiProviders.get(provider);
        if (!aiProvider) {
            throw new Error(`Provider ${provider} not configured or not supported`);
        }

        try {
            // Configure the provider with settings
            const providerConfig = this.config[provider];
            const configuredProvider = provider === 'openai' ? aiProvider({
                apiKey: providerConfig?.apiKey,
                ...(providerConfig?.baseUrl && { baseURL: providerConfig.baseUrl })
            }) : provider === 'anthropic' ? aiProvider({
                apiKey: providerConfig?.apiKey,
                ...(providerConfig?.baseUrl && { baseURL: providerConfig.baseUrl })
            }) : provider === 'google' ? aiProvider({
                apiKey: providerConfig?.apiKey,
                ...(providerConfig?.baseUrl && { baseURL: providerConfig.baseUrl })
            }) : aiProvider;

            const result = await generateText({
                model: configuredProvider(model),
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

            return {
                content: result.text,
                usage,
                provider,
                model
            };
        } catch (error: any) {
            throw new Error(`Failed to generate response from ${provider}: ${error.message}`);
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
                'gpt-4o': { input: 0.005, output: 0.015 },
                'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
                'gpt-4-turbo': { input: 0.01, output: 0.03 },
                'gpt-4': { input: 0.03, output: 0.06 },
                'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 }
            },
            anthropic: {
                'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
                'claude-3-opus-20240229': { input: 0.015, output: 0.075 },
                'claude-3-sonnet-20240229': { input: 0.003, output: 0.015 },
                'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 }
            },
            google: {
                'gemini-1.5-pro': { input: 0.0035, output: 0.0105 },
                'gemini-1.5-flash': { input: 0.000075, output: 0.0003 },
                'gemini-pro': { input: 0.0005, output: 0.0015 }
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
}