/**
 * Task Queue Engine
 * Manages priority-based task queuing, assignment, and execution tracking
 */

import { Task, TaskStatus, TaskQueue as ITaskQueue } from '../types/task';
import { Agent } from '../types/agent';
import { UnifiedStorageManager } from './storageManager';
import { AgentManager } from './agentManager';

export class TaskQueueError extends Error {
    constructor(message: string, public code?: string) {
        super(message);
        this.name = 'TaskQueueError';
    }
}

export class TaskQueueEngine implements ITaskQueue {
    private tasks: Map<string, Task> = new Map();
    private storageManager: UnifiedStorageManager;
    private agentManager: AgentManager;
    private maxRetries: number = 3;
    private processingInterval: number | null = null;

    constructor(storageManager: UnifiedStorageManager, agentManager: AgentManager) {
        this.storageManager = storageManager;
        this.agentManager = agentManager;
        this.loadTasksFromStorage();
        this.startProcessing();
    }

    /**
     * Add a task to the queue with priority and timestamp
     */
    enqueue(task: Task): void {
        // Ensure task has required fields
        if (!task.id) {
            throw new TaskQueueError('Task must have an ID', 'INVALID_TASK');
        }

        // Set creation timestamp if not provided
        if (!task.createdAt) {
            task.createdAt = new Date();
        }

        // Initialize retry count if not set
        if (task.retryCount === undefined) {
            task.retryCount = 0;
        }

        // Set initial status if not provided
        if (!task.status) {
            task.status = 'pending';
        }

        // Add to queue
        this.tasks.set(task.id, task);

        // Persist to storage
        this.saveTaskToStorage(task).catch(error => {
            console.error('Failed to save task to storage:', error);
        });
    }

    /**
     * Remove and return the highest priority task
     */
    dequeue(): Task | null {
        const nextTask = this.getNextTask();
        if (nextTask) {
            this.tasks.delete(nextTask.id);
            // Remove from storage
            this.removeTaskFromStorage(nextTask.id).catch(error => {
                console.error('Failed to remove task from storage:', error);
            });
        }
        return nextTask;
    }

    /**
     * Get the next task to be processed based on priority and timestamp
     */
    getNextTask(): Task | null {
        const pendingTasks = Array.from(this.tasks.values())
            .filter(task => task.status === 'pending');

        if (pendingTasks.length === 0) {
            return null;
        }

        // Sort by priority (higher number = higher priority), then by timestamp (older first)
        pendingTasks.sort((a, b) => {
            if (a.priority !== b.priority) {
                return b.priority - a.priority; // Higher priority first
            }
            return a.createdAt.getTime() - b.createdAt.getTime(); // Older first
        });

        return pendingTasks[0];
    }

    /**
     * Update task status and persist changes
     */
    updateTaskStatus(taskId: string, status: TaskStatus): void {
        const task = this.tasks.get(taskId);
        if (!task) {
            throw new TaskQueueError(`Task with ID ${taskId} not found`, 'TASK_NOT_FOUND');
        }

        const oldStatus = task.status;
        task.status = status;

        // Update timestamps based on status changes
        if (status === 'running' && oldStatus === 'pending') {
            task.startedAt = new Date();
        } else if ((status === 'completed' || status === 'failed') && oldStatus === 'running') {
            task.completedAt = new Date();
        }

        // Persist changes
        this.saveTaskToStorage(task).catch(error => {
            console.error('Failed to save task status update:', error);
        });
    }

    /**
     * Retry a failed task if retry limit not exceeded
     */
    retryTask(taskId: string): void {
        const task = this.tasks.get(taskId);
        if (!task) {
            throw new TaskQueueError(`Task with ID ${taskId} not found`, 'TASK_NOT_FOUND');
        }

        if (task.retryCount >= this.maxRetries) {
            throw new TaskQueueError(
                `Task ${taskId} has exceeded maximum retry limit of ${this.maxRetries}`,
                'RETRY_LIMIT_EXCEEDED'
            );
        }

        // Increment retry count
        task.retryCount++;

        // Reset status to pending
        task.status = 'pending';

        // Clear previous error and timing info
        task.error = undefined;
        task.startedAt = undefined;
        task.completedAt = undefined;

        // Persist changes
        this.saveTaskToStorage(task).catch(error => {
            console.error('Failed to save task retry:', error);
        });
    }

    /**
     * Get all tasks in the queue
     */
    getTasks(): Task[] {
        return Array.from(this.tasks.values());
    }

    /**
     * Get tasks filtered by status
     */
    getTasksByStatus(status: TaskStatus): Task[] {
        return Array.from(this.tasks.values()).filter(task => task.status === status);
    }

    /**
     * Get task by ID
     */
    getTask(taskId: string): Task | undefined {
        return this.tasks.get(taskId);
    }

    /**
     * Remove a task from the queue
     */
    removeTask(taskId: string): boolean {
        const removed = this.tasks.delete(taskId);
        if (removed) {
            this.removeTaskFromStorage(taskId).catch(error => {
                console.error('Failed to remove task from storage:', error);
            });
        }
        return removed;
    }

    /**
     * Get queue statistics
     */
    getQueueStats(): {
        total: number;
        pending: number;
        running: number;
        completed: number;
        failed: number;
    } {
        const tasks = Array.from(this.tasks.values());
        return {
            total: tasks.length,
            pending: tasks.filter(t => t.status === 'pending').length,
            running: tasks.filter(t => t.status === 'running').length,
            completed: tasks.filter(t => t.status === 'completed').length,
            failed: tasks.filter(t => t.status === 'failed').length
        };
    }

    /**
     * Process the queue by assigning tasks to available agents
     */
    private async processQueue(): Promise<void> {
        try {
            const availableAgents = this.agentManager.getAvailableAgents();
            if (availableAgents.length === 0) {
                return; // No agents available
            }

            const nextTask = this.getNextTask();
            if (!nextTask) {
                return; // No pending tasks
            }

            // Assign task to the first available agent
            const agent = availableAgents[0];

            try {
                await this.agentManager.assignTask(agent.id, nextTask);
                this.updateTaskStatus(nextTask.id, 'running');
            } catch (error) {
                console.error(`Failed to assign task ${nextTask.id} to agent ${agent.id}:`, error);

                // If assignment fails, check if we should retry
                if (nextTask.retryCount < this.maxRetries) {
                    this.retryTask(nextTask.id);
                } else {
                    // Mark as failed if retry limit exceeded
                    nextTask.status = 'failed';
                    nextTask.error = error instanceof Error ? error.message : 'Unknown error';
                    this.updateTaskStatus(nextTask.id, 'failed');
                }
            }
        } catch (error) {
            console.error('Error processing task queue:', error);
        }
    }

    /**
     * Start automatic queue processing
     */
    private startProcessing(): void {
        if (this.processingInterval !== null) {
            return; // Already processing
        }

        // Process queue every 1 second
        this.processingInterval = window.setInterval(() => {
            this.processQueue();
        }, 1000);
    }

    /**
     * Stop automatic queue processing
     */
    stopProcessing(): void {
        if (this.processingInterval !== null) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
        }
    }

    /**
     * Handle task completion (called by external systems)
     */
    async completeTask(taskId: string, result?: string, error?: string): Promise<void> {
        const task = this.tasks.get(taskId);
        if (!task) {
            throw new TaskQueueError(`Task with ID ${taskId} not found`, 'TASK_NOT_FOUND');
        }

        if (error) {
            task.error = error;

            // Check if we should retry
            if (task.retryCount < this.maxRetries) {
                this.retryTask(taskId);
            } else {
                this.updateTaskStatus(taskId, 'failed');
            }
        } else {
            task.result = result;
            this.updateTaskStatus(taskId, 'completed');
        }

        // Update agent status back to idle
        const runningAgents = this.agentManager.getAllAgents()
            .filter(agent => agent.status === 'busy');

        for (const agent of runningAgents) {
            // This is a simplified approach - in a real system, we'd track which agent is handling which task
            this.agentManager.updateAgentStatus(agent.id, 'idle');
        }
    }

    /**
     * Generate a unique task ID
     */
    generateTaskId(): string {
        const timestamp = Date.now().toString(36);
        const randomPart = Math.random().toString(36).substring(2, 8);
        const id = `task_${timestamp}_${randomPart}`;

        // Ensure uniqueness
        if (this.tasks.has(id)) {
            return this.generateTaskId();
        }

        return id;
    }

    /**
     * Load tasks from storage on initialization
     */
    private async loadTasksFromStorage(): Promise<void> {
        try {
            const storedTasks = await this.storageManager.getTasks();
            if (storedTasks && Array.isArray(storedTasks)) {
                this.tasks.clear();
                storedTasks.forEach(task => {
                    // Ensure dates are properly deserialized
                    if (typeof task.createdAt === 'string') {
                        task.createdAt = new Date(task.createdAt);
                    }
                    if (task.startedAt && typeof task.startedAt === 'string') {
                        task.startedAt = new Date(task.startedAt);
                    }
                    if (task.completedAt && typeof task.completedAt === 'string') {
                        task.completedAt = new Date(task.completedAt);
                    }

                    this.tasks.set(task.id, task);
                });
            }
        } catch (error) {
            console.error('Failed to load tasks from storage:', error);
            // Continue with empty task queue
        }
    }

    /**
     * Save a task to storage
     */
    private async saveTaskToStorage(task: Task): Promise<void> {
        try {
            await this.storageManager.saveTask(task);
        } catch (error) {
            console.error('Failed to save task to storage:', error);
            throw new TaskQueueError('Failed to persist task data', 'STORAGE_ERROR');
        }
    }

    /**
     * Remove a task from storage
     */
    private async removeTaskFromStorage(taskId: string): Promise<void> {
        try {
            // Note: The storage manager doesn't have a deleteTask method yet
            // This would need to be implemented in the IndexedDB manager
            console.log(`Task ${taskId} should be removed from storage`);
        } catch (error) {
            console.error('Failed to remove task from storage:', error);
        }
    }

    /**
     * Cleanup resources
     */
    destroy(): void {
        this.stopProcessing();
        this.tasks.clear();
    }
}