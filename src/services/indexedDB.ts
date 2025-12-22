/**
 * IndexedDB operations for tasks and logs with error handling
 */

import type { Task } from '../types/task';

export class IndexedDBError extends Error {
    constructor(message: string, public readonly operation: string) {
        super(message);
        this.name = 'IndexedDBError';
    }
}

export interface ExecutionLog {
    id: string;
    taskId: string;
    agentId: string;
    timestamp: Date;
    level: 'info' | 'warn' | 'error';
    message: string;
    details?: any;
}

export interface TaskResult {
    id: string;
    taskId: string;
    result: string;
    metadata: {
        executionTime: number;
        tokensUsed: number;
        model: string;
    };
    createdAt: Date;
}

export class IndexedDBManager {
    private readonly DB_NAME = 'AIAgentOrchestration';
    private readonly DB_VERSION = 1;
    private db: IDBDatabase | null = null;

    private readonly STORES = {
        TASKS: 'tasks',
        TASK_RESULTS: 'task_results',
        EXECUTION_LOGS: 'execution_logs'
    } as const;

    /**
     * Initialize IndexedDB connection
     */
    async initialize(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                reject(new IndexedDBError('IndexedDB is not supported', 'initialize'));
                return;
            }

            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

            request.onerror = () => {
                reject(new IndexedDBError(
                    `Failed to open database: ${request.error?.message || 'Unknown error'}`,
                    'initialize'
                ));
            };

            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                this.createStores(db);
            };
        });
    }
    /**
     * Create object stores during database upgrade
     */
    private createStores(db: IDBDatabase): void {
        // Tasks store
        if (!db.objectStoreNames.contains(this.STORES.TASKS)) {
            const taskStore = db.createObjectStore(this.STORES.TASKS, { keyPath: 'id' });
            taskStore.createIndex('status', 'status', { unique: false });
            taskStore.createIndex('priority', 'priority', { unique: false });
            taskStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Task results store
        if (!db.objectStoreNames.contains(this.STORES.TASK_RESULTS)) {
            const resultStore = db.createObjectStore(this.STORES.TASK_RESULTS, { keyPath: 'id' });
            resultStore.createIndex('taskId', 'taskId', { unique: false });
            resultStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Execution logs store
        if (!db.objectStoreNames.contains(this.STORES.EXECUTION_LOGS)) {
            const logStore = db.createObjectStore(this.STORES.EXECUTION_LOGS, { keyPath: 'id' });
            logStore.createIndex('taskId', 'taskId', { unique: false });
            logStore.createIndex('agentId', 'agentId', { unique: false });
            logStore.createIndex('level', 'level', { unique: false });
            logStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
    }

    /**
     * Ensure database is initialized
     */
    private async ensureInitialized(): Promise<void> {
        if (!this.db) {
            await this.initialize();
        }
    }

    /**
     * Generic method to perform IndexedDB operations
     */
    private async performOperation<T>(
        storeName: string,
        operation: (store: IDBObjectStore) => IDBRequest<T>,
        mode: IDBTransactionMode = 'readonly'
    ): Promise<T> {
        await this.ensureInitialized();

        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new IndexedDBError('Database not initialized', 'performOperation'));
                return;
            }

            try {
                const transaction = this.db.transaction([storeName], mode);
                const store = transaction.objectStore(storeName);
                const request = operation(store);

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(new IndexedDBError(
                    `Operation failed: ${request.error?.message || 'Unknown error'}`,
                    'performOperation'
                ));
            } catch (error) {
                reject(new IndexedDBError(
                    `Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    'performOperation'
                ));
            }
        });
    }

    /**
     * Save task to IndexedDB
     */
    async saveTask(task: Task): Promise<void> {
        await this.performOperation(
            this.STORES.TASKS,
            (store) => store.put(task),
            'readwrite'
        );
    }

    /**
     * Get task by ID
     */
    async getTask(taskId: string): Promise<Task | null> {
        const result = await this.performOperation(
            this.STORES.TASKS,
            (store) => store.get(taskId)
        );
        return result || null;
    }

    /**
     * Get all tasks with optional filtering
     */
    async getTasks(filter?: { status?: string; priority?: number }): Promise<Task[]> {
        return this.performOperation(
            this.STORES.TASKS,
            (store) => {
                if (filter?.status) {
                    const index = store.index('status');
                    return index.getAll(filter.status);
                }
                if (filter?.priority !== undefined) {
                    const index = store.index('priority');
                    return index.getAll(filter.priority);
                }
                return store.getAll();
            }
        );
    }

    /**
     * Delete task by ID
     */
    async deleteTask(taskId: string): Promise<void> {
        await this.performOperation(
            this.STORES.TASKS,
            (store) => store.delete(taskId),
            'readwrite'
        );
    }

    /**
     * Save task result
     */
    async saveTaskResult(result: TaskResult): Promise<void> {
        await this.performOperation(
            this.STORES.TASK_RESULTS,
            (store) => store.put(result),
            'readwrite'
        );
    }

    /**
     * Get task result by task ID
     */
    async getTaskResult(taskId: string): Promise<TaskResult | null> {
        const results = await this.performOperation(
            this.STORES.TASK_RESULTS,
            (store) => {
                const index = store.index('taskId');
                return index.getAll(taskId);
            }
        );
        return results.length > 0 ? results[0] : null;
    }

    /**
     * Save execution log
     */
    async saveLog(log: ExecutionLog): Promise<void> {
        await this.performOperation(
            this.STORES.EXECUTION_LOGS,
            (store) => store.put(log),
            'readwrite'
        );
    }

    /**
     * Get logs with optional filtering
     */
    async getLogs(filter?: {
        taskId?: string;
        agentId?: string;
        level?: string;
        limit?: number;
    }): Promise<ExecutionLog[]> {
        return this.performOperation(
            this.STORES.EXECUTION_LOGS,
            (store) => {
                if (filter?.taskId) {
                    const index = store.index('taskId');
                    return index.getAll(filter.taskId);
                }
                if (filter?.agentId) {
                    const index = store.index('agentId');
                    return index.getAll(filter.agentId);
                }
                if (filter?.level) {
                    const index = store.index('level');
                    return index.getAll(filter.level);
                }
                return store.getAll();
            }
        );
    }

    /**
     * Add execution log (alias for saveLog)
     */
    async addExecutionLog(log: ExecutionLog): Promise<void> {
        return this.saveLog(log);
    }

    /**
     * Get execution logs (alias for getLogs)
     */
    async getExecutionLogs(filter?: {
        taskId?: string;
        agentId?: string;
        level?: ExecutionLog['level'];
        startDate?: Date;
        endDate?: Date;
    }): Promise<ExecutionLog[]> {
        return this.getLogs(filter);
    }

    /**
     * Clear old logs (keep only recent ones)
     */
    async clearOldLogs(daysToKeep: number = 30): Promise<void> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

        await this.performOperation(
            this.STORES.EXECUTION_LOGS,
            (store) => {
                const index = store.index('timestamp');
                const range = IDBKeyRange.upperBound(cutoffDate);
                return index.openCursor(range);
            },
            'readwrite'
        );
    }

    /**
     * Get storage usage statistics
     */
    async getStorageStats(): Promise<{
        taskCount: number;
        resultCount: number;
        logCount: number;
    }> {
        const [taskCount, resultCount, logCount] = await Promise.all([
            this.performOperation(this.STORES.TASKS, (store) => store.count()),
            this.performOperation(this.STORES.TASK_RESULTS, (store) => store.count()),
            this.performOperation(this.STORES.EXECUTION_LOGS, (store) => store.count())
        ]);

        return { taskCount, resultCount, logCount };
    }

    /**
     * Close database connection
     */
    close(): void {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }
}