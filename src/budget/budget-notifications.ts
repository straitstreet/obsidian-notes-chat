import { Notice } from 'obsidian';
import { BudgetStatus } from './budget-manager';

export interface BudgetNotificationConfig {
    showWarnings: boolean;
    showAlerts: boolean;
    showExceeded: boolean;
    warningDismissMinutes: number;
    alertDismissMinutes: number;
}

export class BudgetNotifications {
    private config: BudgetNotificationConfig;
    private lastNotificationTimes: Map<string, number> = new Map();

    constructor(config: BudgetNotificationConfig) {
        this.config = config;
    }

    checkAndNotify(status: BudgetStatus): void {
        const now = Date.now();
        
        switch (status.warningLevel) {
            case 'warning':
                if (this.config.showWarnings && this.shouldShowNotification('warning', now)) {
                    this.showWarningNotification(status);
                    this.lastNotificationTimes.set('warning', now);
                }
                break;
                
            case 'alert':
                if (this.config.showAlerts && this.shouldShowNotification('alert', now)) {
                    this.showAlertNotification(status);
                    this.lastNotificationTimes.set('alert', now);
                }
                break;
                
            case 'exceeded':
                if (this.config.showExceeded && this.shouldShowNotification('exceeded', now)) {
                    this.showExceededNotification(status);
                    this.lastNotificationTimes.set('exceeded', now);
                }
                break;
        }
    }

    private shouldShowNotification(type: string, now: number): boolean {
        const lastNotified = this.lastNotificationTimes.get(type);
        if (!lastNotified) return true;

        const dismissMinutes = type === 'warning' 
            ? this.config.warningDismissMinutes 
            : this.config.alertDismissMinutes;
            
        const timeSinceLastNotification = now - lastNotified;
        const dismissTime = dismissMinutes * 60 * 1000;
        
        return timeSinceLastNotification >= dismissTime;
    }

    private showWarningNotification(status: BudgetStatus): void {
        const percentage = Math.round(status.percentageUsed * 100);
        new Notice(
            `💰 Budget Warning: ${percentage}% used ($${status.currentSpend.toFixed(2)}/${status.monthlyLimit.toFixed(2)})`,
            8000
        );
    }

    private showAlertNotification(status: BudgetStatus): void {
        const percentage = Math.round(status.percentageUsed * 100);
        new Notice(
            `🚨 Budget Alert: ${percentage}% used ($${status.currentSpend.toFixed(2)}/${status.monthlyLimit.toFixed(2)}). Consider reducing usage.`,
            10000
        );
    }

    private showExceededNotification(status: BudgetStatus): void {
        const overage = status.currentSpend - status.monthlyLimit;
        new Notice(
            `❌ Budget Exceeded: $${overage.toFixed(2)} over limit. New requests may be blocked.`,
            15000
        );
    }

    showCostNotification(cost: number, provider: string, model: string): void {
        if (cost > 0.01) { // Only show for costs above 1 cent
            new Notice(
                `💸 Request cost: $${cost.toFixed(4)} (${provider}/${model})`,
                3000
            );
        }
    }

    updateConfig(newConfig: Partial<BudgetNotificationConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }
}