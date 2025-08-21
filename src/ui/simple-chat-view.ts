import { ItemView, WorkspaceLeaf, Notice } from 'obsidian';
import { LLMProviderManager, LLMResponse } from '../llm/provider-manager';
import { KnowledgeGraph, SearchContext } from '../kb/knowledge-graph';
import { BudgetManager } from '../budget/budget-manager';
import { KnowledgeAgent, AgentConfig } from '../agent/knowledge-agent';
export interface QueryOptions {
    provider: string;
    model: string;
    includeContext: boolean;
    maxContextResults: number;
    temperature: number;
}

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
    private knowledgeGraph?: KnowledgeGraph;
    private budgetManager?: BudgetManager;
    private queryOptions: QueryOptions;
    private knowledgeAgent?: KnowledgeAgent;
    
    private messages: ChatMessage[] = [];
    private isProcessing = false;
    
    private chatContainer!: HTMLElement;
    private messagesList!: HTMLElement;
    private inputArea!: HTMLTextAreaElement;
    private sendButton!: HTMLButtonElement;
    private budgetDisplay?: HTMLElement;

    constructor(
        leaf: WorkspaceLeaf,
        llmManager: LLMProviderManager,
        knowledgeGraph?: KnowledgeGraph,
        budgetManager?: BudgetManager,
        queryOptions: QueryOptions = {
            provider: 'ollama',
            model: 'llama3.2',
            includeContext: false,
            maxContextResults: 3,
            temperature: 0.7
        }
    ) {
        super(leaf);
        this.llmManager = llmManager;
        this.knowledgeGraph = knowledgeGraph;
        this.budgetManager = budgetManager;
        this.queryOptions = queryOptions;
        
        // Initialize knowledge agent if knowledge graph is available
        if (this.knowledgeGraph) {
            this.knowledgeAgent = new KnowledgeAgent(
                this.llmManager,
                this.knowledgeGraph,
                {
                    provider: queryOptions.provider,
                    model: queryOptions.model,
                    maxIterations: 5,
                    temperature: queryOptions.temperature
                }
            );
        }
        
        this.loadMessages();
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
        const container = this.containerEl.children[1] as HTMLElement;
        container.empty();
        container.addClass('chat-view-container');

        this.buildChatInterface(container);
        this.updateBudgetDisplay();
    }

    private buildChatInterface(container: HTMLElement) {
        // Simple header
        const header = container.createEl('div', { cls: 'chat-header' });
        
        // Title and provider selector
        header.createEl('h3', { text: 'Chat with Notes', cls: 'chat-title' });
        
        const providerControl = header.createEl('div', { cls: 'provider-control' });
        
        const providerSelect = providerControl.createEl('select', { cls: 'provider-select' });
        this.llmManager.getAvailableProviders().forEach(provider => {
            const displayName = this.getProviderDisplayName(provider);
            providerSelect.createEl('option', { value: provider, text: displayName });
        });
        providerSelect.value = this.queryOptions.provider;
        
        const modelSelect = providerControl.createEl('select', { cls: 'model-select' });
        this.updateModelSelect(modelSelect);
        
        providerSelect.addEventListener('change', () => {
            this.queryOptions.provider = (providerSelect as HTMLSelectElement).value;
            this.updateModelSelect(modelSelect);
            this.updateAgentConfig();
        });
        
        modelSelect.addEventListener('change', () => {
            this.queryOptions.model = (modelSelect as HTMLSelectElement).value;
            this.updateAgentConfig();
        });

        // Budget display (only if enabled)
        if (this.budgetManager) {
            this.budgetDisplay = header.createEl('div', { cls: 'budget-display' });
        }

        // Chat container
        this.chatContainer = container.createEl('div', { cls: 'chat-container' });
        
        // Messages list
        this.messagesList = this.chatContainer.createEl('div', { cls: 'messages-list' });
        this.renderMessages();

        // Input area
        const inputContainer = this.chatContainer.createEl('div', { cls: 'input-container' });
        
        // Context toggle (only if knowledge graph is available)
        if (this.knowledgeGraph) {
            const contextControl = inputContainer.createEl('div', { cls: 'context-control' });
            const contextCheckbox = contextControl.createEl('input', { 
                type: 'checkbox', 
                cls: 'context-checkbox' 
            }) as HTMLInputElement;
            contextCheckbox.checked = this.queryOptions.includeContext;
            contextCheckbox.addEventListener('change', () => {
                this.queryOptions.includeContext = contextCheckbox.checked;
            });
            contextControl.createEl('label', { text: ' Use AI agent to search my notes' });
        }

        // Input area
        const inputRow = inputContainer.createEl('div', { cls: 'input-row' });
        
        this.inputArea = inputRow.createEl('textarea', {
            cls: 'chat-input',
            attr: {
                placeholder: 'Type your question... (Ctrl+Enter to send)',
                rows: '3'
            }
        }) as HTMLTextAreaElement;

        this.sendButton = inputRow.createEl('button', {
            text: 'Send',
            cls: 'send-button mod-cta'
        }) as HTMLButtonElement;

        // Event listeners
        this.inputArea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.handleSendMessage();
            }
        });

        this.sendButton.addEventListener('click', () => {
            this.handleSendMessage();
        });

        // Auto-resize textarea
        this.inputArea.addEventListener('input', () => {
            this.inputArea.style.height = 'auto';
            this.inputArea.style.height = this.inputArea.scrollHeight + 'px';
        });
    }

    private getProviderDisplayName(provider: string): string {
        const names: { [key: string]: string } = {
            'openai': 'OpenAI',
            'anthropic': 'Anthropic',
            'google': 'Google Gemini',
            'ollama': 'Ollama (Local)',
            'groq': 'Groq',
            'together': 'Together AI'
        };
        return names[provider] || provider;
    }

    private updateModelSelect(modelSelect: HTMLElement) {
        const select = modelSelect as HTMLSelectElement;
        select.innerHTML = '';
        const models = this.llmManager.getModelsForProvider(this.queryOptions.provider);
        models.forEach(model => {
            select.createEl('option', { value: model, text: model });
        });
        
        if (models.includes(this.queryOptions.model)) {
            select.value = this.queryOptions.model;
        } else if (models.length > 0) {
            select.value = models[0];
            this.queryOptions.model = models[0];
        }
    }

    private async handleSendMessage() {
        const message = this.inputArea.value?.trim();
        if (!message || this.isProcessing) return;

        // Check budget (only if budget manager exists)
        if (this.budgetManager) {
            const budgetStatus = this.budgetManager.getBudgetStatus();
            if (budgetStatus.warningLevel === 'exceeded') {
                new Notice('Budget exceeded. Cannot send message.');
                return;
            }
        }

        this.isProcessing = true;
        this.updateUIState(true);

        // Add user message
        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: message,
            timestamp: Date.now()
        };

        this.messages.push(userMessage);
        this.renderMessages();
        
        // Clear input
        this.inputArea.value = '';
        this.inputArea.style.height = 'auto';

        try {
            let response: LLMResponse;
            let relatedNotes: string[] = [];
            let agentToolCalls: any[] = [];

            if (this.queryOptions.includeContext && this.knowledgeAgent) {
                // Use agent for knowledge graph search
                const agentResponse = await this.knowledgeAgent.processQuery(message);
                
                response = {
                    content: agentResponse.content,
                    provider: this.queryOptions.provider,
                    model: this.queryOptions.model,
                    usage: {
                        inputTokens: 0,
                        outputTokens: 0,
                        totalTokens: 0
                    }
                };
                
                // Extract related notes from tool calls
                for (const toolCall of agentResponse.toolCalls) {
                    if (toolCall.result && toolCall.result.results) {
                        for (const result of toolCall.result.results) {
                            if (result.path) {
                                relatedNotes.push(result.path);
                            }
                        }
                    }
                }
                
                agentToolCalls = agentResponse.toolCalls;
                
            } else {
                // Direct LLM call without knowledge graph
                const conversationHistory = this.messages.slice(-10).map(msg => ({
                    role: msg.role === 'user' ? 'user' : 'assistant',
                    content: msg.content
                }));

                response = await this.llmManager.generateResponse(
                    this.queryOptions.provider,
                    this.queryOptions.model,
                    conversationHistory,
                    { temperature: this.queryOptions.temperature }
                );
            }

            // Add assistant message
            const assistantMessage: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: response.content,
                timestamp: Date.now(),
                provider: response.provider,
                model: response.model,
                usage: response.usage,
                relatedNotes: relatedNotes.length > 0 ? relatedNotes : undefined,
                agentToolCalls: agentToolCalls.length > 0 ? agentToolCalls : undefined
            };

            this.messages.push(assistantMessage);
            this.renderMessages();
            this.updateBudgetDisplay();

        } catch (error) {
            console.error('Chat failed:', error);
            const errorText = (error as Error).message;
            new Notice(`Chat failed: ${errorText}`);

            // Add error message with full details
            const errorMessage: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'system',
                content: `**Error:** ${errorText}`,
                timestamp: Date.now()
            };

            this.messages.push(errorMessage);
            this.renderMessages();

        } finally {
            this.isProcessing = false;
            this.updateUIState(false);
            this.saveMessages();
        }
    }

    private renderMessages() {
        this.messagesList.empty();

        if (this.messages.length === 0) {
            const welcomeEl = this.messagesList.createEl('div', { cls: 'welcome-message' });
            welcomeEl.createEl('h4', { text: 'Welcome to Chat with Notes!' });
            welcomeEl.createEl('p', { text: 'Ask me anything and I\'ll help you out.' });
            if (this.knowledgeGraph) {
                welcomeEl.createEl('p', { text: 'Enable "Use AI agent to search my notes" to let me intelligently search through your notes using multiple strategies and provide comprehensive answers based on your knowledge base.' });
            }
            return;
        }

        this.messages.forEach(message => {
            const messageEl = this.messagesList.createEl('div', {
                cls: `message message-${message.role}`
            });

            // Message header
            const headerEl = messageEl.createEl('div', { cls: 'message-header' });
            
            const roleEl = headerEl.createEl('span', { 
                text: message.role === 'user' ? 'You' : 
                     message.role === 'assistant' ? (message.model || 'Assistant') : 'System',
                cls: 'message-role'
            });

            const timeEl = headerEl.createEl('span', {
                text: new Date(message.timestamp).toLocaleTimeString(),
                cls: 'message-time'
            });

            // Message content
            const contentEl = messageEl.createEl('div', { 
                cls: 'message-content'
            });
            
            this.renderMessageContent(contentEl, message.content);

            // Related notes (for assistant messages with context)
            if (message.relatedNotes && message.relatedNotes.length > 0) {
                const notesEl = messageEl.createEl('div', { cls: 'related-notes' });
                notesEl.createEl('div', { 
                    text: 'Related Notes:', 
                    cls: 'related-notes-title'
                });
                
                const notesList = notesEl.createEl('ul', { cls: 'related-notes-list' });
                message.relatedNotes.forEach(notePath => {
                    const noteItem = notesList.createEl('li');
                    const noteLink = noteItem.createEl('a', {
                        text: notePath,
                        cls: 'related-note-link'
                    });
                    
                    noteLink.addEventListener('click', async (e: Event) => {
                        e.preventDefault();
                        const file = this.app.vault.getAbstractFileByPath(notePath);
                        if (file && 'stat' in file) {
                            const leaf = this.app.workspace.getLeaf(false);
                            await leaf.openFile(file as any);
                        }
                    });
                });
            }

            // Agent tool calls (for agent-generated messages)
            if (message.agentToolCalls && message.agentToolCalls.length > 0) {
                const toolsEl = messageEl.createEl('div', { cls: 'agent-tools' });
                toolsEl.createEl('div', { 
                    text: 'Knowledge Search Tools Used:', 
                    cls: 'agent-tools-title'
                });
                
                const toolsList = toolsEl.createEl('ul', { cls: 'agent-tools-list' });
                message.agentToolCalls.forEach(toolCall => {
                    const toolItem = toolsList.createEl('li');
                    const toolName = toolCall.toolName.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
                    
                    let summary = '';
                    if (toolCall.result && toolCall.result.found !== undefined) {
                        summary = ` - Found ${toolCall.result.found} result${toolCall.result.found !== 1 ? 's' : ''}`;
                    }
                    
                    toolItem.createEl('span', {
                        text: `${toolName}${summary}`,
                        cls: 'tool-call'
                    });
                });
            }

            // Usage info (for assistant messages)
            if (message.usage) {
                const usageEl = messageEl.createEl('div', { cls: 'message-usage' });
                usageEl.createEl('span', { 
                    text: `${message.usage.totalTokens} tokens`,
                    cls: 'usage-tokens'
                });
                
                if (message.usage.cost) {
                    usageEl.createEl('span', { 
                        text: `$${message.usage.cost.toFixed(4)}`,
                        cls: 'usage-cost'
                    });
                }
            }
        });

        // Scroll to bottom
        this.messagesList.scrollTop = this.messagesList.scrollHeight;
    }

    private renderMessageContent(container: HTMLElement, content: string) {
        // Simple markdown-like rendering
        const lines = content.split('\n');
        let inCodeBlock = false;
        let codeBlockEl: HTMLElement | null = null;

        lines.forEach(line => {
            if (line.startsWith('```')) {
                if (inCodeBlock) {
                    inCodeBlock = false;
                    codeBlockEl = null;
                } else {
                    inCodeBlock = true;
                    codeBlockEl = container.createEl('pre', { cls: 'code-block' });
                }
                return;
            }

            if (inCodeBlock && codeBlockEl) {
                codeBlockEl.appendText(line + '\n');
            } else {
                const p = container.createEl('p');
                
                // Simple inline formatting
                let formattedLine = line
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*(.*?)\*/g, '<em>$1</em>')
                    .replace(/`(.*?)`/g, '<code>$1</code>');

                p.innerHTML = formattedLine;
            }
        });
    }

    private updateUIState(processing: boolean) {
        this.sendButton.disabled = processing;
        this.sendButton.textContent = processing ? 'Sending...' : 'Send';
        
        if (processing) {
            this.inputArea.setAttribute('disabled', 'true');
        } else {
            this.inputArea.removeAttribute('disabled');
            this.inputArea.focus();
        }
    }

    private updateBudgetDisplay() {
        if (!this.budgetDisplay || !this.budgetManager) return;

        const status = this.budgetManager.getBudgetStatus();
        this.budgetDisplay.empty();

        const budgetEl = this.budgetDisplay.createEl('div', { cls: 'budget-info' });
        
        const spendEl = budgetEl.createEl('span', {
            text: `$${status.currentSpend.toFixed(2)}/$${status.monthlyLimit.toFixed(2)}`,
            cls: `budget-amount budget-${status.warningLevel}`
        });

        const percentEl = budgetEl.createEl('span', {
            text: `(${(status.percentageUsed * 100).toFixed(0)}%)`,
            cls: 'budget-percent'
        });

        // Warning indicators
        if (status.warningLevel === 'warning') {
            budgetEl.createEl('span', { text: '⚠️', cls: 'budget-warning' });
        } else if (status.warningLevel === 'alert') {
            budgetEl.createEl('span', { text: '🚨', cls: 'budget-alert' });
        } else if (status.warningLevel === 'exceeded') {
            budgetEl.createEl('span', { text: '❌', cls: 'budget-exceeded' });
        }
    }

    private saveMessages() {
        try {
            (window as any).localStorage?.setItem('chat-with-notes-messages', JSON.stringify(this.messages));
        } catch (error) {
            console.error('Failed to save messages:', error);
        }
    }

    private loadMessages() {
        try {
            const stored = (window as any).localStorage?.getItem('chat-with-notes-messages');
            if (stored) {
                this.messages = JSON.parse(stored);
            }
        } catch (error) {
            console.error('Failed to load messages:', error);
            this.messages = [];
        }
    }

    clearChat() {
        this.messages = [];
        this.renderMessages();
        this.saveMessages();
    }

    updateQueryOptions(options: Partial<QueryOptions>) {
        this.queryOptions = { ...this.queryOptions, ...options };
        this.updateAgentConfig();
    }

    private updateAgentConfig() {
        if (this.knowledgeAgent) {
            this.knowledgeAgent.updateConfig({
                provider: this.queryOptions.provider,
                model: this.queryOptions.model,
                temperature: this.queryOptions.temperature
            });
        }
    }

    async onClose() {
        this.saveMessages();
    }
}