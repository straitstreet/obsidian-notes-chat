export interface BudgetConfig {
    monthlyLimit: number;
    warningThreshold: number; // 0.0 to 1.0
    alertThreshold: number; // 0.0 to 1.0
    enabled: boolean;
}

export interface UsageEntry {
    timestamp: number;
    provider: string;
    model: string;
    cost: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
}

export interface BudgetStatus {
    currentSpend: number;
    monthlyLimit: number;
    percentageUsed: number;
    remainingBudget: number;
    warningLevel: 'none' | 'warning' | 'alert' | 'exceeded';
    daysIntoMonth: number;
    projectedMonthlySpend: number;
}

export interface MonthlyUsage {
    month: string; // YYYY-MM format
    totalSpend: number;
    totalTokens: number;
    requestCount: number;
    providerBreakdown: { [provider: string]: number };
    modelBreakdown: { [model: string]: number };
}

export class BudgetManager {
    private config: BudgetConfig;
    private usageHistory: UsageEntry[] = [];
    private readonly STORAGE_KEY = 'chat-with-notes-usage';

    constructor(config: BudgetConfig) {
        this.config = config;
        this.loadUsageHistory();
    }

    private loadUsageHistory(): void {
        try {
            const localStorage = this.getLocalStorage();
            if (!localStorage) return;
            
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                this.usageHistory = JSON.parse(stored);
            }
        } catch (error) {
            console.warn('Failed to load usage history:', error);
            this.usageHistory = [];
        }
    }

    private saveUsageHistory(): void {
        try {
            const localStorage = this.getLocalStorage();
            if (!localStorage) return;
            
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.usageHistory));
        } catch (error) {
            console.error('Failed to save usage history:', error);
        }
    }

    private getLocalStorage(): Storage | null {
        try {
            return typeof window !== 'undefined' && window.localStorage ? window.localStorage : (global as any).localStorage || null;
        } catch {
            return null;
        }
    }

    recordUsage(usage: Omit<UsageEntry, 'timestamp'>): void {
        if (!this.config.enabled) return;

        const entry: UsageEntry = {
            ...usage,
            timestamp: Date.now()
        };

        this.usageHistory.push(entry);
        this.saveUsageHistory();
    }

    getCurrentMonthUsage(): UsageEntry[] {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        
        return this.usageHistory.filter(entry => 
            entry.timestamp >= monthStart.getTime()
        );
    }

    getBudgetStatus(): BudgetStatus {
        const monthUsage = this.getCurrentMonthUsage();
        const currentSpend = monthUsage.reduce((sum, entry) => sum + entry.cost, 0);
        const percentageUsed = this.config.monthlyLimit > 0 ? currentSpend / this.config.monthlyLimit : 0;
        
        const now = new Date();
        const daysIntoMonth = now.getDate();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const projectedMonthlySpend = (currentSpend / daysIntoMonth) * daysInMonth;

        let warningLevel: BudgetStatus['warningLevel'] = 'none';
        if (percentageUsed >= 1.0) {
            warningLevel = 'exceeded';
        } else if (percentageUsed >= this.config.alertThreshold) {
            warningLevel = 'alert';
        } else if (percentageUsed >= this.config.warningThreshold) {
            warningLevel = 'warning';
        }

        return {
            currentSpend,
            monthlyLimit: this.config.monthlyLimit,
            percentageUsed,
            remainingBudget: Math.max(0, this.config.monthlyLimit - currentSpend),
            warningLevel,
            daysIntoMonth,
            projectedMonthlySpend
        };
    }

    canAffordRequest(estimatedCost: number): boolean {
        if (!this.config.enabled) return true;
        
        const status = this.getBudgetStatus();
        return status.remainingBudget >= estimatedCost;
    }

    getMonthlyUsage(monthKey?: string): MonthlyUsage {
        const targetMonth = monthKey || this.getCurrentMonthKey();
        const monthUsage = this.getUsageForMonth(targetMonth);
        
        const providerBreakdown: { [provider: string]: number } = {};
        const modelBreakdown: { [model: string]: number } = {};
        let totalSpend = 0;
        let totalTokens = 0;
        
        monthUsage.forEach(entry => {
            totalSpend += entry.cost;
            totalTokens += entry.totalTokens;
            
            providerBreakdown[entry.provider] = (providerBreakdown[entry.provider] || 0) + entry.cost;
            modelBreakdown[entry.model] = (modelBreakdown[entry.model] || 0) + entry.cost;
        });

        return {
            month: targetMonth,
            totalSpend,
            totalTokens,
            requestCount: monthUsage.length,
            providerBreakdown,
            modelBreakdown
        };
    }

    private getCurrentMonthKey(): string {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    private getUsageForMonth(monthKey: string): UsageEntry[] {
        const [year, month] = monthKey.split('-').map(Number);
        const monthStart = new Date(year, month - 1, 1);
        const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
        
        return this.usageHistory.filter(entry => 
            entry.timestamp >= monthStart.getTime() && 
            entry.timestamp <= monthEnd.getTime()
        );
    }

    getUsageHistory(months = 12): MonthlyUsage[] {
        const history: MonthlyUsage[] = [];
        const now = new Date();
        
        for (let i = 0; i < months; i++) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            history.push(this.getMonthlyUsage(monthKey));
        }
        
        return history.reverse();
    }

    updateConfig(newConfig: Partial<BudgetConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }

    clearHistory(): void {
        this.usageHistory = [];
        this.saveUsageHistory();
    }

    exportUsageData(): string {
        return JSON.stringify({
            config: this.config,
            usage: this.usageHistory,
            exported: new Date().toISOString()
        }, null, 2);
    }

    importUsageData(data: string): void {
        try {
            const parsed = JSON.parse(data);
            if (parsed.usage && Array.isArray(parsed.usage)) {
                this.usageHistory = parsed.usage;
                this.saveUsageHistory();
            }
        } catch (error) {
            throw new Error('Invalid usage data format');
        }
    }
}