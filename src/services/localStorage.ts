/**
 * LocalStorage wrapper with error handling and compression
 */

import type { Agent } from '../types/agent';
import type { Workflow } from '../types/workflow';
import type { SystemSettings, UsageStatistics } from '../types/storage';

export class LocalStorageError extends Error {
    constructor(message: string, public readonly operation: string) {
        super(message);
        this.name = 'LocalStorageError';
    }
}

export interface StorageQuota {
    used: number;
    available: number;
    total: number;
    percentage: number;
}

export class LocalStorageManager {
    private readonly STORAGE_KEYS = {
        AGENTS: 'ai_agents',
        WORKFLOWS: 'ai_workflows',
        SETTINGS: 'ai_settings',
        USAGE_STATS: 'ai_usage_stats'
    } as const;

    private readonly COMPRESSION_THRESHOLD = 1024; // 1KB

    /**
     * Check if LocalStorage is available
     */
    private isAvailable(): boolean {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get storage quota information
     */
    async getStorageQuota(): Promise<StorageQuota> {
        if (!this.isAvailable()) {
            throw new LocalStorageError('LocalStorage is not available', 'getStorageQuota');
        }

        try {
            // Estimate storage usage
            let used = 0;
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key) {
                    const value = localStorage.getItem(key);
                    used += key.length + (value?.length || 0);
                }
            }

            // Most browsers have 5-10MB limit for localStorage
            const total = 5 * 1024 * 1024; // 5MB estimate
            const available = total - used;
            const percentage = (used / total) * 100;

            return {
                used,
                available,
                total,
                percentage
            };
        } catch (error) {
            throw new LocalStorageError(
                `Failed to get storage quota: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'getStorageQuota'
            );
        }
    }

    /**
     * Compress data if it exceeds threshold
     */
    private compressData(data: string): string {
        if (data.length < this.COMPRESSION_THRESHOLD) {
            return data;
        }

        // Simple compression using JSON minification
        try {
            const parsed = JSON.parse(data);
            return JSON.stringify(parsed);
        } catch {
            return data;
        }
    }

    /**
     * Serialize and store data with error handling
     */
    private async setItem<T>(key: string, data: T): Promise<void> {
        if (!this.isAvailable()) {
            throw new LocalStorageError('LocalStorage is not available', 'setItem');
        }

        try {
            const serialized = JSON.stringify(data);
            const compressed = this.compressData(serialized);

            // Check quota before storing
            const quota = await this.getStorageQuota();
            if (quota.available < compressed.length) {
                throw new LocalStorageError(
                    `Insufficient storage space. Need ${compressed.length} bytes, have ${quota.available} bytes`,
                    'setItem'
                );
            }

            localStorage.setItem(key, compressed);
        } catch (error) {
            if (error instanceof LocalStorageError) {
                throw error;
            }
            throw new LocalStorageError(
                `Failed to store data: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'setItem'
            );
        }
    }

    /**
     * Retrieve and deserialize data with error handling
     */
    private getItem<T>(key: string, defaultValue: T): T {
        if (!this.isAvailable()) {
            throw new LocalStorageError('LocalStorage is not available', 'getItem');
        }

        try {
            const item = localStorage.getItem(key);
            if (item === null) {
                return defaultValue;
            }

            return JSON.parse(item) as T;
        } catch (error) {
            // If parsing fails, throw an error instead of returning defaults
            // This preserves round-trip integrity as required by Requirements 5.2 and 6.5
            throw new LocalStorageError(
                `Failed to parse stored data for key ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'getItem'
            );
        }
    }

    /**
     * Save agents to LocalStorage
     */
    async saveAgents(agents: Agent[]): Promise<void> {
        await this.setItem(this.STORAGE_KEYS.AGENTS, agents);
    }

    /**
     * Load agents from LocalStorage
     */
    loadAgents(): Agent[] {
        return this.getItem(this.STORAGE_KEYS.AGENTS, []);
    }

    /**
     * Save workflows to LocalStorage
     */
    async saveWorkflows(workflows: Workflow[]): Promise<void> {
        await this.setItem(this.STORAGE_KEYS.WORKFLOWS, workflows);
    }

    /**
     * Load workflows from LocalStorage
     */
    loadWorkflows(): Workflow[] {
        return this.getItem(this.STORAGE_KEYS.WORKFLOWS, []);
    }

    /**
     * Save system settings to LocalStorage
     */
    async saveSettings(settings: SystemSettings): Promise<void> {
        await this.setItem(this.STORAGE_KEYS.SETTINGS, settings);
    }

    /**
     * Load system settings from LocalStorage
     */
    loadSettings(): SystemSettings {
        return this.getItem(this.STORAGE_KEYS.SETTINGS, {
            maxAgents: 10,
            defaultModel: 'xiaomi/mimo-v2-flash:free',
            apiTimeout: 30000,
            autoSaveInterval: 60000,
            theme: 'light'
        });
    }

    /**
     * Save usage statistics to LocalStorage
     */
    async saveUsageStats(stats: UsageStatistics): Promise<void> {
        await this.setItem(this.STORAGE_KEYS.USAGE_STATS, stats);
    }

    /**
     * Load usage statistics from LocalStorage
     */
    loadUsageStats(): UsageStatistics {
        return this.getItem(this.STORAGE_KEYS.USAGE_STATS, {
            totalTasksExecuted: 0,
            totalAgentsCreated: 0,
            totalWorkflowsRun: 0,
            averageTaskDuration: 0,
            lastActiveDate: new Date()
        });
    }

    /**
     * Export all configuration data as JSON
     */
    exportConfiguration(): string {
        const data = {
            agents: this.loadAgents(),
            workflows: this.loadWorkflows(),
            settings: this.loadSettings(),
            usageStats: this.loadUsageStats(),
            exportedAt: new Date().toISOString()
        };

        return JSON.stringify(data, null, 2);
    }

    /**
     * Import configuration data from JSON
     */
    async importConfiguration(jsonData: string): Promise<void> {
        try {
            const data = JSON.parse(jsonData);

            if (data.agents) {
                await this.saveAgents(data.agents);
            }
            if (data.workflows) {
                await this.saveWorkflows(data.workflows);
            }
            if (data.settings) {
                await this.saveSettings(data.settings);
            }
            if (data.usageStats) {
                await this.saveUsageStats(data.usageStats);
            }
        } catch (error) {
            throw new LocalStorageError(
                `Failed to import configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'importConfiguration'
            );
        }
    }

    /**
     * Clear all stored data
     */
    async clearAll(): Promise<void> {
        if (!this.isAvailable()) {
            throw new LocalStorageError('LocalStorage is not available', 'clearAll');
        }

        try {
            Object.values(this.STORAGE_KEYS).forEach(key => {
                localStorage.removeItem(key);
            });
        } catch (error) {
            throw new LocalStorageError(
                `Failed to clear storage: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'clearAll'
            );
        }
    }
}