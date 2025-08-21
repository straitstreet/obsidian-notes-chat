import { BudgetManager } from '../../../src/budget/budget-manager.ts';

// Mock localStorage for testing
const localStorageMock = {
    store: {},
    getItem: jest.fn((key) => localStorageMock.store[key] || null),
    setItem: jest.fn((key, value) => { localStorageMock.store[key] = value; }),
    removeItem: jest.fn((key) => { delete localStorageMock.store[key]; }),
    clear: jest.fn(() => { localStorageMock.store = {}; })
};

Object.defineProperty(global, 'localStorage', {
    value: localStorageMock
});

describe('BudgetManager', () => {
    let budgetManager;
    const mockConfig = {
        monthlyLimit: 100,
        warningThreshold: 0.7,
        alertThreshold: 0.9,
        enabled: true
    };

    beforeEach(() => {
        localStorageMock.clear();
        budgetManager = new BudgetManager(mockConfig);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('recordUsage', () => {
        test('should record usage entry', () => {
            const usage = {
                provider: 'openai',
                model: 'gpt-4',
                cost: 5.50,
                inputTokens: 100,
                outputTokens: 200,
                totalTokens: 300
            };

            budgetManager.recordUsage(usage);
            
            const currentUsage = budgetManager.getCurrentMonthUsage();
            expect(currentUsage).toHaveLength(1);
            expect(currentUsage[0].cost).toBe(5.50);
            expect(currentUsage[0].provider).toBe('openai');
        });

        test('should not record usage when disabled', () => {
            const disabledManager = new BudgetManager({ ...mockConfig, enabled: false });
            
            disabledManager.recordUsage({
                provider: 'openai',
                model: 'gpt-4',
                cost: 5.50,
                inputTokens: 100,
                outputTokens: 200,
                totalTokens: 300
            });

            const currentUsage = disabledManager.getCurrentMonthUsage();
            expect(currentUsage).toHaveLength(0);
        });

        test('should persist usage to localStorage', () => {
            const usage = {
                provider: 'openai',
                model: 'gpt-4',
                cost: 5.50,
                inputTokens: 100,
                outputTokens: 200,
                totalTokens: 300
            };

            budgetManager.recordUsage(usage);
            
            expect(localStorageMock.setItem).toHaveBeenCalledWith(
                'chat-with-notes-usage',
                expect.any(String)
            );
        });
    });

    describe('getBudgetStatus', () => {
        test('should return correct budget status with no usage', () => {
            const status = budgetManager.getBudgetStatus();
            
            expect(status.currentSpend).toBe(0);
            expect(status.monthlyLimit).toBe(100);
            expect(status.percentageUsed).toBe(0);
            expect(status.remainingBudget).toBe(100);
            expect(status.warningLevel).toBe('none');
        });

        test('should return warning level when threshold exceeded', () => {
            // Add usage to trigger warning (70% of budget)
            budgetManager.recordUsage({
                provider: 'openai',
                model: 'gpt-4',
                cost: 75,
                inputTokens: 1000,
                outputTokens: 1000,
                totalTokens: 2000
            });

            const status = budgetManager.getBudgetStatus();
            
            expect(status.currentSpend).toBe(75);
            expect(status.percentageUsed).toBe(0.75);
            expect(status.warningLevel).toBe('warning');
            expect(status.remainingBudget).toBe(25);
        });

        test('should return alert level when threshold exceeded', () => {
            // Add usage to trigger alert (95% of budget)
            budgetManager.recordUsage({
                provider: 'openai',
                model: 'gpt-4',
                cost: 95,
                inputTokens: 1000,
                outputTokens: 1000,
                totalTokens: 2000
            });

            const status = budgetManager.getBudgetStatus();
            
            expect(status.currentSpend).toBe(95);
            expect(status.percentageUsed).toBe(0.95);
            expect(status.warningLevel).toBe('alert');
            expect(status.remainingBudget).toBe(5);
        });

        test('should return exceeded level when budget exceeded', () => {
            // Add usage to exceed budget
            budgetManager.recordUsage({
                provider: 'openai',
                model: 'gpt-4',
                cost: 110,
                inputTokens: 1000,
                outputTokens: 1000,
                totalTokens: 2000
            });

            const status = budgetManager.getBudgetStatus();
            
            expect(status.currentSpend).toBe(110);
            expect(status.percentageUsed).toBe(1.1);
            expect(status.warningLevel).toBe('exceeded');
            expect(status.remainingBudget).toBe(0);
        });

        test('should calculate projected monthly spend correctly', () => {
            // Mock current date to middle of month for predictable projection
            const mockDate = new Date(2025, 0, 15); // January 15, 2025
            jest.spyOn(Date, 'now').mockImplementation(() => mockDate.getTime());
            jest.spyOn(Date.prototype, 'getDate').mockReturnValue(15);
            
            budgetManager.recordUsage({
                provider: 'openai',
                model: 'gpt-4',
                cost: 30, // $30 spent in 15 days
                inputTokens: 1000,
                outputTokens: 1000,
                totalTokens: 2000
            });

            const status = budgetManager.getBudgetStatus();
            
            // Should project $62 for full month (30/15 * 31)
            expect(status.projectedMonthlySpend).toBeCloseTo(62, 0);
            
            Date.now.mockRestore();
            Date.prototype.getDate.mockRestore();
        });
    });

    describe('canAffordRequest', () => {
        test('should allow request when budget available', () => {
            expect(budgetManager.canAffordRequest(50)).toBe(true);
        });

        test('should block request when budget exceeded', () => {
            // Use up the budget
            budgetManager.recordUsage({
                provider: 'openai',
                model: 'gpt-4',
                cost: 100,
                inputTokens: 1000,
                outputTokens: 1000,
                totalTokens: 2000
            });

            expect(budgetManager.canAffordRequest(1)).toBe(false);
        });

        test('should allow request when budget disabled', () => {
            const disabledManager = new BudgetManager({ ...mockConfig, enabled: false });
            expect(disabledManager.canAffordRequest(1000)).toBe(true);
        });
    });

    describe('getMonthlyUsage', () => {
        test('should return usage breakdown for current month', () => {
            budgetManager.recordUsage({
                provider: 'openai',
                model: 'gpt-4',
                cost: 30,
                inputTokens: 500,
                outputTokens: 500,
                totalTokens: 1000
            });

            budgetManager.recordUsage({
                provider: 'anthropic',
                model: 'claude-3-sonnet',
                cost: 20,
                inputTokens: 300,
                outputTokens: 200,
                totalTokens: 500
            });

            const usage = budgetManager.getMonthlyUsage();
            
            expect(usage.totalSpend).toBe(50);
            expect(usage.totalTokens).toBe(1500);
            expect(usage.requestCount).toBe(2);
            expect(usage.providerBreakdown.openai).toBe(30);
            expect(usage.providerBreakdown.anthropic).toBe(20);
            expect(usage.modelBreakdown['gpt-4']).toBe(30);
            expect(usage.modelBreakdown['claude-3-sonnet']).toBe(20);
        });
    });

    describe('data management', () => {
        test('should clear history', () => {
            budgetManager.recordUsage({
                provider: 'openai',
                model: 'gpt-4',
                cost: 30,
                inputTokens: 500,
                outputTokens: 500,
                totalTokens: 1000
            });

            expect(budgetManager.getCurrentMonthUsage()).toHaveLength(1);
            
            budgetManager.clearHistory();
            
            expect(budgetManager.getCurrentMonthUsage()).toHaveLength(0);
        });

        test('should export and import usage data', () => {
            const usage = {
                provider: 'openai',
                model: 'gpt-4',
                cost: 30,
                inputTokens: 500,
                outputTokens: 500,
                totalTokens: 1000
            };

            budgetManager.recordUsage(usage);
            
            const exportedData = budgetManager.exportUsageData();
            expect(exportedData).toContain('"provider":"openai"');
            
            budgetManager.clearHistory();
            expect(budgetManager.getCurrentMonthUsage()).toHaveLength(0);
            
            budgetManager.importUsageData(exportedData);
            expect(budgetManager.getCurrentMonthUsage()).toHaveLength(1);
        });

        test('should handle invalid import data', () => {
            expect(() => {
                budgetManager.importUsageData('invalid json');
            }).toThrow('Invalid usage data format');
        });
    });

    describe('configuration updates', () => {
        test('should update configuration', () => {
            budgetManager.updateConfig({ monthlyLimit: 200 });
            
            const status = budgetManager.getBudgetStatus();
            expect(status.monthlyLimit).toBe(200);
        });
    });
});