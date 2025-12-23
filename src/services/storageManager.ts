/**
 * Unified storage manager combining LocalStorage and IndexedDB
 */

import type { Agent } from '../types/agent';
import type { Task } from '../types/task';
import type { Workflow } from '../types/workflow';
import type { SystemSettings, /* UsageStatistics, */ StorageManager } from '../types/storage';

import { LocalStorageManager, /* LocalStorageError */ } from './localStorage';
import { IndexedDBManager, /* IndexedDBError, */ type ExecutionLog, /* type TaskResult */ } from './indexedDB';
// import { DataSerializer, SerializationError } from './serialization';

export class StorageManagerError extends Error {
    constructor(message: string, public readonly operation: string, public readonly cause?: Error) {
        super(message);
        this.name = 'StorageManagerError';
    }
}

export class UnifiedStorageManager implements StorageManager {
    private localStorageManager: LocalStorageManager;
    private indexedDBManager: IndexedDBManager;
    private initialized = false;
    private indexedDBAvailable = false;

    constructor() {
        this.localStorageManager = new LocalStorageManager();
        this.indexedDBManager = new IndexedDBManager();
    }

    /**
     * Initialize both storage systems with fallback
     */
    async initialize(): Promise<void> {
        try {
            // Always initialize localStorage first (it's more reliable)
            // LocalStorage doesn't need explicit initialization

            // Try to initialize IndexedDB with fallback
            try {
                await this.indexedDBManager.initialize();
                this.indexedDBAvailable = true;
                console.log('IndexedDB initialized successfully');
            } catch (error) {
                console.warn('IndexedDB initialization failed, falling back to localStorage-only mode:', error);
                this.indexedDBAvailable = false;
                // Don't throw error - we can still function with localStorage only
            }

            this.initialized = true;
        } catch (error) {
            throw new StorageManagerError(
                'Failed to initialize storage systems',
                'initialize',
                error instanceof Error ? error : new Error('Unknown error')
            );
        }
    }

    /**
     * Ensure storage is initialized
     */
    private async ensureInitialized(): Promise<void> {
        if (!this.initialized) {
            await this.initialize();
        }
    }

    /**
     * Save agents to LocalStorage
     */
    async saveAgents(agents: Agent[]): Promise<void> {
        try {
            await this.localStorageManager.saveAgents(agents);
        } catch (error) {
            throw new StorageManagerError(
                'Failed to save agents',
                'saveAgents',
                error instanceof Error ? error : new Error('Unknown error')
            );
        }
    }

    /**
     * Load agents from LocalStorage
     */
    async loadAgents(): Promise<Agent[]> {
        try {
            return this.localStorageManager.loadAgents();
        } catch (error) {
            throw new StorageManagerError(
                'Failed to load agents',
                'loadAgents',
                error instanceof Error ? error : new Error('Unknown error')
            );
        }
    }

    /**
     * Save workflows to LocalStorage
     */
    async saveWorkflows(workflows: Workflow[]): Promise<void> {
        try {
            await this.localStorageManager.saveWorkflows(workflows);
        } catch (error) {
            throw new StorageManagerError(
                'Failed to save workflows',
                'saveWorkflows',
                error instanceof Error ? error : new Error('Unknown error')
            );
        }
    }

    /**
     * Load workflows from LocalStorage
     */
    async loadWorkflows(): Promise<Workflow[]> {
        try {
            return this.localStorageManager.loadWorkflows();
        } catch (error) {
            throw new StorageManagerError(
                'Failed to load workflows',
                'loadWorkflows',
                error instanceof Error ? error : new Error('Unknown error')
            );
        }
    }

    /**
     * Save a single workflow to LocalStorage
     */
    async saveWorkflow(workflow: Workflow): Promise<void> {
        try {
            // Load existing workflows, update or add the new one, then save all
            const workflows = await this.loadWorkflows();
            const existingIndex = workflows.findIndex(w => w.id === workflow.id);

            if (existingIndex >= 0) {
                workflows[existingIndex] = workflow;
            } else {
                workflows.push(workflow);
            }

            await this.saveWorkflows(workflows);
        } catch (error) {
            throw new StorageManagerError(
                'Failed to save workflow',
                'saveWorkflow',
                error instanceof Error ? error : new Error('Unknown error')
            );
        }
    }

    /**
     * Save system settings to LocalStorage
     */
    async saveSettings(settings: SystemSettings): Promise<void> {
        try {
            await this.localStorageManager.saveSettings(settings);
        } catch (error) {
            throw new StorageManagerError(
                'Failed to save settings',
                'saveSettings',
                error instanceof Error ? error : new Error('Unknown error')
            );
        }
    }

    /**
     * Load system settings from LocalStorage
     */
    async loadSettings(): Promise<SystemSettings> {
        try {
            return this.localStorageManager.loadSettings();
        } catch (error) {
            throw new StorageManagerError(
                'Failed to load settings',
                'loadSettings',
                error instanceof Error ? error : new Error('Unknown error')
            );
        }
    }

    /**
     * Export all configuration data
     */
    async exportConfiguration(): Promise<string> {
        try {
            return this.localStorageManager.exportConfiguration();
        } catch (error) {
            throw new StorageManagerError(
                'Failed to export configuration',
                'exportConfiguration',
                error instanceof Error ? error : new Error('Unknown error')
            );
        }
    }

    /**
     * Import configuration data
     */
    async importConfiguration(data: string): Promise<void> {
        try {
            await this.localStorageManager.importConfiguration(data);
        } catch (error) {
            throw new StorageManagerError(
                'Failed to import configuration',
                'importConfiguration',
                error instanceof Error ? error : new Error('Unknown error')
            );
        }
    }

    // IndexedDB operations for tasks and logs

    /**
     * Save task to IndexedDB (with localStorage fallback)
     */
    async saveTask(task: Task): Promise<void> {
        try {
            await this.ensureInitialized();

            if (this.indexedDBAvailable) {
                await this.indexedDBManager.saveTask(task);
            } else {
                // Fallback to localStorage for tasks
                console.warn('Using localStorage fallback for task storage');
                const tasks = await this.getTasks();
                const existingIndex = tasks.findIndex(t => t.id === task.id);

                if (existingIndex >= 0) {
                    tasks[existingIndex] = task;
                } else {
                    tasks.push(task);
                }

                localStorage.setItem('fallback_tasks', JSON.stringify(tasks));
            }
        } catch (error) {
            throw new StorageManagerError(
                'Failed to save task',
                'saveTask',
                error instanceof Error ? error : new Error('Unknown error')
            );
        }
    }

    /**
     * Get task by ID from IndexedDB (with localStorage fallback)
     */
    async getTask(taskId: string): Promise<Task | null> {
        try {
            await this.ensureInitialized();

            if (this.indexedDBAvailable) {
                return await this.indexedDBManager.getTask(taskId);
            } else {
                // Fallback to localStorage
                const tasks = await this.getTasks();
                return tasks.find(t => t.id === taskId) || null;
            }
        } catch (error) {
            throw new StorageManagerError(
                'Failed to get task',
                'getTask',
                error instanceof Error ? error : new Error('Unknown error')
            );
        }
    }

    /**
     * Get all tasks from IndexedDB (with localStorage fallback)
     */
    async getTasks(filter?: { status?: string; priority?: number }): Promise<Task[]> {
        try {
            await this.ensureInitialized();

            if (this.indexedDBAvailable) {
                return await this.indexedDBManager.getTasks(filter);
            } else {
                // Fallback to localStorage
                const tasksJson = localStorage.getItem('fallback_tasks');
                const tasks: Task[] = tasksJson ? JSON.parse(tasksJson) : [];

                // Apply basic filtering
                if (filter?.status) {
                    return tasks.filter(t => t.status === filter.status);
                }
                if (filter?.priority !== undefined) {
                    return tasks.filter(t => t.priority === filter.priority);
                }

                return tasks;
            }
        } catch (error) {
            throw new StorageManagerError(
                'Failed to get tasks',
                'getTasks',
                error instanceof Error ? error : new Error('Unknown error')
            );
        }
    }

    /**
     * Save execution log to IndexedDB (with localStorage fallback)
     */
    async saveLog(log: ExecutionLog): Promise<void> {
        try {
            await this.ensureInitialized();

            if (this.indexedDBAvailable) {
                await this.indexedDBManager.saveLog(log);
            } else {
                // Fallback to localStorage (with size limit)
                console.warn('Using localStorage fallback for log storage');
                const logsJson = localStorage.getItem('fallback_logs');
                const logs: ExecutionLog[] = logsJson ? JSON.parse(logsJson) : [];

                logs.push(log);

                // Keep only last 100 logs to prevent localStorage overflow
                if (logs.length > 100) {
                    logs.splice(0, logs.length - 100);
                }

                localStorage.setItem('fallback_logs', JSON.stringify(logs));
            }
        } catch (error) {
            throw new StorageManagerError(
                'Failed to save log',
                'saveLog',
                error instanceof Error ? error : new Error('Unknown error')
            );
        }
    }

    /**
     * Get logs from IndexedDB (with localStorage fallback)
     */
    async getLogs(filter?: {
        taskId?: string;
        agentId?: string;
        level?: string;
        limit?: number;
    }): Promise<ExecutionLog[]> {
        try {
            await this.ensureInitialized();

            if (this.indexedDBAvailable) {
                return await this.indexedDBManager.getLogs(filter);
            } else {
                // Fallback to localStorage
                const logsJson = localStorage.getItem('fallback_logs');
                const logs: ExecutionLog[] = logsJson ? JSON.parse(logsJson) : [];

                // Apply basic filtering
                let filteredLogs = logs;

                if (filter?.taskId) {
                    filteredLogs = filteredLogs.filter(l => l.taskId === filter.taskId);
                }
                if (filter?.agentId) {
                    filteredLogs = filteredLogs.filter(l => l.agentId === filter.agentId);
                }
                if (filter?.level) {
                    filteredLogs = filteredLogs.filter(l => l.level === filter.level);
                }
                if (filter?.limit) {
                    filteredLogs = filteredLogs.slice(0, filter.limit);
                }

                return filteredLogs;
            }
        } catch (error) {
            throw new StorageManagerError(
                'Failed to get logs',
                'getLogs',
                error instanceof Error ? error : new Error('Unknown error')
            );
        }
    }

    /**
     * Get storage quota information
     */
    async getStorageQuota() {
        try {
            return await this.localStorageManager.getStorageQuota();
        } catch (error) {
            throw new StorageManagerError(
                'Failed to get storage quota',
                'getStorageQuota',
                error instanceof Error ? error : new Error('Unknown error')
            );
        }
    }

    /**
     * Get storage statistics (with fallback handling)
     */
    async getStorageStats() {
        try {
            await this.ensureInitialized();
            const quota = await this.localStorageManager.getStorageQuota();

            if (this.indexedDBAvailable) {
                const dbStats = await this.indexedDBManager.getStorageStats();
                return {
                    localStorage: quota,
                    indexedDB: dbStats,
                    mode: 'full' as const
                };
            } else {
                // Fallback mode statistics
                const fallbackTasks = localStorage.getItem('fallback_tasks');
                const fallbackLogs = localStorage.getItem('fallback_logs');

                return {
                    localStorage: quota,
                    indexedDB: {
                        taskCount: fallbackTasks ? JSON.parse(fallbackTasks).length : 0,
                        resultCount: 0,
                        logCount: fallbackLogs ? JSON.parse(fallbackLogs).length : 0
                    },
                    mode: 'fallback' as const
                };
            }
        } catch (error) {
            throw new StorageManagerError(
                'Failed to get storage stats',
                'getStorageStats',
                error instanceof Error ? error : new Error('Unknown error')
            );
        }
    }

    /**
     * Clear all stored data
     */
    async clearAll(): Promise<void> {
        try {
            await this.localStorageManager.clearAll();
            // Note: IndexedDB clearing would require more complex implementation
        } catch (error) {
            throw new StorageManagerError(
                'Failed to clear storage',
                'clearAll',
                error instanceof Error ? error : new Error('Unknown error')
            );
        }
    }
}