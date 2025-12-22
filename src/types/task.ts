/**
 * Core Task interfaces for the AI Agent Orchestration Platform
 */

export type TaskType = 'simple' | 'workflow';
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Task {
    id: string;
    type: TaskType;
    priority: number;
    prompt: string;
    dependencies: string[];
    status: TaskStatus;
    result?: string;
    error?: string;
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    retryCount: number;
}

export interface TaskQueue {
    enqueue(task: Task): void;
    dequeue(): Task | null;
    getNextTask(): Task | null;
    updateTaskStatus(taskId: string, status: TaskStatus): void;
    retryTask(taskId: string): void;
    getTasks(): Task[];
}