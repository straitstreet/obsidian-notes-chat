import { Plugin, WorkspaceLeaf, TFile, Notice, PluginSettingTab, App, Setting } from 'obsidian';
import { LLMProviderManager, type LLMProviderConfig } from './src/llm/provider-manager';
import { BudgetManager, type BudgetConfig } from './src/budget/budget-manager';
import { BudgetNotifications, type BudgetNotificationConfig } from './src/budget/budget-notifications';
import { EmbeddingManager, type EmbeddingConfig } from './src/kb/embeddings';
import { KnowledgeGraph, type KnowledgeGraphConfig } from './src/kb/knowledge-graph';
import { ChatView, VIEW_TYPE_CHAT, type QueryOptions } from './src/ui/simple-chat-view';

interface ChatWithNotesSettings {
    providers: LLMProviderConfig;
    budget: BudgetConfig;
    budgetNotifications: BudgetNotificationConfig;
    embedding: EmbeddingConfig;
    knowledgeGraph: KnowledgeGraphConfig;
    query: QueryOptions;
    enableBudgetTracking: boolean;
    enableKnowledgeGraph: boolean;
}

const DEFAULT_SETTINGS: ChatWithNotesSettings = {
    providers: {
        openai: { enabled: false, apiKey: '' },
        anthropic: { enabled: false, apiKey: '' },
        google: { enabled: false, apiKey: '' },
        ollama: { enabled: true, baseUrl: 'http://localhost:11434' },
        groq: { enabled: false, apiKey: '' },
        together: { enabled: false, apiKey: '' }
    },
    budget: {
        monthlyLimit: 25.00,
        warningThreshold: 0.8,
        alertThreshold: 0.95,
        enabled: false // Start disabled for simplicity
    },
    budgetNotifications: {
        showWarnings: true,
        showAlerts: true,
        showExceeded: true,
        warningDismissMinutes: 60,
        alertDismissMinutes: 30
    },
    embedding: {
        modelName: 'Xenova/all-MiniLM-L6-v2',
        batchSize: 10,
        maxTokens: 512,
        enabled: true
    },
    knowledgeGraph: {
        enabled: true, // Enable by default for better experience
        autoIndex: true,
        indexInterval: 60,
        includeFolders: [],
        excludeFolders: ['.obsidian', '.trash'],
        fileTypes: ['md'],
        minContentLength: 100,
        maxDocuments: 1000
    },
    query: {
        provider: 'ollama',
        model: 'llama3.2',
        includeContext: true, // Enable context by default since knowledge graph is enabled
        maxContextResults: 3,
        temperature: 0.7
    },
    enableBudgetTracking: false, // Simple toggle
    enableKnowledgeGraph: true   // Enable by default for better experience
};

export default class ChatWithNotesPlugin extends Plugin {
    settings: ChatWithNotesSettings;
    
    // Core managers
    providerManager: LLMProviderManager;
    budgetManager?: BudgetManager;
    budgetNotifications?: BudgetNotifications;
    embeddingManager?: EmbeddingManager;
    knowledgeGraph?: KnowledgeGraph;

    async onload() {
        console.log('Loading Chat with Notes plugin');

        await this.loadSettings();

        // Initialize managers
        await this.initializeManagers();

        // Register view
        this.registerView(
            VIEW_TYPE_CHAT,
            (leaf) => new ChatView(
                leaf,
                this.providerManager,
                this.knowledgeGraph,
                this.budgetManager,
                this.settings.query
            )
        );

        // Add single command to open chat
        this.addCommand({
            id: 'open-chat',
            name: 'Open Chat with Notes',
            callback: () => this.openChatView()
        });

        // Add ribbon icon
        this.addRibbonIcon('message-circle', 'Chat with Notes', () => {
            this.openChatView();
        });

        // Add settings tab
        this.addSettingTab(new ChatWithNotesSettingTab(this.app, this));

        // Set up file watchers for knowledge graph (if enabled)
        if (this.settings.enableKnowledgeGraph) {
            this.setupFileWatchers();
        }

        new Notice('Chat with Notes plugin loaded successfully!');
    }

    async onunload() {
        console.log('Unloading Chat with Notes plugin');
        
        // Clean up managers
        this.knowledgeGraph?.destroy();
    }

    async initializeManagers() {
        // Initialize budget manager only if enabled
        if (this.settings.enableBudgetTracking) {
            this.budgetManager = new BudgetManager({
                ...this.settings.budget,
                enabled: true
            });
            this.budgetNotifications = new BudgetNotifications(this.settings.budgetNotifications);
        }
        
        // LLM provider manager (always needed)
        this.providerManager = new LLMProviderManager(
            this.settings.providers,
            this.budgetManager,
            this.budgetNotifications
        );

        // Initialize knowledge graph only if enabled
        if (this.settings.enableKnowledgeGraph) {
            this.embeddingManager = new EmbeddingManager({
                ...this.settings.embedding,
                enabled: true
            });
            
            try {
                await this.embeddingManager.initialize();
                
                this.knowledgeGraph = new KnowledgeGraph(
                    { ...this.settings.knowledgeGraph, enabled: true },
                    this.embeddingManager,
                    this.app.vault,
                    this.app.metadataCache
                );
                
                await this.knowledgeGraph.initialize();
                const stats = this.knowledgeGraph.getStats();
                console.log('Knowledge graph initialized successfully', stats);
                new Notice(`Knowledge graph loaded: ${stats.documentsCount} documents, ${stats.embeddingsCount} embeddings`);
            } catch (error) {
                console.error('Failed to initialize knowledge graph:', error);
                new Notice('Failed to load knowledge graph. Continuing without it.');
                this.settings.enableKnowledgeGraph = false;
            }
        }
    }

    private setupFileWatchers() {
        if (!this.settings.knowledgeGraph.enabled) return;

        // Watch for file modifications
        this.registerEvent(
            this.app.vault.on('modify', async (file) => {
                if (file instanceof TFile && file.extension === 'md') {
                    await this.knowledgeGraph.updateDocument(file);
                }
            })
        );

        // Watch for file creation
        this.registerEvent(
            this.app.vault.on('create', async (file) => {
                if (file instanceof TFile && file.extension === 'md') {
                    await this.knowledgeGraph.updateDocument(file);
                }
            })
        );

        // Watch for file deletion
        this.registerEvent(
            this.app.vault.on('delete', (file) => {
                if (file instanceof TFile && file.extension === 'md') {
                    this.knowledgeGraph.removeDocument(file.path);
                }
            })
        );

        // Watch for file rename
        this.registerEvent(
            this.app.vault.on('rename', (file, oldPath) => {
                if (file instanceof TFile && file.extension === 'md') {
                    this.knowledgeGraph.removeDocument(oldPath);
                    this.knowledgeGraph.updateDocument(file);
                }
            })
        );
    }

    async openChatView() {
        const { workspace } = this.app;
        
        const leaves = workspace.getLeavesOfType(VIEW_TYPE_CHAT);

        if (leaves.length > 0) {
            // If chat view exists, focus it
            workspace.revealLeaf(leaves[0]);
            return;
        }

        // Create new chat view in right sidebar (like related-notes)
        const leaf = workspace.getRightLeaf(false);
        if (!leaf) return;

        await leaf.setViewState({ type: VIEW_TYPE_CHAT, active: true });
        workspace.revealLeaf(leaf);
    }


    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
        
        // Update managers with new settings
        if (this.budgetManager) {
            this.budgetManager.updateConfig({
                ...this.settings.budget,
                enabled: this.settings.enableBudgetTracking
            });
        }
        
        if (this.budgetNotifications) {
            this.budgetNotifications.updateConfig(this.settings.budgetNotifications);
        }
        
        if (this.embeddingManager) {
            this.embeddingManager.updateConfig({
                ...this.settings.embedding,
                enabled: this.settings.enableKnowledgeGraph
            });
        }
        
        if (this.knowledgeGraph) {
            this.knowledgeGraph.updateConfig({
                ...this.settings.knowledgeGraph,
                enabled: this.settings.enableKnowledgeGraph
            });
        }
        
        // Reinitialize provider manager
        if (this.providerManager) {
            this.providerManager.updateConfig(this.settings.providers);
        }
    }
}

class ChatWithNotesSettingTab extends PluginSettingTab {
    plugin: ChatWithNotesPlugin;
    private showApiKeys: boolean = false;

    constructor(app: App, plugin: ChatWithNotesPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl('h2', { text: 'Chat with Notes' });
        
        // Add version info
        const versionEl = containerEl.createEl('div', { cls: 'setting-item-description' });
        versionEl.createEl('span', { text: 'Version: ' });
        versionEl.createEl('code', { text: this.plugin.manifest.version });
        
        containerEl.createEl('p', { 
            text: 'Configure your AI providers to start chatting with your notes.',
            cls: 'setting-item-description'
        });

        // LLM Providers Section
        containerEl.createEl('h3', { text: 'AI Providers' });
        containerEl.createEl('p', { 
            text: 'Choose your preferred AI providers. Ollama runs locally, others require API keys.',
            cls: 'setting-item-description'
        });

        this.addProviderSettings('OpenAI', 'openai', 'https://platform.openai.com/api-keys');
        this.addProviderSettings('Anthropic', 'anthropic', 'https://console.anthropic.com/settings/keys'); 
        this.addProviderSettings('Google Gemini', 'google', 'https://aistudio.google.com/app/apikey');
        this.addProviderSettings('Ollama (Local)', 'ollama', null);

        // Knowledge Graph Status (if enabled)
        if (this.plugin.settings.enableKnowledgeGraph && this.plugin.knowledgeGraph) {
            containerEl.createEl('h3', { text: 'Knowledge Graph Status' });
            const stats = this.plugin.knowledgeGraph.getStats();
            const statusEl = containerEl.createEl('div', { cls: 'setting-item' });
            statusEl.createEl('div', { 
                text: `📚 Documents: ${stats.documentsCount} | 🧠 Embeddings: ${stats.embeddingsCount} | 🔗 Connections: ${stats.connectionsCount}`,
                cls: 'setting-item-description'
            });
            
            if (stats.isIndexing) {
                statusEl.createEl('div', {
                    text: '⏳ Currently indexing your vault...',
                    cls: 'setting-item-description'
                });
            }

            new Setting(containerEl)
                .setName('Rebuild Knowledge Graph')
                .setDesc('Recreate embeddings for all documents (may take a few minutes)')
                .addButton(button => button
                    .setButtonText('Rebuild Index')
                    .onClick(async () => {
                        if (this.plugin.knowledgeGraph) {
                            button.setButtonText('Rebuilding...');
                            button.disabled = true;
                            try {
                                await this.plugin.knowledgeGraph.buildIndex();
                                new Notice('Knowledge graph rebuilt successfully!');
                                this.display(); // Refresh to show new stats
                            } catch (error) {
                                new Notice('Failed to rebuild knowledge graph');
                                console.error(error);
                            } finally {
                                button.setButtonText('Rebuild Index');
                                button.disabled = false;
                            }
                        }
                    }));
        }

        // Optional features section
        containerEl.createEl('h3', { text: 'Optional Features' });

        new Setting(containerEl)
            .setName('Knowledge Graph')
            .setDesc('Enable semantic search across your notes using local AI embeddings')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableKnowledgeGraph)
                .onChange(async (value) => {
                    this.plugin.settings.enableKnowledgeGraph = value;
                    await this.plugin.saveSettings();
                    if (value && !this.plugin.knowledgeGraph) {
                        // Re-initialize managers to enable knowledge graph
                        try {
                            await this.plugin.initializeManagers();
                            new Notice('Knowledge graph enabled and initializing...');
                        } catch (error) {
                            new Notice('Failed to enable knowledge graph');
                        }
                    }
                    this.display(); // Refresh to show/hide knowledge graph settings
                }));

        new Setting(containerEl)
            .setName('Budget Tracking')
            .setDesc('Track your AI usage costs and set spending limits')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableBudgetTracking)
                .onChange(async (value) => {
                    this.plugin.settings.enableBudgetTracking = value;
                    await this.plugin.saveSettings();
                    this.display(); // Refresh to show/hide budget settings
                }));

        // Show budget limit setting only if budget tracking is enabled
        if (this.plugin.settings.enableBudgetTracking) {
            new Setting(containerEl)
                .setName('Monthly Budget Limit (USD)')
                .setDesc('Set your monthly spending limit')
                .addText(text => text
                    .setPlaceholder('25.00')
                    .setValue(this.plugin.settings.budget.monthlyLimit.toString())
                    .onChange(async (value) => {
                        const num = parseFloat(value);
                        if (!isNaN(num) && num >= 0) {
                            this.plugin.settings.budget.monthlyLimit = num;
                            await this.plugin.saveSettings();
                        }
                    }));
        }

        // Default provider selection
        containerEl.createEl('h3', { text: 'Chat Settings' });

        // Auto-select default provider if only one is enabled
        const enabledProviders = Object.keys(this.plugin.settings.providers)
            .filter(provider => this.plugin.settings.providers[provider].enabled);
        
        if (enabledProviders.length === 1) {
            // Automatically set the only enabled provider as default
            if (this.plugin.settings.query.provider !== enabledProviders[0]) {
                this.plugin.settings.query.provider = enabledProviders[0];
                this.plugin.saveSettings();
            }
        }

        new Setting(containerEl)
            .setName('Default AI Provider')
            .setDesc(enabledProviders.length === 1 ? 
                'Automatically set to your only enabled provider' : 
                'Which AI provider to use by default')
            .addDropdown(dropdown => {
                enabledProviders.forEach(provider => {
                    dropdown.addOption(provider, this.getProviderDisplayName(provider));
                });
                dropdown.setValue(this.plugin.settings.query.provider);
                dropdown.onChange(async (value) => {
                    this.plugin.settings.query.provider = value;
                    await this.plugin.saveSettings();
                });
                
                // Disable dropdown if only one provider
                if (enabledProviders.length <= 1) {
                    dropdown.selectEl.disabled = true;
                }
            });
    }

    private getProviderDisplayName(provider: string): string {
        const names: { [key: string]: string } = {
            'openai': 'OpenAI',
            'anthropic': 'Anthropic',
            'google': 'Google Gemini',
            'ollama': 'Ollama (Local)'
        };
        return names[provider] || provider;
    }

    private addProviderSettings(name: string, key: keyof LLMProviderConfig, apiKeyUrl?: string) {
        const provider = this.plugin.settings.providers[key];
        if (!provider) return;

        new Setting(this.containerEl)
            .setName(name)
            .setDesc(key === 'ollama' ? 'Local AI models - no API key needed' : 'Requires API key from provider')
            .addToggle(toggle => toggle
                .setValue(provider.enabled)
                .onChange(async (value) => {
                    provider.enabled = value;
                    await this.plugin.saveSettings();
                    this.display(); // Refresh to update provider dropdown
                }));

        if (provider.enabled) {
            if (key !== 'ollama') {
                const apiKeySetting = new Setting(this.containerEl)
                    .setName(`${name} API Key`)
                    .addText(text => {
                        const input = text
                            .setPlaceholder('Enter your API key')
                            .setValue(provider.apiKey || '')
                            .onChange(async (value) => {
                                provider.apiKey = value;
                                await this.plugin.saveSettings();
                            });
                        
                        // Set input type based on visibility toggle
                        if (!this.showApiKeys) {
                            input.inputEl.type = 'password';
                        }
                        
                        return input;
                    })
                    .addButton(button => button
                        .setButtonText(this.showApiKeys ? 'Hide' : 'Show')
                        .setTooltip('Toggle API key visibility')
                        .onClick(() => {
                            this.showApiKeys = !this.showApiKeys;
                            this.display(); // Refresh to update input types
                        }));

                // Add API key link if provided
                if (apiKeyUrl) {
                    const linkEl = apiKeySetting.descEl.createEl('a', {
                        text: 'Get API key →',
                        href: apiKeyUrl,
                        cls: 'external-link'
                    });
                    linkEl.setAttribute('target', '_blank');
                    linkEl.setAttribute('rel', 'noopener');
                }
            } else {
                new Setting(this.containerEl)
                    .setName('Ollama Server URL')
                    .setDesc('URL where Ollama is running')
                    .addText(text => text
                        .setPlaceholder('http://localhost:11434')
                        .setValue(provider.baseUrl || 'http://localhost:11434')
                        .onChange(async (value) => {
                            provider.baseUrl = value;
                            await this.plugin.saveSettings();
                        }));
            }
        }
    }
}