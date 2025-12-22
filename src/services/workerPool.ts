/**
 * Worker Pool Manager
 * Manages a pool of Web Workers for parallel task execution
 */

import { Task } from '../types/task';
import { Agent } from '../types/agent';

export interface WorkerMessage {
    type: 'EXECUTE_TASK' | 'TASK_RESULT' | 'TASK_ERROR' | 'WORKER_READY' | 'PING' | 'PONG';
    payload?: any;
    taskId?: string;
    workerId?: string;
    error?: string;
}

export interface WorkerInfo {
    id: string;
    worker: Worker;
    isReady: boolean;
    isBusy: boolean;
    currentTaskId?: string;
    createdAt: Date;
    tasksCompleted: number;
    errorCount: number;
}

export interface WorkerPoolConfig {
    maxWorkers: number;
    minWorkers: number;
    workerTimeout: number; // milliseconds
    healthCheckInterval: number; // milliseconds
}

export class WorkerPoolError extends Error {
    constructor(message: string, public code?: string) {
        super(message);
        this.name = 'WorkerPoolError';
    }
}

export class WorkerPool {
    private workers: Map<string, WorkerInfo> = new Map();
    private config: WorkerPoolConfig;
    private taskQueue: Array<{ task: Task; agent: Agent; resolve: (result: string) => void; reject: (error: Error) => void }> = [];
    private healthCheckInterval: number | null = null;
    private isShuttingDown: boolean = false;

    constructor(config: Partial<WorkerPoolConfig> = {}) {
        this.config = {
            maxWorkers: config.maxWorkers || 4,
            minWorkers: config.minWorkers || 1,
            workerTimeout: config.workerTimeout || 30000, // 30 seconds
            healthCheckInterval: config.healthCheckInterval || 10000 // 10 seconds
        };

        this.initialize();
    }

    private async initialize(): Promise<void> {
        // Create minimum number of workers
        for (let i = 0; i < this.config.minWorkers; i++) {
            await this.createWorker();
        }

        // Start health check
        this.startHealthCheck();
    }

    /**
     * Create a mock worker for testing environments
     */
    private createMockWorker(): Worker {
        // Create a minimal mock worker for testing
        const mockWorker = {
            postMessage: (message: any) => {
                // Simulate async worker response
                setTimeout(() => {
                    if (message.type === 'EXECUTE_TASK') {
                        // Mock successful task execution
                        const response = {
                            type: 'TASK_RESULT',
                            taskId: message.taskId,
                            payload: {
                                result: `Mock result for: ${message.payload?.task?.prompt || 'unknown task'}`,
                                completedAt: new Date().toISOString(),
                                workerId: 'mock_worker'
                            }
                        };
                        if (mockWorker.onmessage) {
                            mockWorker.onmessage({ data: response } as MessageEvent);
                        }
                    } else if (message.type === 'PING') {
                        const response = { type: 'PONG', workerId: 'mock_worker' };
                        if (mockWorker.onmessage) {
                            mockWorker.onmessage({ data: response } as MessageEvent);
                        }
                    }
                }, 100); // 100ms delay to simulate processing
            },
            terminate: () => {
                // Mock termination
            },
            onmessage: null as ((event: MessageEvent) => void) | null,
            onerror: null as ((error: ErrorEvent) => void) | null
        };

        // Simulate worker ready message
        setTimeout(() => {
            if (mockWorker.onmessage) {
                mockWorker.onmessage({
                    data: { type: 'WORKER_READY', workerId: 'mock_worker' }
                } as MessageEvent);
            }
        }, 50);

        return mockWorker as unknown as Worker;
    }

    /**
     * Execute a task using an available worker
     */
    async executeTask(task: Task, agent: Agent): Promise<string> {
        return new Promise((resolve, reject) => {
            if (this.isShuttingDown) {
                reject(new WorkerPoolError('Worker pool is shutting down', 'POOL_SHUTDOWN'));
                return;
            }

            // Add to queue
            this.taskQueue.push({ task, agent, resolve, reject });

            // Try to process immediately
            this.processQueue();
        });
    }

    /**
     * Get pool statistics
     */
    getStats(): {
        totalWorkers: number;
        readyWorkers: number;
        busyWorkers: number;
        queueLength: number;
        totalTasksCompleted: number;
        totalErrors: number;
    } {
        const workers = Array.from(this.workers.values());
        const totalTasksCompleted = workers.reduce((sum, w) => sum + w.tasksCompleted, 0);
        const totalErrors = workers.reduce((sum, w) => sum + w.errorCount, 0);

        return {
            totalWorkers: workers.length,
            readyWorkers: workers.filter(w => w.isReady && !w.isBusy).length,
            busyWorkers: workers.filter(w => w.isBusy).length,
            queueLength: this.taskQueue.length,
            totalTasksCompleted,
            totalErrors
        };
    }

    /**
     * Get detailed worker information
     */
    getWorkerInfo(): WorkerInfo[] {
        return Array.from(this.workers.values()).map(worker => ({
            ...worker,
            worker: undefined as any // Don't expose the actual Worker object
        }));
    }

    /**
     * Shutdown the worker pool
     */
    async shutdown(): Promise<void> {
        this.isShuttingDown = true;

        // Stop health check
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }

        // Reject all queued tasks
        this.taskQueue.forEach(({ reject }) => {
            reject(new WorkerPoolError('Worker pool shutdown', 'POOL_SHUTDOWN'));
        });
        this.taskQueue = [];

        // Terminate all workers
        const terminationPromises = Array.from(this.workers.values()).map(workerInfo => {
            return new Promise<void>((resolve) => {
                workerInfo.worker.terminate();
                resolve();
            });
        });

        await Promise.all(terminationPromises);
        this.workers.clear();
    }

    private async createWorker(): Promise<WorkerInfo> {
        if (this.workers.size >= this.config.maxWorkers) {
            throw new WorkerPoolError('Maximum worker limit reached', 'MAX_WORKERS_EXCEEDED');
        }

        try {
            // Create worker from the task worker script
            // Handle both browser and test environments
            let worker: Worker;
            if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
                try {
                    // Browser environment - try to create worker with module support
                    worker = new Worker(
                        new URL('../workers/taskWorker.ts', window.location.href),
                        { type: 'module' }
                    );
                } catch (error) {
                    // Fallback for environments that don't support module workers
                    throw new WorkerPoolError(`Failed to create worker: ${error}`);
                }
            } else {
                // Test environment or fallback - create a mock worker
                worker = this.createMockWorker();
            }

            const workerId = `worker_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

            const workerInfo: WorkerInfo = {
                id: workerId,
                worker,
                isReady: false,
                isBusy: false,
                createdAt: new Date(),
                tasksCompleted: 0,
                errorCount: 0
            };

            // Set up message handling
            worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
                this.handleWorkerMessage(workerId, event.data);
            };

            worker.onerror = (error) => {
                console.error(`Worker ${workerId} error:`, error);
                this.handleWorkerError(workerId, error);
            };

            // Add to pool
            this.workers.set(workerId, workerInfo);

            return workerInfo;
        } catch (error) {
            throw new WorkerPoolError(
                `Failed to create worker: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'WORKER_CREATION_FAILED'
            );
        }
    }

    private handleWorkerMessage(workerId: string, message: WorkerMessage): void {
        const workerInfo = this.workers.get(workerId);
        if (!workerInfo) {
            console.warn(`Received message from unknown worker: ${workerId}`);
            return;
        }

        switch (message.type) {
            case 'WORKER_READY':
                workerInfo.isReady = true;
                console.log(`Worker ${workerId} is ready`);
                this.processQueue();
                break;

            case 'TASK_RESULT':
                this.handleTaskResult(workerId, message);
                break;

            case 'TASK_ERROR':
                this.handleTaskError(workerId, message);
                break;

            case 'PONG':
                // Health check response - worker is alive
                break;

            default:
                console.warn(`Unknown message type from worker ${workerId}:`, message.type);
        }
    }

    private handleTaskResult(workerId: string, message: WorkerMessage): void {
        const workerInfo = this.workers.get(workerId);
        if (!workerInfo) return;

        // Mark worker as available
        workerInfo.isBusy = false;
        workerInfo.currentTaskId = undefined;
        workerInfo.tasksCompleted++;

        // Find and resolve the corresponding task
        const taskIndex = this.taskQueue.findIndex(
            item => item.task.id === message.taskId
        );

        if (taskIndex >= 0) {
            const { resolve } = this.taskQueue[taskIndex];
            this.taskQueue.splice(taskIndex, 1);
            resolve(message.payload?.result || '');
        }

        // Process next task in queue
        this.processQueue();
    }

    private handleTaskError(workerId: string, message: WorkerMessage): void {
        const workerInfo = this.workers.get(workerId);
        if (!workerInfo) return;

        // Mark worker as available
        workerInfo.isBusy = false;
        workerInfo.currentTaskId = undefined;
        workerInfo.errorCount++;

        // Find and reject the corresponding task
        const taskIndex = this.taskQueue.findIndex(
            item => item.task.id === message.taskId
        );

        if (taskIndex >= 0) {
            const { reject } = this.taskQueue[taskIndex];
            this.taskQueue.splice(taskIndex, 1);
            reject(new WorkerPoolError(message.error || 'Task execution failed', 'TASK_EXECUTION_FAILED'));
        }

        // Process next task in queue
        this.processQueue();
    }

    private handleWorkerError(workerId: string, error: ErrorEvent): void {
        const workerInfo = this.workers.get(workerId);
        if (!workerInfo) return;

        console.error(`Worker ${workerId} encountered an error:`, error);
        workerInfo.errorCount++;

        // If worker was processing a task, reject it
        if (workerInfo.currentTaskId) {
            const taskIndex = this.taskQueue.findIndex(
                item => item.task.id === workerInfo.currentTaskId
            );

            if (taskIndex >= 0) {
                const { reject } = this.taskQueue[taskIndex];
                this.taskQueue.splice(taskIndex, 1);
                reject(new WorkerPoolError('Worker error during task execution', 'WORKER_ERROR'));
            }
        }

        // Remove the failed worker
        this.workers.delete(workerId);
        workerInfo.worker.terminate();

        // Create a replacement worker if needed
        if (this.workers.size < this.config.minWorkers && !this.isShuttingDown) {
            this.createWorker().catch(error => {
                console.error('Failed to create replacement worker:', error);
            });
        }
    }

    private processQueue(): void {
        if (this.taskQueue.length === 0) {
            return;
        }

        // Find available workers
        const availableWorkers = Array.from(this.workers.values())
            .filter(worker => worker.isReady && !worker.isBusy);

        if (availableWorkers.length === 0) {
            // Try to create more workers if under limit
            if (this.workers.size < this.config.maxWorkers) {
                this.createWorker().catch(error => {
                    console.error('Failed to create additional worker:', error);
                });
            }
            return;
        }

        // Assign tasks to available workers
        const tasksToProcess = Math.min(this.taskQueue.length, availableWorkers.length);

        for (let i = 0; i < tasksToProcess; i++) {
            const { task, agent } = this.taskQueue[i];
            const worker = availableWorkers[i];

            // Mark worker as busy
            worker.isBusy = true;
            worker.currentTaskId = task.id;

            // Send task to worker
            worker.worker.postMessage({
                type: 'EXECUTE_TASK',
                payload: { task, agent },
                taskId: task.id
            });
        }
    }

    private startHealthCheck(): void {
        if (this.healthCheckInterval) {
            return;
        }

        this.healthCheckInterval = window.setInterval(() => {
            // Ping all workers to check if they're responsive
            this.workers.forEach((workerInfo, workerId) => {
                if (workerInfo.isReady) {
                    workerInfo.worker.postMessage({ type: 'PING' });
                }
            });
        }, this.config.healthCheckInterval);
    }
}