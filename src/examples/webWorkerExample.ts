/**
 * Web Worker Integration Example
 * Demonstrates how to use the Web Worker integration with the AI Agent Orchestration Platform
 */

import { UnifiedStorageManager } from '../services/storageManager';
import { AgentManager } from '../services/agentManager';
import { TaskQueueEngine } from '../services/taskQueue';
import { WebWorkerIntegration } from '../services/webWorkerIntegration';
import { Task } from '../types/task';

/**
 * Example usage of Web Worker integration
 */
export class WebWorkerExample {
    private storageManager: UnifiedStorageManager;
    private agentManager: AgentManager;
    private taskQueue: TaskQueueEngine;
    private webWorkerIntegration: WebWorkerIntegration;

    constructor() {
        // Initialize core services
        this.storageManager = new UnifiedStorageManager();
        this.agentManager = new AgentManager(this.storageManager);
        this.taskQueue = new TaskQueueEngine(this.storageManager, this.agentManager);

        // Initialize Web Worker integration
        this.webWorkerIntegration = new WebWorkerIntegration(
            this.taskQueue,
            this.agentManager,
            {
                workerPool: {
                    maxWorkers: 4,
                    minWorkers: 2,
                    workerTimeout: 30000,
                    healthCheckInterval: 10000
                },
                enableParallelExecution: true,
                fallbackToMainThread: true
            }
        );
    }

    /**
     * Run a complete example workflow
     */
    async runExample(): Promise<void> {
        console.log('Starting Web Worker Integration Example...');

        try {
            // Step 1: Create some agents
            console.log('Creating agents...');
            const agent1 = await this.agentManager.createAgent({
                name: 'Content Writer',
                role: 'writer',
                promptTemplate: 'You are a professional content writer. {task}',
                maxTokens: 500,
                temperature: 0.7,
                model: 'xiaomi/mimo-v2-flash:free'
            });

            const agent2 = await this.agentManager.createAgent({
                name: 'Code Reviewer',
                role: 'reviewer',
                promptTemplate: 'You are a senior code reviewer. {task}',
                maxTokens: 800,
                temperature: 0.3,
                model: 'xiaomi/mimo-v2-flash:free'
            });

            console.log(`Created agents: ${agent1.name} (${agent1.id}), ${agent2.name} (${agent2.id})`);

            // Step 2: Create some tasks
            console.log('Creating tasks...');
            const tasks: Task[] = [
                {
                    id: this.taskQueue.generateTaskId(),
                    type: 'simple',
                    priority: 3,
                    prompt: 'Write a brief introduction about artificial intelligence',
                    dependencies: [],
                    status: 'pending',
                    createdAt: new Date(),
                    retryCount: 0
                },
                {
                    id: this.taskQueue.generateTaskId(),
                    type: 'simple',
                    priority: 2,
                    prompt: 'Review this JavaScript function for potential improvements: function add(a, b) { return a + b; }',
                    dependencies: [],
                    status: 'pending',
                    createdAt: new Date(),
                    retryCount: 0
                },
                {
                    id: this.taskQueue.generateTaskId(),
                    type: 'simple',
                    priority: 1,
                    prompt: 'Explain the benefits of using Web Workers in web applications',
                    dependencies: [],
                    status: 'pending',
                    createdAt: new Date(),
                    retryCount: 0
                }
            ];

            // Add tasks to queue
            tasks.forEach(task => {
                this.taskQueue.enqueue(task);
                console.log(`Enqueued task: ${task.id} (Priority: ${task.priority})`);
            });

            // Step 3: Monitor execution
            console.log('Monitoring task execution...');
            await this.monitorExecution(30000); // Monitor for 30 seconds

            // Step 4: Show results
            console.log('Execution completed. Final statistics:');
            this.showStatistics();

        } catch (error) {
            console.error('Example execution failed:', error);
        }
    }

    /**
     * Monitor task execution progress
     */
    private async monitorExecution(timeoutMs: number): Promise<void> {
        const startTime = Date.now();
        const checkInterval = 2000; // Check every 2 seconds

        return new Promise((resolve) => {
            const monitor = setInterval(() => {
                const elapsed = Date.now() - startTime;

                // Show current status
                const queueStats = this.taskQueue.getQueueStats();
                const workerStats = this.webWorkerIntegration.getStats();

                console.log(`[${Math.floor(elapsed / 1000)}s] Queue: ${queueStats.pending} pending, ${queueStats.running} running, ${queueStats.completed} completed, ${queueStats.failed} failed`);
                console.log(`[${Math.floor(elapsed / 1000)}s] Workers: ${workerStats.workerPool.totalWorkers} total, ${workerStats.workerPool.readyWorkers} ready, ${workerStats.workerPool.busyWorkers} busy`);

                // Check if all tasks are done or timeout reached
                if (queueStats.pending === 0 && queueStats.running === 0) {
                    console.log('All tasks completed!');
                    clearInterval(monitor);
                    resolve();
                } else if (elapsed >= timeoutMs) {
                    console.log('Monitoring timeout reached');
                    clearInterval(monitor);
                    resolve();
                }
            }, checkInterval);
        });
    }

    /**
     * Show final statistics
     */
    private showStatistics(): void {
        const queueStats = this.taskQueue.getQueueStats();
        const workerStats = this.webWorkerIntegration.getStats();
        const workerInfo = this.webWorkerIntegration.getWorkerInfo();

        console.log('\n=== Final Statistics ===');
        console.log('Task Queue:');
        console.log(`  Total: ${queueStats.total}`);
        console.log(`  Completed: ${queueStats.completed}`);
        console.log(`  Failed: ${queueStats.failed}`);
        console.log(`  Pending: ${queueStats.pending}`);

        console.log('\nWorker Pool:');
        console.log(`  Total Workers: ${workerStats.workerPool.totalWorkers}`);
        console.log(`  Tasks Completed: ${workerStats.workerPool.totalTasksCompleted}`);
        console.log(`  Total Errors: ${workerStats.workerPool.totalErrors}`);
        console.log(`  Web Worker Support: ${workerStats.webWorkerSupported ? 'Yes' : 'No'}`);

        console.log('\nWorker Details:');
        workerInfo.forEach((worker, index) => {
            console.log(`  Worker ${index + 1}: ${worker.tasksCompleted} tasks, ${worker.errorCount} errors`);
        });

        console.log('\nAgent Status:');
        const agents = this.agentManager.getAllAgents();
        agents.forEach(agent => {
            console.log(`  ${agent.name}: ${agent.stats.tasksCompleted} tasks, ${agent.stats.errorCount} errors, ${agent.status}`);
        });
    }

    /**
     * Cleanup resources
     */
    async cleanup(): Promise<void> {
        console.log('Cleaning up resources...');
        await this.webWorkerIntegration.shutdown();
        this.taskQueue.destroy();
    }
}

/**
 * Run the example if this file is executed directly
 */
if (typeof window !== 'undefined') {
    // Browser environment - can be called from console
    (window as any).WebWorkerExample = WebWorkerExample;
    console.log('WebWorkerExample class is available in the global scope');
    console.log('Usage: const example = new WebWorkerExample(); await example.runExample();');
}