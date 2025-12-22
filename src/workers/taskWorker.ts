/**
 * Task Worker - Web Worker for parallel task execution
 * Handles AI agent task processing in a separate thread
 */

import { Task } from '../types/task';
import { Agent } from '../types/agent';

// Worker message types
export interface WorkerMessage {
    type: 'EXECUTE_TASK' | 'TASK_RESULT' | 'TASK_ERROR' | 'WORKER_READY' | 'PING' | 'PONG';
    payload?: any;
    taskId?: string;
    workerId?: string;
    error?: string;
}

// OpenRouter API configuration
interface APIConfig {
    apiKey?: string;
    baseUrl: string;
    model: string;
    maxTokens: number;
    temperature: number;
}

class TaskWorker {
    private workerId: string;
    private isReady: boolean = false;
    private currentTask: Task | null = null;
    private apiConfig: APIConfig = {
        baseUrl: 'https://openrouter.ai/api/v1',
        model: 'xiaomi/mimo-v2-flash:free',
        maxTokens: 1000,
        temperature: 0.7
    };

    constructor() {
        this.workerId = `worker_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        this.initialize();
    }

    private initialize(): void {
        // Listen for messages from main thread
        self.addEventListener('message', this.handleMessage.bind(this));

        // Signal that worker is ready
        this.isReady = true;
        this.postMessage({
            type: 'WORKER_READY',
            workerId: this.workerId
        });
    }

    private handleMessage(event: MessageEvent<WorkerMessage>): void {
        const { type, payload, /* taskId */ } = event.data;

        switch (type) {
            case 'EXECUTE_TASK':
                this.executeTask(payload.task, payload.agent);
                break;
            case 'PING':
                this.postMessage({ type: 'PONG', workerId: this.workerId });
                break;
            default:
                console.warn(`Unknown message type: ${type}`);
        }
    }

    private async executeTask(task: Task, agent: Agent): Promise<void> {
        if (!this.isReady) {
            this.postError(task.id, 'Worker not ready');
            return;
        }

        if (this.currentTask) {
            this.postError(task.id, 'Worker is already processing a task');
            return;
        }

        this.currentTask = task;

        try {
            // Validate task
            if (!task.prompt || task.prompt.trim() === '') {
                throw new Error('Task prompt is empty or invalid');
            }

            // Execute the task using OpenRouter API
            const result = await this.callOpenRouterAPI(task, agent);

            // Post successful result
            this.postMessage({
                type: 'TASK_RESULT',
                taskId: task.id,
                payload: {
                    result,
                    completedAt: new Date().toISOString(),
                    workerId: this.workerId
                }
            });

        } catch (error) {
            // Post error result
            this.postError(task.id, error instanceof Error ? error.message : 'Unknown error occurred');
        } finally {
            this.currentTask = null;
        }
    }

    private async callOpenRouterAPI(task: Task, agent: Agent): Promise<string> {
        // Construct the full prompt using agent's template
        const fullPrompt = this.constructPrompt(task.prompt, agent);

        // Prepare API request
        const requestBody = {
            model: agent.config.model || this.apiConfig.model,
            messages: [
                {
                    role: 'user',
                    content: fullPrompt
                }
            ],
            max_tokens: agent.config.maxTokens || this.apiConfig.maxTokens,
            temperature: agent.config.temperature || this.apiConfig.temperature
        };

        // Make API call
        const response = await fetch(`${this.apiConfig.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiConfig.apiKey || ''}`,
                'HTTP-Referer': window.location.origin,
                'X-Title': 'AI Agent Orchestration Platform'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`API request failed: ${response.status} ${response.statusText}. ${errorData.error?.message || ''}`);
        }

        const data = await response.json();

        if (!data.choices || data.choices.length === 0) {
            throw new Error('No response choices returned from API');
        }

        const content = data.choices[0].message?.content;
        if (!content) {
            throw new Error('Empty response content from API');
        }

        return content.trim();
    }

    private constructPrompt(taskPrompt: string, agent: Agent): string {
        // Combine agent's prompt template with the specific task prompt
        const template = agent.promptTemplate || 'You are a helpful AI assistant.';

        // Simple template replacement - in a real system, this could be more sophisticated
        if (template.includes('{task}')) {
            return template.replace('{task}', taskPrompt);
        } else {
            return `${template}\n\nTask: ${taskPrompt}`;
        }
    }

    private postMessage(message: WorkerMessage): void {
        self.postMessage(message);
    }

    private postError(taskId: string, error: string): void {
        this.postMessage({
            type: 'TASK_ERROR',
            taskId,
            error,
            workerId: this.workerId
        });
    }
}

// Initialize the worker
new TaskWorker();