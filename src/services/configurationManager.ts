/**
 * Configuration Management Service
 * Handles save/load, export/import, validation, and backup/restore functionality
 * Requirements: 5.1, 5.2, 5.5
 */

import type { Agent } from '../types/agent';
import type { Workflow } from '../types/workflow';
import type { SystemSettings, UsageStatistics } from '../types/storage';
import { UnifiedStorageManager, /* StorageManagerError */ } from './storageManager';

export interface ConfigurationData {
    agents: Agent[];
    workflows: Workflow[];
    settings: SystemSettings;
    usageStats: UsageStatistics;
    version: string;
    exportedAt: string;
    checksum?: string;
}

export interface ConfigurationValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    migrationRequired: boolean;
    targetVersion?: string;
}

export interface BackupMetadata {
    id: string;
    name: string;
    createdAt: string;
    size: number;
    version: string;
    checksum: string;
}

export class ConfigurationManagerError extends Error {
    constructor(message: string, public readonly operation: string, public readonly cause?: Error) {
        super(message);
        this.name = 'ConfigurationManagerError';
    }
}

export class ConfigurationManager {
    private readonly CURRENT_VERSION = '1.0.0';
    private readonly BACKUP_KEY_PREFIX = 'ai_backup_';
    private readonly MAX_BACKUPS = 10;
    private storageManager: UnifiedStorageManager;

    constructor(storageManager?: UnifiedStorageManager) {
        this.storageManager = storageManager || new UnifiedStorageManager();
    }

    /**
     * Save current configuration to storage
     * Requirement 5.1: Configuration save functionality
     */
    async saveConfiguration(): Promise<void> {
        try {
            await this.storageManager.initialize();

            const [agents, workflows, settings] = await Promise.all([
                this.storageManager.loadAgents(),
                this.storageManager.loadWorkflows(),
                this.storageManager.loadSettings()
            ]);

            // Save each component
            await Promise.all([
                this.storageManager.saveAgents(agents),
                this.storageManager.saveWorkflows(workflows),
                this.storageManager.saveSettings(settings)
            ]);

        } catch (error) {
            throw new ConfigurationManagerError(
                'Failed to save configuration',
                'saveConfiguration',
                error instanceof Error ? error : new Error('Unknown error')
            );
        }
    }

    /**
     * Load configuration from storage
     * Requirement 5.2: Configuration load functionality
     */
    async loadConfiguration(): Promise<ConfigurationData> {
        try {
            await this.storageManager.initialize();

            const [agents, workflows, settings] = await Promise.all([
                this.storageManager.loadAgents(),
                this.storageManager.loadWorkflows(),
                this.storageManager.loadSettings()
            ]);

            // Load usage stats with fallback
            let usageStats: UsageStatistics;
            try {
                const localStorage = (this.storageManager as any).localStorageManager;
                usageStats = localStorage.loadUsageStats();
            } catch {
                usageStats = {
                    totalTasksExecuted: 0,
                    totalAgentsCreated: 0,
                    totalWorkflowsRun: 0,
                    averageTaskDuration: 0,
                    lastActiveDate: new Date()
                };
            }

            const configData: ConfigurationData = {
                agents,
                workflows,
                settings,
                usageStats,
                version: this.CURRENT_VERSION,
                exportedAt: new Date().toISOString()
            };

            // Add checksum for integrity verification
            configData.checksum = this.generateChecksum(configData);

            return configData;

        } catch (error) {
            throw new ConfigurationManagerError(
                'Failed to load configuration',
                'loadConfiguration',
                error instanceof Error ? error : new Error('Unknown error')
            );
        }
    }

    /**
     * Export configuration as JSON string
     * Requirement 5.5: Export system with JSON generation
     */
    async exportConfiguration(): Promise<string> {
        try {
            const configData = await this.loadConfiguration();
            return JSON.stringify(configData, null, 2);
        } catch (error) {
            throw new ConfigurationManagerError(
                'Failed to export configuration',
                'exportConfiguration',
                error instanceof Error ? error : new Error('Unknown error')
            );
        }
    }

    /**
     * Import configuration from JSON string
     * Requirement 5.2: Configuration import functionality
     */
    async importConfiguration(jsonData: string): Promise<void> {
        try {
            // Parse and validate the configuration data
            const configData = JSON.parse(jsonData) as ConfigurationData;
            const validationResult = this.validateConfiguration(configData);

            if (!validationResult.isValid) {
                throw new ConfigurationManagerError(
                    `Invalid configuration data: ${validationResult.errors.join(', ')}`,
                    'importConfiguration'
                );
            }

            // Verify checksum BEFORE migration if present
            if (configData.checksum) {
                const expectedChecksum = this.generateChecksum({
                    ...configData,
                    checksum: undefined
                });
                if (configData.checksum !== expectedChecksum) {
                    throw new ConfigurationManagerError(
                        'Configuration checksum mismatch - data may be corrupted',
                        'importConfiguration'
                    );
                }
            }

            // Perform migration if required
            let finalConfigData = configData;
            if (validationResult.migrationRequired) {
                finalConfigData = await this.migrateConfiguration(configData, validationResult.targetVersion!);
            }

            await this.storageManager.initialize();

            // Import all data
            await Promise.all([
                this.storageManager.saveAgents(finalConfigData.agents),
                this.storageManager.saveWorkflows(finalConfigData.workflows),
                this.storageManager.saveSettings(finalConfigData.settings)
            ]);

            // Save usage stats if available
            if (finalConfigData.usageStats) {
                const localStorage = (this.storageManager as any).localStorageManager;
                await localStorage.saveUsageStats(finalConfigData.usageStats);
            }

        } catch (error) {
            if (error instanceof ConfigurationManagerError) {
                throw error;
            }
            throw new ConfigurationManagerError(
                `Failed to import configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'importConfiguration',
                error instanceof Error ? error : new Error('Unknown error')
            );
        }
    }

    /**
     * Validate configuration data
     * Requirement 5.2: Configuration validation
     */
    validateConfiguration(configData: any): ConfigurationValidationResult {
        const result: ConfigurationValidationResult = {
            isValid: true,
            errors: [],
            warnings: [],
            migrationRequired: false
        };

        // Check if data is an object
        if (!configData || typeof configData !== 'object') {
            result.isValid = false;
            result.errors.push('Configuration data must be an object');
            return result;
        }

        // Check version
        if (!configData.version) {
            result.warnings.push('No version information found');
            result.migrationRequired = true;
            result.targetVersion = this.CURRENT_VERSION;
        } else if (configData.version !== this.CURRENT_VERSION) {
            result.migrationRequired = true;
            result.targetVersion = this.CURRENT_VERSION;
            result.warnings.push(`Version mismatch: found ${configData.version}, expected ${this.CURRENT_VERSION}`);
        }

        // Validate agents array
        if (configData.agents && !Array.isArray(configData.agents)) {
            result.isValid = false;
            result.errors.push('Agents must be an array');
        } else if (configData.agents) {
            configData.agents.forEach((agent: any, index: number) => {
                if (!this.validateAgent(agent)) {
                    result.errors.push(`Invalid agent at index ${index}`);
                    result.isValid = false;
                }
            });
        }

        // Validate workflows array
        if (configData.workflows && !Array.isArray(configData.workflows)) {
            result.isValid = false;
            result.errors.push('Workflows must be an array');
        } else if (configData.workflows) {
            configData.workflows.forEach((workflow: any, index: number) => {
                if (!this.validateWorkflow(workflow)) {
                    result.errors.push(`Invalid workflow at index ${index}`);
                    result.isValid = false;
                }
            });
        }

        // Validate settings
        if (configData.settings && !this.validateSettings(configData.settings)) {
            result.isValid = false;
            result.errors.push('Invalid settings object');
        }

        return result;
    }

    /**
     * Create a backup of current configuration
     * Requirement 5.2: Backup mechanisms
     */
    async createBackup(name?: string): Promise<BackupMetadata> {
        try {
            const configData = await this.loadConfiguration();
            const backupId = `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const backupName = name || `Backup ${new Date().toLocaleString()}`;

            const backupData = {
                ...configData,
                backupMetadata: {
                    id: backupId,
                    name: backupName,
                    createdAt: new Date().toISOString(),
                    originalVersion: configData.version
                }
            };

            const serializedData = JSON.stringify(backupData);
            const backupKey = `${this.BACKUP_KEY_PREFIX}${backupId}`;

            // Store backup in localStorage
            localStorage.setItem(backupKey, serializedData);

            // Clean up old backups if we exceed the limit
            await this.cleanupOldBackups();

            const metadata: BackupMetadata = {
                id: backupId,
                name: backupName,
                createdAt: backupData.backupMetadata.createdAt,
                size: serializedData.length,
                version: configData.version,
                checksum: configData.checksum || ''
            };

            return metadata;

        } catch (error) {
            throw new ConfigurationManagerError(
                'Failed to create backup',
                'createBackup',
                error instanceof Error ? error : new Error('Unknown error')
            );
        }
    }

    /**
     * Restore configuration from backup
     * Requirement 5.2: Restore mechanisms
     */
    async restoreFromBackup(backupId: string): Promise<void> {
        try {
            const backupKey = `${this.BACKUP_KEY_PREFIX}${backupId}`;
            const backupData = localStorage.getItem(backupKey);

            if (!backupData) {
                throw new ConfigurationManagerError(
                    `Backup with ID ${backupId} not found`,
                    'restoreFromBackup'
                );
            }

            const parsedBackup = JSON.parse(backupData);

            // Remove backup metadata before importing
            const { backupMetadata, ...configData } = parsedBackup;

            await this.importConfiguration(JSON.stringify(configData));

        } catch (error) {
            if (error instanceof ConfigurationManagerError) {
                throw error;
            }
            throw new ConfigurationManagerError(
                'Failed to restore from backup',
                'restoreFromBackup',
                error instanceof Error ? error : new Error('Unknown error')
            );
        }
    }

    /**
     * List available backups
     */
    async listBackups(): Promise<BackupMetadata[]> {
        try {
            const backups: BackupMetadata[] = [];

            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(this.BACKUP_KEY_PREFIX)) {
                    try {
                        const backupData = localStorage.getItem(key);
                        if (backupData) {
                            const parsed = JSON.parse(backupData);
                            if (parsed.backupMetadata) {
                                backups.push({
                                    id: parsed.backupMetadata.id,
                                    name: parsed.backupMetadata.name,
                                    createdAt: parsed.backupMetadata.createdAt,
                                    size: backupData.length,
                                    version: parsed.version || 'unknown',
                                    checksum: parsed.checksum || ''
                                });
                            }
                        }
                    } catch {
                        // Skip corrupted backup entries
                        continue;
                    }
                }
            }

            // Sort by creation date (newest first)
            return backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        } catch (error) {
            throw new ConfigurationManagerError(
                'Failed to list backups',
                'listBackups',
                error instanceof Error ? error : new Error('Unknown error')
            );
        }
    }

    /**
     * Delete a specific backup
     */
    async deleteBackup(backupId: string): Promise<void> {
        try {
            const backupKey = `${this.BACKUP_KEY_PREFIX}${backupId}`;
            localStorage.removeItem(backupKey);
        } catch (error) {
            throw new ConfigurationManagerError(
                'Failed to delete backup',
                'deleteBackup',
                error instanceof Error ? error : new Error('Unknown error')
            );
        }
    }

    /**
     * Generate checksum for data integrity verification
     */
    private generateChecksum(data: any): string {
        const str = JSON.stringify(data, Object.keys(data).sort());
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(36);
    }

    /**
     * Migrate configuration to current version
     */
    private async migrateConfiguration(configData: ConfigurationData, targetVersion: string): Promise<ConfigurationData> {
        // For now, just update the version and ensure all required fields exist
        const migrated: ConfigurationData = {
            agents: configData.agents || [],
            workflows: configData.workflows || [],
            settings: configData.settings || {
                maxAgents: 10,
                defaultModel: 'xiaomi/mimo-v2-flash:free',
                apiTimeout: 30000,
                autoSaveInterval: 60000,
                theme: 'light'
            },
            usageStats: configData.usageStats || {
                totalTasksExecuted: 0,
                totalAgentsCreated: 0,
                totalWorkflowsRun: 0,
                averageTaskDuration: 0,
                lastActiveDate: new Date()
            },
            version: targetVersion,
            exportedAt: new Date().toISOString()
        };

        migrated.checksum = this.generateChecksum(migrated);
        return migrated;
    }

    /**
     * Clean up old backups to maintain the maximum limit
     */
    private async cleanupOldBackups(): Promise<void> {
        try {
            const backups = await this.listBackups();
            if (backups.length > this.MAX_BACKUPS) {
                const backupsToDelete = backups.slice(this.MAX_BACKUPS);
                for (const backup of backupsToDelete) {
                    await this.deleteBackup(backup.id);
                }
            }
        } catch {
            // Ignore cleanup errors - they shouldn't prevent backup creation
        }
    }

    /**
     * Validate agent object structure
     */
    private validateAgent(agent: any): boolean {
        return agent &&
            typeof agent.id === 'string' &&
            typeof agent.name === 'string' &&
            typeof agent.role === 'string' &&
            typeof agent.promptTemplate === 'string' &&
            ['idle', 'busy', 'error'].includes(agent.status) &&
            agent.config &&
            typeof agent.config.maxTokens === 'number' &&
            typeof agent.config.temperature === 'number' &&
            typeof agent.config.model === 'string' &&
            agent.stats &&
            typeof agent.stats.tasksCompleted === 'number' &&
            typeof agent.stats.averageResponseTime === 'number' &&
            typeof agent.stats.errorCount === 'number';
    }

    /**
     * Validate workflow object structure
     */
    private validateWorkflow(workflow: any): boolean {
        return workflow &&
            typeof workflow.id === 'string' &&
            typeof workflow.name === 'string' &&
            Array.isArray(workflow.nodes) &&
            Array.isArray(workflow.connections) &&
            ['draft', 'running', 'completed', 'failed'].includes(workflow.status);
    }

    /**
     * Validate settings object structure
     */
    private validateSettings(settings: any): boolean {
        return settings &&
            typeof settings.maxAgents === 'number' &&
            typeof settings.defaultModel === 'string' &&
            typeof settings.apiTimeout === 'number' &&
            typeof settings.autoSaveInterval === 'number' &&
            ['light', 'dark'].includes(settings.theme);
    }
}