/**
 * Unit tests for Configuration Manager
 * Tests save/load, export/import, validation, and backup/restore functionality
 * Requirements: 5.1, 5.2, 5.5
 */

import { ConfigurationManager, ConfigurationManagerError } from '../src/services/configurationManager';
import { LocalStorageManager } from '../src/services/localStorage';
import type { Agent, Workflow, SystemSettings, /* UsageStatistics */ } from '../src/types';
import type { ConfigurationData } from '../src/services/configurationManager';

// Mock storage manager that only uses LocalStorage
class MockStorageManager {
    private localStorageManager: LocalStorageManager;

    constructor() {
        this.localStorageManager = new LocalStorageManager();
    }

    async initialize(): Promise<void> {
        // No-op for mock
    }

    async saveAgents(agents: Agent[]): Promise<void> {
        await this.localStorageManager.saveAgents(agents);
    }

    async loadAgents(): Promise<Agent[]> {
        return this.localStorageManager.loadAgents();
    }

    async saveWorkflows(workflows: Workflow[]): Promise<void> {
        await this.localStorageManager.saveWorkflows(workflows);
    }

    async loadWorkflows(): Promise<Workflow[]> {
        return this.localStorageManager.loadWorkflows();
    }

    async saveSettings(settings: SystemSettings): Promise<void> {
        await this.localStorageManager.saveSettings(settings);
    }

    async loadSettings(): Promise<SystemSettings> {
        return this.localStorageManager.loadSettings();
    }
}

describe('ConfigurationManager', () => {
    let configManager: ConfigurationManager;
    let storageManager: MockStorageManager;

    beforeEach(async () => {
        localStorage.clear();
        storageManager = new MockStorageManager();
        await storageManager.initialize();
        configManager = new ConfigurationManager(storageManager as any);
    });

    afterEach(() => {
        localStorage.clear();
    });

    describe('Save and Load Configuration', () => {
        test('should save configuration successfully', async () => {
            const agents: Agent[] = [{
                id: 'agent-1',
                name: 'Test Agent',
                role: 'assistant',
                promptTemplate: 'You are helpful',
                status: 'idle',
                config: {
                    maxTokens: 100,
                    temperature: 0.7,
                    model: 'xiaomi/mimo-v2-flash:free'
                },
                stats: {
                    tasksCompleted: 0,
                    averageResponseTime: 0,
                    errorCount: 0
                }
            }];

            await storageManager.saveAgents(agents);
            await configManager.saveConfiguration();

            const loadedAgents = await storageManager.loadAgents();
            expect(loadedAgents).toEqual(agents);
        });

        test('should load configuration with all components', async () => {
            const agents: Agent[] = [{
                id: 'agent-1',
                name: 'Test Agent',
                role: 'assistant',
                promptTemplate: 'You are helpful',
                status: 'idle',
                config: {
                    maxTokens: 100,
                    temperature: 0.7,
                    model: 'xiaomi/mimo-v2-flash:free'
                },
                stats: {
                    tasksCompleted: 0,
                    averageResponseTime: 0,
                    errorCount: 0
                }
            }];

            const workflows: Workflow[] = [{
                id: 'workflow-1',
                name: 'Test Workflow',
                nodes: [],
                connections: [],
                status: 'draft'
            }];

            await storageManager.saveAgents(agents);
            await storageManager.saveWorkflows(workflows);

            const config = await configManager.loadConfiguration();

            expect(config.agents).toEqual(agents);
            expect(config.workflows).toEqual(workflows);
            expect(config.version).toBe('1.0.0');
            expect(config.checksum).toBeDefined();
        });
    });

    describe('Export and Import Configuration', () => {
        test('should export configuration as JSON string', async () => {
            const agents: Agent[] = [{
                id: 'agent-1',
                name: 'Export Test Agent',
                role: 'assistant',
                promptTemplate: 'You are helpful',
                status: 'idle',
                config: {
                    maxTokens: 100,
                    temperature: 0.7,
                    model: 'xiaomi/mimo-v2-flash:free'
                },
                stats: {
                    tasksCompleted: 5,
                    averageResponseTime: 1000,
                    errorCount: 0
                }
            }];

            await storageManager.saveAgents(agents);
            const exported = await configManager.exportConfiguration();

            expect(typeof exported).toBe('string');
            expect(exported).toContain('agent-1');
            expect(exported).toContain('Export Test Agent');
            expect(exported).toContain('1.0.0');

            const parsed = JSON.parse(exported);
            expect(parsed.agents).toEqual(agents);
        });

        test('should import valid configuration', async () => {
            const configData: ConfigurationData = {
                agents: [{
                    id: 'agent-2',
                    name: 'Import Test Agent',
                    role: 'assistant',
                    promptTemplate: 'You are helpful',
                    status: 'idle',
                    config: {
                        maxTokens: 200,
                        temperature: 0.8,
                        model: 'xiaomi/mimo-v2-flash:free'
                    },
                    stats: {
                        tasksCompleted: 10,
                        averageResponseTime: 1500,
                        errorCount: 1
                    }
                }],
                workflows: [],
                settings: {
                    maxAgents: 10,
                    defaultModel: 'xiaomi/mimo-v2-flash:free',
                    apiTimeout: 30000,
                    autoSaveInterval: 60000,
                    theme: 'light'
                },
                usageStats: {
                    totalTasksExecuted: 10,
                    totalAgentsCreated: 1,
                    totalWorkflowsRun: 0,
                    averageTaskDuration: 1500,
                    lastActiveDate: new Date()
                },
                version: '1.0.0',
                exportedAt: new Date().toISOString()
            };

            const jsonData = JSON.stringify(configData);
            await configManager.importConfiguration(jsonData);

            const loadedAgents = await storageManager.loadAgents();
            expect(loadedAgents).toEqual(configData.agents);
        });

        test('should reject invalid JSON during import', async () => {
            const invalidJson = '{ invalid json }';

            await expect(configManager.importConfiguration(invalidJson))
                .rejects.toThrow(ConfigurationManagerError);
        });

        test('should reject configuration with invalid structure', async () => {
            const invalidConfig = {
                agents: 'not an array',
                workflows: [],
                settings: {},
                version: '1.0.0'
            };

            await expect(configManager.importConfiguration(JSON.stringify(invalidConfig)))
                .rejects.toThrow(ConfigurationManagerError);
        });
    });

    describe('Configuration Validation', () => {
        test('should validate correct configuration', () => {
            const validConfig: ConfigurationData = {
                agents: [{
                    id: 'agent-1',
                    name: 'Test Agent',
                    role: 'assistant',
                    promptTemplate: 'You are helpful',
                    status: 'idle',
                    config: {
                        maxTokens: 100,
                        temperature: 0.7,
                        model: 'xiaomi/mimo-v2-flash:free'
                    },
                    stats: {
                        tasksCompleted: 0,
                        averageResponseTime: 0,
                        errorCount: 0
                    }
                }],
                workflows: [],
                settings: {
                    maxAgents: 10,
                    defaultModel: 'xiaomi/mimo-v2-flash:free',
                    apiTimeout: 30000,
                    autoSaveInterval: 60000,
                    theme: 'light'
                },
                usageStats: {
                    totalTasksExecuted: 0,
                    totalAgentsCreated: 0,
                    totalWorkflowsRun: 0,
                    averageTaskDuration: 0,
                    lastActiveDate: new Date()
                },
                version: '1.0.0',
                exportedAt: new Date().toISOString()
            };

            const result = configManager.validateConfiguration(validConfig);
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('should detect invalid agent structure', () => {
            const invalidConfig = {
                agents: [{
                    id: 'agent-1',
                    // Missing required fields
                    name: 'Test Agent'
                }],
                workflows: [],
                settings: {
                    maxAgents: 10,
                    defaultModel: 'xiaomi/mimo-v2-flash:free',
                    apiTimeout: 30000,
                    autoSaveInterval: 60000,
                    theme: 'light'
                },
                version: '1.0.0'
            };

            const result = configManager.validateConfiguration(invalidConfig);
            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        test('should detect version mismatch and require migration', () => {
            const oldVersionConfig = {
                agents: [],
                workflows: [],
                settings: {
                    maxAgents: 10,
                    defaultModel: 'xiaomi/mimo-v2-flash:free',
                    apiTimeout: 30000,
                    autoSaveInterval: 60000,
                    theme: 'light'
                },
                version: '0.9.0'
            };

            const result = configManager.validateConfiguration(oldVersionConfig);
            expect(result.migrationRequired).toBe(true);
            expect(result.targetVersion).toBe('1.0.0');
        });

        test('should handle missing version gracefully', () => {
            const noVersionConfig = {
                agents: [],
                workflows: [],
                settings: {
                    maxAgents: 10,
                    defaultModel: 'xiaomi/mimo-v2-flash:free',
                    apiTimeout: 30000,
                    autoSaveInterval: 60000,
                    theme: 'light'
                }
            };

            const result = configManager.validateConfiguration(noVersionConfig);
            expect(result.migrationRequired).toBe(true);
            expect(result.warnings.length).toBeGreaterThan(0);
        });
    });

    describe('Backup and Restore', () => {
        test('should create backup successfully', async () => {
            const agents: Agent[] = [{
                id: 'agent-1',
                name: 'Backup Test Agent',
                role: 'assistant',
                promptTemplate: 'You are helpful',
                status: 'idle',
                config: {
                    maxTokens: 100,
                    temperature: 0.7,
                    model: 'xiaomi/mimo-v2-flash:free'
                },
                stats: {
                    tasksCompleted: 0,
                    averageResponseTime: 0,
                    errorCount: 0
                }
            }];

            await storageManager.saveAgents(agents);

            const backup = await configManager.createBackup('Test Backup');

            expect(backup.id).toBeDefined();
            expect(backup.name).toBe('Test Backup');
            expect(backup.createdAt).toBeDefined();
            expect(backup.size).toBeGreaterThan(0);
            expect(backup.version).toBe('1.0.0');
        });

        test('should restore from backup successfully', async () => {
            const originalAgents: Agent[] = [{
                id: 'agent-original',
                name: 'Original Agent',
                role: 'assistant',
                promptTemplate: 'You are helpful',
                status: 'idle',
                config: {
                    maxTokens: 100,
                    temperature: 0.7,
                    model: 'xiaomi/mimo-v2-flash:free'
                },
                stats: {
                    tasksCompleted: 0,
                    averageResponseTime: 0,
                    errorCount: 0
                }
            }];

            await storageManager.saveAgents(originalAgents);
            const backup = await configManager.createBackup('Restore Test');

            // Modify current configuration
            const modifiedAgents: Agent[] = [{
                id: 'agent-modified',
                name: 'Modified Agent',
                role: 'assistant',
                promptTemplate: 'You are different',
                status: 'idle',
                config: {
                    maxTokens: 200,
                    temperature: 0.9,
                    model: 'xiaomi/mimo-v2-flash:free'
                },
                stats: {
                    tasksCompleted: 5,
                    averageResponseTime: 1000,
                    errorCount: 0
                }
            }];

            await storageManager.saveAgents(modifiedAgents);

            // Restore from backup
            await configManager.restoreFromBackup(backup.id);

            const restoredAgents = await storageManager.loadAgents();
            expect(restoredAgents).toEqual(originalAgents);
        });

        test('should list all backups', async () => {
            await storageManager.saveAgents([]);

            const backup1 = await configManager.createBackup('Backup 1');
            const backup2 = await configManager.createBackup('Backup 2');

            const backups = await configManager.listBackups();

            expect(backups.length).toBeGreaterThanOrEqual(2);
            expect(backups.some(b => b.id === backup1.id)).toBe(true);
            expect(backups.some(b => b.id === backup2.id)).toBe(true);
        });

        test('should delete backup successfully', async () => {
            await storageManager.saveAgents([]);
            const backup = await configManager.createBackup('Delete Test');

            await configManager.deleteBackup(backup.id);

            const backups = await configManager.listBackups();
            expect(backups.some(b => b.id === backup.id)).toBe(false);
        });

        test('should throw error when restoring non-existent backup', async () => {
            await expect(configManager.restoreFromBackup('non-existent-id'))
                .rejects.toThrow(ConfigurationManagerError);
        });

        test('should limit number of backups to maximum', async () => {
            await storageManager.saveAgents([]);

            // Create more than MAX_BACKUPS (10)
            for (let i = 0; i < 12; i++) {
                await configManager.createBackup(`Backup ${i}`);
            }

            const backups = await configManager.listBackups();
            expect(backups.length).toBeLessThanOrEqual(10);
        });
    });

    describe('Checksum Verification', () => {
        test('should generate checksum for configuration', async () => {
            const agents: Agent[] = [{
                id: 'agent-1',
                name: 'Checksum Test',
                role: 'assistant',
                promptTemplate: 'You are helpful',
                status: 'idle',
                config: {
                    maxTokens: 100,
                    temperature: 0.7,
                    model: 'xiaomi/mimo-v2-flash:free'
                },
                stats: {
                    tasksCompleted: 0,
                    averageResponseTime: 0,
                    errorCount: 0
                }
            }];

            await storageManager.saveAgents(agents);
            const config = await configManager.loadConfiguration();

            expect(config.checksum).toBeDefined();
            expect(typeof config.checksum).toBe('string');
        });

        test.skip('should detect corrupted data via checksum mismatch', async () => {
            // Create a simple test to verify checksum logic
            const testData1 = { name: 'test', value: 123 };
            const testData2 = { name: 'different', value: 123 };

            const checksum1 = (configManager as any).generateChecksum(testData1);
            const checksum2 = (configManager as any).generateChecksum(testData2);

            // Checksums should be different for different data
            expect(checksum1).not.toBe(checksum2);

            // Now test with actual configuration data
            const configData: ConfigurationData = {
                agents: [{
                    id: 'agent-1',
                    name: 'Original Name',
                    role: 'assistant',
                    promptTemplate: 'You are helpful',
                    status: 'idle',
                    config: {
                        maxTokens: 100,
                        temperature: 0.7,
                        model: 'xiaomi/mimo-v2-flash:free'
                    },
                    stats: {
                        tasksCompleted: 0,
                        averageResponseTime: 0,
                        errorCount: 0
                    }
                }],
                workflows: [],
                settings: {
                    maxAgents: 10,
                    defaultModel: 'xiaomi/mimo-v2-flash:free',
                    apiTimeout: 30000,
                    autoSaveInterval: 60000,
                    theme: 'light'
                },
                usageStats: {
                    totalTasksExecuted: 0,
                    totalAgentsCreated: 0,
                    totalWorkflowsRun: 0,
                    averageTaskDuration: 0,
                    lastActiveDate: new Date('2023-01-01')
                },
                version: '1.0.0',
                exportedAt: '2023-01-01T00:00:00.000Z'
            };

            // Generate checksum for original data (without checksum field)
            const originalChecksum = (configManager as any).generateChecksum(configData);

            // Create corrupted version
            const corruptedData = JSON.parse(JSON.stringify(configData));
            corruptedData.agents[0].name = 'Corrupted Name';
            corruptedData.checksum = originalChecksum; // Keep old checksum

            // This should fail because the checksum doesn't match the corrupted data
            await expect(configManager.importConfiguration(JSON.stringify(corruptedData)))
                .rejects.toThrow('checksum mismatch');
        });
    });

    describe('Error Handling', () => {
        test('should handle storage errors gracefully', async () => {
            // Create a manager with a mock that throws errors
            const mockStorage = {
                initialize: jest.fn().mockRejectedValue(new Error('Storage error')),
                loadAgents: jest.fn().mockRejectedValue(new Error('Load error')),
                loadWorkflows: jest.fn().mockRejectedValue(new Error('Load error')),
                loadSettings: jest.fn().mockRejectedValue(new Error('Load error'))
            } as any;

            const errorConfigManager = new ConfigurationManager(mockStorage);

            await expect(errorConfigManager.loadConfiguration())
                .rejects.toThrow(ConfigurationManagerError);
        });

        test('should provide detailed error information', async () => {
            try {
                await configManager.importConfiguration('invalid json');
                fail('Should have thrown an error');
            } catch (error) {
                expect(error).toBeInstanceOf(ConfigurationManagerError);
                const configError = error as ConfigurationManagerError;
                expect(configError.operation).toBe('importConfiguration');
                expect(configError.message).toContain('Failed to import configuration');
            }
        });
    });
});
