/**
 * Task Queue Engine Tests
 */

import { TaskQueueEngine, TaskQueueError } from '../src/services/taskQueue';
import { UnifiedStorageManager } from '../src/services/storageManager';
import { AgentManager } from '../src/services/agentManager';
import { Task, /* TaskStatus */ } from '../src/types/task';

// Mock storage manager
const mockStorageManager = {
    getTasks: jest.fn().mockResolvedValue([]),
    saveTask: jest.fn().mockResolvedValue(undefined),
    initialize: jest.fn().mockResolvedValue(undefined)
} as unknown as UnifiedStorageManager;

// Mock agent manager
const mockAgentManager = {
    getAvailableAgents: jest.fn().mockReturnValue([]),
    assignTask: jest.fn().mockResolvedValue(undefined),
    getAllAgents: jest.fn().mockReturnValue([]),
    updateAgentStatus: jest.fn()
} as unknown as AgentManager;

describe('TaskQueueEngine', () => {
    let taskQueue: TaskQueueEngine;

    beforeEach(() => {
        jest.clearAllMocks();
        taskQueue = new TaskQueueEngine(mockStorageManager, mockAgentManager);
        // Stop automatic processing for tests
        taskQueue.stopProcessing();
    });

    afterEach(() => {
        taskQueue.destroy();
    });

    describe('enqueue', () => {
        it('should add a task to the queue', () => {
            const task: Task = {
                id: 'test-task-1',
                type: 'simple',
                priority: 1,
                prompt: 'Test prompt',
                dependencies: [],
                status: 'pending',
                createdAt: new Date(),
                retryCount: 0
            };

            taskQueue.enqueue(task);

            const tasks = taskQueue.getTasks();
            expect(tasks).toHaveLength(1);
            expect(tasks[0].id).toBe('test-task-1');
        });

        it('should set default values for missing fields', () => {
            const task: Partial<Task> = {
                id: 'test-task-2',
                type: 'simple',
                priority: 1,
                prompt: 'Test prompt',
                dependencies: []
            };

            taskQueue.enqueue(task as Task);

            const storedTask = taskQueue.getTask('test-task-2');
            expect(storedTask?.status).toBe('pending');
            expect(storedTask?.retryCount).toBe(0);
            expect(storedTask?.createdAt).toBeInstanceOf(Date);
        });

        it('should throw error for task without ID', () => {
            const task = {
                type: 'simple',
                priority: 1,
                prompt: 'Test prompt',
                dependencies: []
            } as Task;

            expect(() => taskQueue.enqueue(task)).toThrow(TaskQueueError);
        });
    });

    describe('getNextTask', () => {
        it('should return null when queue is empty', () => {
            const nextTask = taskQueue.getNextTask();
            expect(nextTask).toBeNull();
        });

        it('should return highest priority task', () => {
            const lowPriorityTask: Task = {
                id: 'low-priority',
                type: 'simple',
                priority: 1,
                prompt: 'Low priority',
                dependencies: [],
                status: 'pending',
                createdAt: new Date(),
                retryCount: 0
            };

            const highPriorityTask: Task = {
                id: 'high-priority',
                type: 'simple',
                priority: 5,
                prompt: 'High priority',
                dependencies: [],
                status: 'pending',
                createdAt: new Date(),
                retryCount: 0
            };

            taskQueue.enqueue(lowPriorityTask);
            taskQueue.enqueue(highPriorityTask);

            const nextTask = taskQueue.getNextTask();
            expect(nextTask?.id).toBe('high-priority');
        });

        it('should return older task when priorities are equal', () => {
            const olderTask: Task = {
                id: 'older-task',
                type: 'simple',
                priority: 3,
                prompt: 'Older task',
                dependencies: [],
                status: 'pending',
                createdAt: new Date(Date.now() - 1000), // 1 second ago
                retryCount: 0
            };

            const newerTask: Task = {
                id: 'newer-task',
                type: 'simple',
                priority: 3,
                prompt: 'Newer task',
                dependencies: [],
                status: 'pending',
                createdAt: new Date(),
                retryCount: 0
            };

            taskQueue.enqueue(newerTask);
            taskQueue.enqueue(olderTask);

            const nextTask = taskQueue.getNextTask();
            expect(nextTask?.id).toBe('older-task');
        });

        it('should only return pending tasks', () => {
            const pendingTask: Task = {
                id: 'pending-task',
                type: 'simple',
                priority: 1,
                prompt: 'Pending task',
                dependencies: [],
                status: 'pending',
                createdAt: new Date(),
                retryCount: 0
            };

            const runningTask: Task = {
                id: 'running-task',
                type: 'simple',
                priority: 5,
                prompt: 'Running task',
                dependencies: [],
                status: 'running',
                createdAt: new Date(),
                retryCount: 0
            };

            taskQueue.enqueue(pendingTask);
            taskQueue.enqueue(runningTask);

            const nextTask = taskQueue.getNextTask();
            expect(nextTask?.id).toBe('pending-task');
        });
    });

    describe('updateTaskStatus', () => {
        it('should update task status and timestamps', () => {
            const task: Task = {
                id: 'test-task',
                type: 'simple',
                priority: 1,
                prompt: 'Test task',
                dependencies: [],
                status: 'pending',
                createdAt: new Date(),
                retryCount: 0
            };

            taskQueue.enqueue(task);
            taskQueue.updateTaskStatus('test-task', 'running');

            const updatedTask = taskQueue.getTask('test-task');
            expect(updatedTask?.status).toBe('running');
            expect(updatedTask?.startedAt).toBeInstanceOf(Date);
        });

        it('should set completion timestamp when task completes', () => {
            const task: Task = {
                id: 'test-task',
                type: 'simple',
                priority: 1,
                prompt: 'Test task',
                dependencies: [],
                status: 'running',
                createdAt: new Date(),
                startedAt: new Date(),
                retryCount: 0
            };

            taskQueue.enqueue(task);
            taskQueue.updateTaskStatus('test-task', 'completed');

            const updatedTask = taskQueue.getTask('test-task');
            expect(updatedTask?.status).toBe('completed');
            expect(updatedTask?.completedAt).toBeInstanceOf(Date);
        });

        it('should throw error for non-existent task', () => {
            expect(() => taskQueue.updateTaskStatus('non-existent', 'running'))
                .toThrow(TaskQueueError);
        });
    });

    describe('retryTask', () => {
        it('should increment retry count and reset status', () => {
            const task: Task = {
                id: 'retry-task',
                type: 'simple',
                priority: 1,
                prompt: 'Retry task',
                dependencies: [],
                status: 'failed',
                createdAt: new Date(),
                retryCount: 1,
                error: 'Previous error'
            };

            taskQueue.enqueue(task);
            taskQueue.retryTask('retry-task');

            const retriedTask = taskQueue.getTask('retry-task');
            expect(retriedTask?.retryCount).toBe(2);
            expect(retriedTask?.status).toBe('pending');
            expect(retriedTask?.error).toBeUndefined();
        });

        it('should throw error when retry limit exceeded', () => {
            const task: Task = {
                id: 'max-retry-task',
                type: 'simple',
                priority: 1,
                prompt: 'Max retry task',
                dependencies: [],
                status: 'failed',
                createdAt: new Date(),
                retryCount: 3 // Already at max retries
            };

            taskQueue.enqueue(task);

            expect(() => taskQueue.retryTask('max-retry-task'))
                .toThrow(TaskQueueError);
        });
    });

    describe('getQueueStats', () => {
        it('should return correct statistics', () => {
            const tasks: Task[] = [
                {
                    id: 'pending-1',
                    type: 'simple',
                    priority: 1,
                    prompt: 'Pending 1',
                    dependencies: [],
                    status: 'pending',
                    createdAt: new Date(),
                    retryCount: 0
                },
                {
                    id: 'running-1',
                    type: 'simple',
                    priority: 1,
                    prompt: 'Running 1',
                    dependencies: [],
                    status: 'running',
                    createdAt: new Date(),
                    retryCount: 0
                },
                {
                    id: 'completed-1',
                    type: 'simple',
                    priority: 1,
                    prompt: 'Completed 1',
                    dependencies: [],
                    status: 'completed',
                    createdAt: new Date(),
                    retryCount: 0
                }
            ];

            tasks.forEach(task => taskQueue.enqueue(task));

            const stats = taskQueue.getQueueStats();
            expect(stats.total).toBe(3);
            expect(stats.pending).toBe(1);
            expect(stats.running).toBe(1);
            expect(stats.completed).toBe(1);
            expect(stats.failed).toBe(0);
        });
    });

    describe('generateTaskId', () => {
        it('should generate unique task IDs', () => {
            const id1 = taskQueue.generateTaskId();
            const id2 = taskQueue.generateTaskId();

            expect(id1).not.toBe(id2);
            expect(id1).toMatch(/^task_[a-z0-9]+_[a-z0-9]+$/);
            expect(id2).toMatch(/^task_[a-z0-9]+_[a-z0-9]+$/);
        });
    });
});