/**
 * Web Worker Integration Service
 * Integrates Web Worker pool with the existing task queue and agent management system
 */

import { WorkerPool, WorkerPoolConfig } from './workerPool';
import { TaskQueueEngine } from './taskQueue';
import { AgentManager } from './agentManager';
import { Task, /* TaskStatus */ } from '../types/task';
import { Agent } from '../types/agent';

export interface WebWorkerIntegrationConfig {
    workerPool?: Partial<WorkerPoolConfig>;
    enableParallelExecution?: boolean;
    fallbackToMainThread?: boolean;
}

export class WebWorkerIntegrationError extends Error {
    constructor(message: string, public code?: string) {
        super(message);
        this.name = 'WebWorkerIntegrationError';
    }
}

export class WebWorkerIntegration {
    private workerPool: WorkerPool;
    private taskQueue: TaskQueueEngine;
    private agentManager: AgentManager;
    private config: WebWorkerIntegrationConfig;
    private isEnabled: boolean = true;
    private processingTasks: Set<string> = new Set();

    constructor(
        taskQueue: TaskQueueEngine,
        agentManager: AgentManager,
        config: WebWorkerIntegrationConfig = {}
    ) {
        this.taskQueue = taskQueue;
        this.agentManager = agentManager;
        this.config = {
            enableParallelExecution: true,
            fallbackToMainThread: true,
            ...config
        };

        // Initialize worker pool
        this.workerPool = new WorkerPool(config.workerPool);

        // Check if Web Workers are supported
        if (!this.isWebWorkerSupported()) {
            console.warn('Web Workers not supported, falling back to main thread execution');
            this.isEnabled = false;
        }

        this.initialize();
    }

    /**
     * Initialize the integration by hooking into task processing
     */
    private initialize(): void {
        // Override the task queue's processing to use Web Workers
        this.startWorkerTaskProcessing();
    }

    /**
     * Start processing tasks using Web Workers
     */
    private startWorkerTaskProcessing(): void {
        // Process tasks every 500ms
        setInterval(() => {
            this.processTasksWithWorkers();
        }, 500);
    }

    /**
     * Process pending tasks using the worker pool
     */
    private async processTasksWithWorkers(): Promise<void> {
        if (!this.isEnabled || !this.config.enableParallelExecution) {
            return;
        }

        try {
            // Get available agents
            const availableAgents = this.agentManager.getAvailableAgents();
            if (availableAgents.length === 0) {
                return;
            }

            // Get pending tasks
            const pendingTasks = this.taskQueue.getTasksByStatus('pending')
                .filter(task => !this.processingTasks.has(task.id));

            if (pendingTasks.length === 0) {
                return;
            }

            // Get worker pool stats to determine capacity
            const workerStats = this.workerPool.getStats();
            const availableWorkerCapacity = workerStats.readyWorkers;

            if (availableWorkerCapacity === 0) {
                return;
            }

            // Process tasks up to available capacity
            const tasksToProcess = Math.min(
                pendingTasks.length,
                availableAgents.length,
                availableWorkerCapacity
            );

            for (let i = 0; i < tasksToProcess; i++) {
                const task = pendingTasks[i];
                const agent = availableAgents[i % availableAgents.length];

                // Mark task as being processed
                this.processingTasks.add(task.id);

                // Execute task in worker
                this.executeTaskInWorker(task, agent);
            }

        } catch (error) {
            console.error('Error processing tasks with workers:', error);
        }
    }

    /**
     * Execute a single task using a Web Worker
     */
    private async executeTaskInWorker(task: Task, agent: Agent): Promise<void> {
        try {
            // Update task status to running
            this.taskQueue.updateTaskStatus(task.id, 'running');

            // Update agent status to busy
            this.agentManager.updateAgentStatus(agent.id, 'busy');

            // Execute task in worker pool
            const result = await this.workerPool.executeTask(task, agent);

            // Task completed successfully
            await this.taskQueue.completeTask(task.id, result);

            // Update agent status back to idle
            this.agentManager.updateAgentStatus(agent.id, 'idle');

            // Update agent stats
            this.updateAgentStats(agent.id, true);

        } catch (error) {
            console.error(`Task ${task.id} failed in worker:`, error);

            // Task failed
            const errorMessage = error instanceof Error ? error.message : 'Unknown worker error';
            await this.taskQueue.completeTask(task.id, undefined, errorMessage);

            // Update agent status back to idle
            this.agentManager.updateAgentStatus(agent.id, 'idle');

            // Update agent stats
            this.updateAgentStats(agent.id, false);

            // If fallback is enabled and this wasn't a retry, try main thread execution
            if (this.config.fallbackToMainThread && task.retryCount === 0) {
                console.log(`Attempting fallback to main thread for task ${task.id}`);
                this.executeTaskInMainThread(task, agent);
            }

        } finally {
            // Remove from processing set
            this.processingTasks.delete(task.id);
        }
    }

    /**
     * Fallback execution in main thread (simplified implementation)
     */
    private async executeTaskInMainThread(task: Task, agent: Agent): Promise<void> {
        try {
            console.log(`Executing task ${task.id} in main thread as fallback`);

            // This is a simplified fallback - in a real implementation,
            // you would have a main thread task executor
            const result = await this.simulateMainThreadExecution(task);

            await this.taskQueue.completeTask(task.id, result);
            this.agentManager.updateAgentStatus(agent.id, 'idle');
            this.updateAgentStats(agent.id, true);

        } catch (error) {
            console.error(`Main thread fallback failed for task ${task.id}:`, error);
            const errorMessage = error instanceof Error ? error.message : 'Main thread execution failed';
            await this.taskQueue.completeTask(task.id, undefined, errorMessage);
            this.agentManager.updateAgentStatus(agent.id, 'idle');
            this.updateAgentStats(agent.id, false);
        }
    }

    /**
     * Simulate main thread execution (placeholder implementation)
     */
    private async simulateMainThreadExecution(task: Task, /* agent: Agent */): Promise<string> {
        // This is a placeholder - in a real implementation, you would
        // have the actual OpenRouter API client logic here
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                if (Math.random() > 0.1) { // 90% success rate for simulation
                    resolve(`Main thread result for: ${task.prompt}`);
                } else {
                    reject(new Error('Simulated main thread execution failure'));
                }
            }, 1000 + Math.random() * 2000); // 1-3 second delay
        });
    }

    /**
     * Update agent statistics
     */
    private updateAgentStats(agentId: string, success: boolean): void {
        const agent = this.agentManager.getAgent(agentId);
        if (!agent) return;

        const newStats = { ...agent.stats };

        if (success) {
            newStats.tasksCompleted++;
            // Update average response time (simplified calculation)
            const currentAvg = newStats.averageResponseTime;
            const newTime = 2000; // Placeholder - would be actual execution time
            newStats.averageResponseTime = currentAvg === 0
                ? newTime
                : (currentAvg + newTime) / 2;
        } else {
            newStats.errorCount++;
        }

        this.agentManager.updateAgentStats(agentId, newStats);
    }

    /**
     * Get integration statistics
     */
    getStats(): {
        workerPool: ReturnType<WorkerPool['getStats']>;
        processingTasks: number;
        isEnabled: boolean;
        webWorkerSupported: boolean;
    } {
        return {
            workerPool: this.workerPool.getStats(),
            processingTasks: this.processingTasks.size,
            isEnabled: this.isEnabled,
            webWorkerSupported: this.isWebWorkerSupported()
        };
    }

    /**
     * Get detailed worker information
     */
    getWorkerInfo(): ReturnType<WorkerPool['getWorkerInfo']> {
        return this.workerPool.getWorkerInfo();
    }

    /**
     * Enable or disable Web Worker execution
     */
    setEnabled(enabled: boolean): void {
        this.isEnabled = enabled && this.isWebWorkerSupported();
    }

    /**
     * Check if Web Workers are supported in the current environment
     */
    private isWebWorkerSupported(): boolean {
        return typeof Worker !== 'undefined' && typeof window !== 'undefined';
    }

    /**
     * Shutdown the integration and clean up resources
     */
    async shutdown(): Promise<void> {
        this.isEnabled = false;
        await this.workerPool.shutdown();
        this.processingTasks.clear();
    }

    /**
     * Force process a specific task with workers (for testing/debugging)
     */
    async forceProcessTask(taskId: string): Promise<void> {
        const task = this.taskQueue.getTask(taskId);
        if (!task) {
            throw new WebWorkerIntegrationError(`Task ${taskId} not found`, 'TASK_NOT_FOUND');
        }

        if (task.status !== 'pending') {
            throw new WebWorkerIntegrationError(`Task ${taskId} is not in pending status`, 'INVALID_TASK_STATUS');
        }

        const availableAgents = this.agentManager.getAvailableAgents();
        if (availableAgents.length === 0) {
            throw new WebWorkerIntegrationError('No available agents', 'NO_AVAILABLE_AGENTS');
        }

        await this.executeTaskInWorker(task, availableAgents[0]);
    }
}