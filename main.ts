import { Plugin, WorkspaceLeaf, TFile, Notice } from 'obsidian';
import { LLMProviderManager, type LLMProviderConfig } from './src/llm/provider-manager';

interface ChatWithNotesSettings {
    providers: LLMProviderConfig;
    budget: {
        monthlyLimit: number;
        warningThreshold: number;
    };
    hotkeys: {
        quickQuery: string;
        searchKnowledge: string;
    };
}

const DEFAULT_SETTINGS: ChatWithNotesSettings = {
    providers: {
        openai: { enabled: false, apiKey: '' },
        anthropic: { enabled: false, apiKey: '' },
        google: { enabled: false, apiKey: '' },
        ollama: { enabled: true, baseUrl: 'http://localhost:11434' }
    },
    budget: {
        monthlyLimit: 25.00,
        warningThreshold: 0.8
    },
    hotkeys: {
        quickQuery: 'Ctrl+Shift+L',
        searchKnowledge: 'Ctrl+Shift+K'
    }
};

export default class ChatWithNotesPlugin extends Plugin {
    settings: ChatWithNotesSettings;
    providerManager: LLMProviderManager;

    async onload() {
        console.log('Loading Chat with Notes plugin');

        await this.loadSettings();

        // Initialize LLM provider manager
        this.providerManager = new LLMProviderManager(this.settings.providers);

        // Add settings tab
        this.addSettingTab(new ChatWithNotesSettingTab(this.app, this));

        // Add commands
        this.addCommand({
            id: 'quick-query',
            name: 'Quick LLM Query',
            callback: () => this.openQuickQuery(),
            hotkeys: [{ modifiers: ["Ctrl", "Shift"], key: "l" }]
        });

        this.addCommand({
            id: 'search-knowledge',
            name: 'Search Knowledge Graph',
            callback: () => this.searchKnowledge(),
            hotkeys: [{ modifiers: ["Ctrl", "Shift"], key: "k" }]
        });

        // Add ribbon icon
        this.addRibbonIcon('message-circle', 'Chat with Notes', () => {
            this.openChatView();
        });

        // Register view
        this.registerView(
            'chat-with-notes',
            (leaf) => new ChatView(leaf, this)
        );

        new Notice('Chat with Notes plugin loaded successfully!');
    }

    onunload() {
        console.log('Unloading Chat with Notes plugin');
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
        // Reinitialize provider manager with new settings
        this.providerManager = new LLMProviderManager(this.settings.providers);
    }

    openQuickQuery() {
        // TODO: Implement quick query modal
        new Notice('Quick query feature coming soon!');
    }

    searchKnowledge() {
        // TODO: Implement knowledge search
        new Notice('Knowledge search feature coming soon!');
    }

    async openChatView() {
        const existing = this.app.workspace.getLeavesOfType('chat-with-notes');
        if (existing.length > 0) {
            this.app.workspace.revealLeaf(existing[0]);
            return;
        }

        const leaf = this.app.workspace.getRightLeaf(false);
        await leaf.setViewType('chat-with-notes');
        this.app.workspace.revealLeaf(leaf);
    }

    async queryLLM(provider: string, model: string, prompt: string): Promise<string> {
        try {
            const response = await this.providerManager.generateResponse(
                provider,
                model,
                [{ role: 'user', content: prompt }]
            );
            return response.content;
        } catch (error) {
            console.error('LLM query failed:', error);
            throw error;
        }
    }
}

// Placeholder classes for views and settings
class ChatView {
    constructor(leaf: WorkspaceLeaf, plugin: ChatWithNotesPlugin) {
        // TODO: Implement chat view
    }
}

class ChatWithNotesSettingTab {
    constructor(app: any, plugin: ChatWithNotesPlugin) {
        // TODO: Implement settings tab
    }
}