import { ItemView, WorkspaceLeaf, Notice } from 'obsidian';
import { LLMProviderManager, LLMResponse } from '../llm/provider-manager';
import { KnowledgeGraph, SearchContext } from '../kb/knowledge-graph';
import { BudgetManager } from '../budget/budget-manager';
import { KnowledgeAgent, AgentConfig } from '../agent/knowledge-agent';
// Simplified - no user configuration needed
// Will automatically pick best available model

export const VIEW_TYPE_CHAT = 'chat-with-notes-view';

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    provider?: string;
    model?: string;
    usage?: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
        cost?: number;
    };
    relatedNotes?: string[];
    agentToolCalls?: any[];
}

export class ChatView extends ItemView {
    private llmManager: LLMProviderManager;
    private knowledgeAgent?: KnowledgeAgent;
    
    private currentQuestion = '';
    private currentAnswer = '';
    private isProcessing = false;
    
    private container!: HTMLElement;
    private inputArea!: HTMLTextAreaElement;
    private sendButton!: HTMLButtonElement;
    private resultArea!: HTMLElement;

    constructor(
        leaf: WorkspaceLeaf,
        llmManager: LLMProviderManager,
        knowledgeGraph?: KnowledgeGraph
    ) {
        super(leaf);
        this.llmManager = llmManager;
        
        // Initialize knowledge agent with best available model
        if (knowledgeGraph) {
            const { provider, model } = this.getBestAvailableModel();
            this.knowledgeAgent = new KnowledgeAgent(
                this.llmManager,
                knowledgeGraph,
                {
                    provider,
                    model,
                    maxIterations: 3,
                    temperature: 0.3
                }
            );
        }
    }

    getViewType() {
        return VIEW_TYPE_CHAT;
    }

    getDisplayText() {
        return 'Chat with Notes';
    }

    getIcon() {
        return 'message-circle';
    }

    async onOpen() {
        this.container = this.containerEl.children[1] as HTMLElement;
        this.container.empty();
        this.container.addClass('simple-chat-container');

        this.buildInterface();
    }

    private buildInterface() {
        // Simple search-style interface
        const searchContainer = this.container.createEl('div', { cls: 'search-container' });
        
        // Input row
        const inputRow = searchContainer.createEl('div', { cls: 'search-input-row' });
        
        this.inputArea = inputRow.createEl('textarea', {
            cls: 'search-input',
            attr: {
                placeholder: 'Ask a question about your notes...',
                rows: '1'
            }
        }) as HTMLTextAreaElement;

        this.sendButton = inputRow.createEl('button', {
            cls: 'search-button'
        }) as HTMLButtonElement;
        
        // Use Obsidian's built-in search icon
        this.sendButton.createEl('span', { cls: 'search-icon' });
        this.sendButton.querySelector('.search-icon')?.setAttr('data-lucide', 'search');

        // Result area
        this.resultArea = this.container.createEl('div', { cls: 'result-area' });

        // Event listeners
        this.inputArea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSearch();
            }
        });

        this.sendButton.addEventListener('click', () => {
            this.handleSearch();
        });

        // Auto-resize textarea
        this.inputArea.addEventListener('input', () => {
            this.inputArea.style.height = 'auto';
            this.inputArea.style.height = Math.min(this.inputArea.scrollHeight, 120) + 'px';
        });
        
        this.inputArea.focus();
    }

    private getBestAvailableModel(): { provider: string, model: string } {
        const providers = this.llmManager.getAvailableProviders();
        
        // Prefer fast, cheap models for search-style interface
        if (providers.includes('anthropic')) {
            return { provider: 'anthropic', model: 'claude-3-5-haiku-20241022' };
        }
        if (providers.includes('openai')) {
            return { provider: 'openai', model: 'gpt-4o-mini' };
        }
        if (providers.includes('ollama')) {
            return { provider: 'ollama', model: 'llama3.2' };
        }
        
        // Fallback to first available
        const provider = providers[0];
        const models = this.llmManager.getModelsForProvider(provider);
        return { provider, model: models[0] };
    }

    private async handleSearch() {
        const question = this.inputArea.value?.trim();
        if (!question || this.isProcessing) return;

        this.isProcessing = true;
        this.updateUIState(true);
        
        this.currentQuestion = question;
        this.currentAnswer = '';
        
        // Clear input and show current question
        this.inputArea.value = '';
        this.inputArea.style.height = 'auto';
        this.displayCurrentSearch();

        try {
            if (this.knowledgeAgent) {
                // Use knowledge agent to search notes
                const response = await this.knowledgeAgent.processQuery(question);
                this.currentAnswer = response.content || 'No answer found.';
            } else {
                // Fallback to direct LLM without note context
                const { provider, model } = this.getBestAvailableModel();
                const response = await this.llmManager.generateResponse(
                    provider,
                    model,
                    [{ role: 'user', content: question }],
                    { temperature: 0.3 }
                );
                this.currentAnswer = response.content;
            }
            
        } catch (error) {
            console.error('Search failed:', error);
            this.currentAnswer = 'Sorry, I encountered an error while searching your notes.';
        } finally {
            this.isProcessing = false;
            this.updateUIState(false);
            this.displayCurrentSearch();
        }
    }

    private displayCurrentSearch() {
        this.resultArea.empty();
        
        if (!this.currentQuestion) {
            // Show placeholder
            const placeholder = this.resultArea.createEl('div', { cls: 'search-placeholder' });
            placeholder.createEl('p', { text: 'Ask questions about your notes and get instant answers.' });
            if (this.knowledgeAgent) {
                placeholder.createEl('p', { text: 'AI-powered search is ready. 🧠', cls: 'status-ready' });
            } else {
                placeholder.createEl('p', { text: 'Note indexing in progress... ⏳', cls: 'status-loading' });
            }
            return;
        }
        
        // Show current question
        const questionEl = this.resultArea.createEl('div', { cls: 'current-question' });
        questionEl.createEl('strong', { text: this.currentQuestion });
        
        // Show answer or loading
        const answerEl = this.resultArea.createEl('div', { cls: 'current-answer' });
        if (this.isProcessing) {
            answerEl.createEl('div', { text: 'Searching your notes...', cls: 'loading' });
        } else if (this.currentAnswer) {
            this.renderContent(answerEl, this.currentAnswer);
        }
    }

    private renderContent(container: HTMLElement, content: string) {
        // Simple formatting for readability
        const lines = content.split('\n');
        lines.forEach(line => {
            if (line.trim()) {
                const p = container.createEl('p');
                p.textContent = line;
            }
        });
    }

    private updateUIState(processing: boolean) {
        this.sendButton.disabled = processing;
        this.inputArea.disabled = processing;
        
        const icon = this.sendButton.querySelector('.search-icon') as HTMLElement;
        if (processing) {
            icon.setAttr('data-lucide', 'loader-2');
            icon.addClass('animate-spin');
        } else {
            icon.setAttr('data-lucide', 'search');
            icon.removeClass('animate-spin');
            this.inputArea.focus();
        }
    }

    // Simplified - no message persistence needed for search-style interface
    async onClose() {
        // No cleanup needed
    }
}