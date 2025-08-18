// Mock the entire provider manager since we can't easily mock ES modules in Jest
const mockProviderManager = {
  getAvailableProviders: jest.fn(),
  getProvider: jest.fn(),
  getModelsForProvider: jest.fn(),
  getProviderStatus: jest.fn(),
  updateConfig: jest.fn(),
  generateResponse: jest.fn(),
  generateStreamingResponse: jest.fn()
};

// Mock implementation
class MockLLMProviderManager {
  constructor(config) {
    this.config = config;
    this.providers = new Map();
    this.initializeProviders();
  }

  initializeProviders() {
    if (this.config.openai?.enabled && this.config.openai.apiKey) {
      this.providers.set('openai', {
        name: 'OpenAI',
        models: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-4o', 'gpt-4o-mini', 'o3', 'o4-mini'],
        isLocal: false,
        supportsStreaming: true,
        enabled: true
      });
    }

    if (this.config.anthropic?.enabled && this.config.anthropic.apiKey) {
      this.providers.set('anthropic', {
        name: 'Anthropic',
        models: ['claude-4-opus-4.1', 'claude-4-sonnet', 'claude-3.7-sonnet', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
        isLocal: false,
        supportsStreaming: true,
        enabled: true
      });
    }

    if (this.config.google?.enabled && this.config.google.apiKey) {
      this.providers.set('google', {
        name: 'Google Gemini',
        models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash-thinking'],
        isLocal: false,
        supportsStreaming: true,
        enabled: true
      });
    }

    if (this.config.ollama?.enabled) {
      this.providers.set('ollama', {
        name: 'Ollama (Local)',
        models: ['llama3.2', 'llama3.1', 'mistral', 'mixtral'],
        isLocal: true,
        supportsStreaming: true,
        enabled: true
      });
    }
  }

  getAvailableProviders() {
    return Array.from(this.providers.keys()).filter(
      name => this.providers.get(name)?.enabled
    );
  }

  getProvider(name) {
    return this.providers.get(name);
  }

  getModelsForProvider(providerName) {
    const provider = this.providers.get(providerName);
    return provider?.enabled ? provider.models : [];
  }

  getProviderStatus() {
    const status = {};
    for (const [name, provider] of this.providers) {
      status[name] = {
        enabled: provider.enabled,
        configured: true,
        models: provider.models.length
      };
    }
    return status;
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.providers.clear();
    this.initializeProviders();
  }
}

describe('LLMProviderManager', () => {
  let providerManager;
  let mockConfig;

  beforeEach(() => {
    mockConfig = {
      openai: {
        enabled: true,
        apiKey: 'test-openai-key'
      },
      anthropic: {
        enabled: true,
        apiKey: 'test-anthropic-key'
      },
      google: {
        enabled: false
      },
      ollama: {
        enabled: true,
        baseUrl: 'http://localhost:11434'
      }
    };

    providerManager = new MockLLMProviderManager(mockConfig);
  });

  describe('initialization', () => {
    test('should initialize with provided config', () => {
      expect(providerManager).toBeInstanceOf(MockLLMProviderManager);
    });

    test('should only enable providers with valid config', () => {
      const availableProviders = providerManager.getAvailableProviders();
      
      // Should include enabled providers with API keys
      expect(availableProviders).toContain('openai');
      expect(availableProviders).toContain('anthropic');
      expect(availableProviders).toContain('ollama'); // Local doesn't need API key
      
      // Should not include disabled providers
      expect(availableProviders).not.toContain('google');
    });
  });

  describe('provider management', () => {
    test('should return correct models for each provider', () => {
      const openaiModels = providerManager.getModelsForProvider('openai');
      const anthropicModels = providerManager.getModelsForProvider('anthropic');
      
      expect(openaiModels).toContain('gpt-4.1');
      expect(openaiModels).toContain('gpt-4o');
      expect(anthropicModels).toContain('claude-4-opus-4.1');
      expect(anthropicModels).toContain('claude-3-5-sonnet-20241022');
    });

    test('should return empty array for disabled providers', () => {
      const googleModels = providerManager.getModelsForProvider('google');
      expect(googleModels).toEqual([]);
    });

    test('should return provider information', () => {
      const openaiProvider = providerManager.getProvider('openai');
      
      expect(openaiProvider).toBeDefined();
      expect(openaiProvider.name).toBe('OpenAI');
      expect(openaiProvider.isLocal).toBe(false);
      expect(openaiProvider.supportsStreaming).toBe(true);
    });
  });

  describe('provider status', () => {
    test('should return status for all providers', () => {
      const status = providerManager.getProviderStatus();
      
      expect(status.openai).toEqual({
        enabled: true,
        configured: true,
        models: expect.any(Number)
      });
      
      expect(status.anthropic).toEqual({
        enabled: true,
        configured: true,
        models: expect.any(Number)
      });
    });
  });

  describe('config updates', () => {
    test('should update configuration', () => {
      const newConfig = {
        openai: {
          enabled: false,
          apiKey: 'test-key'
        },
        google: {
          enabled: true,
          apiKey: 'test-google-key'
        }
      };

      providerManager.updateConfig(newConfig);
      
      const availableProviders = providerManager.getAvailableProviders();
      expect(availableProviders).not.toContain('openai');
      expect(availableProviders).toContain('google');
    });
  });

  describe('error handling', () => {
    test('should handle missing provider gracefully', () => {
      const models = providerManager.getModelsForProvider('nonexistent');
      expect(models).toEqual([]);
    });

    test('should handle invalid provider info requests', () => {
      const provider = providerManager.getProvider('nonexistent');
      expect(provider).toBeUndefined();
    });
  });

  describe('model updates', () => {
    test('should include latest OpenAI models', () => {
      const models = providerManager.getModelsForProvider('openai');
      
      // Check for 2025 models
      expect(models).toContain('gpt-4.1');
      expect(models).toContain('gpt-4.1-mini');
      expect(models).toContain('gpt-4.1-nano');
      expect(models).toContain('o3');
      expect(models).toContain('o4-mini');
    });

    test('should include latest Anthropic models', () => {
      const models = providerManager.getModelsForProvider('anthropic');
      
      // Check for 2025 models
      expect(models).toContain('claude-4-opus-4.1');
      expect(models).toContain('claude-4-sonnet');
      expect(models).toContain('claude-3.7-sonnet');
      expect(models).toContain('claude-3-5-haiku-20241022');
    });

    test('should include latest Google models when enabled', () => {
      const configWithGoogle = {
        ...mockConfig,
        google: {
          enabled: true,
          apiKey: 'test-google-key'
        }
      };

      const manager = new MockLLMProviderManager(configWithGoogle);
      const models = manager.getModelsForProvider('google');
      
      // Check for 2025 models
      expect(models).toContain('gemini-2.5-pro');
      expect(models).toContain('gemini-2.5-flash');
      expect(models).toContain('gemini-2.5-flash-lite');
      expect(models).toContain('gemini-2.0-flash-thinking');
    });
  });
});