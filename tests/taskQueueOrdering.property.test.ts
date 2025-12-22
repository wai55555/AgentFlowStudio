/**
 * Property-Based Tests for Task Queue Ordering
 * Feature: ai-agent-orchestration, Property 5: Task queue ordering
 * Validates: Requirements 2.1, 2.2
 */

import * as fc from 'fast-check';
import { TaskQueueEngine } from '../src/services/taskQueue';
import { UnifiedStorageManager } from '../src/services/storageManager';
import { AgentManager } from '../src/services/agentManager';
import { Task, TaskType } from '../src/types/task';

// Mock the storage manager
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

describe('Property Tests: Task Queue Ordering', () => {
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

    /**
     * Property 5: Task queue ordering
     * For any set of tasks with different priorities, the task queue should assign tasks to agents in priority order
     * Validates: Requirements 2.1, 2.2
     */
    test('Property 5: Task queue ordering', async () => {
        await fc.assert(
            fc.asyncProperty(
                // Generate an array of tasks with different priorities and timestamps
                fc.array(
                    fc.record({
                        priority: fc.integer({ min: 1, max: 10 }),
                        prompt: fc.string({ minLength: 1, maxLength: 100 }),
                        type: fc.constantFrom('simple' as TaskType, 'workflow' as TaskType),
                        // Generate timestamps with some variation to test timestamp ordering
                        timestampOffset: fc.integer({ min: 0, max: 10000 }) // milliseconds offset
                    }),
                    { minLength: 2, max: 20 }
                ),
                async (taskSpecs) => {
                    // Create tasks with the generated specifications
                    const tasks: Task[] = [];
                    const baseTime = Date.now();

                    for (let i = 0; i < taskSpecs.length; i++) {
                        const spec = taskSpecs[i];
                        const task: Task = {
                            id: `task_${i}_${Math.random().toString(36).substring(2, 8)}`,
                            type: spec.type,
                            priority: spec.priority,
                            prompt: spec.prompt,
                            dependencies: [],
                            status: 'pending',
                            createdAt: new Date(baseTime + spec.timestampOffset),
                            retryCount: 0
                        };
                        tasks.push(task);
                    }

                    // Enqueue all tasks
                    for (const task of tasks) {
                        taskQueue.enqueue(task);
                    }

                    // Get tasks in the order they would be processed
                    const processedOrder: Task[] = [];
                    let nextTask = taskQueue.getNextTask();

                    while (nextTask !== null) {
                        processedOrder.push(nextTask);
                        // Remove the task from queue to get the next one
                        taskQueue.dequeue();
                        nextTask = taskQueue.getNextTask();
                    }

                    // Verify that tasks are ordered correctly
                    for (let i = 0; i < processedOrder.length - 1; i++) {
                        const currentTask = processedOrder[i];
                        const nextTask = processedOrder[i + 1];

                        // Higher priority tasks should come first
                        if (currentTask.priority !== nextTask.priority) {
                            expect(currentTask.priority).toBeGreaterThanOrEqual(nextTask.priority);
                        } else {
                            // For equal priorities, older tasks (earlier timestamp) should come first
                            expect(currentTask.createdAt.getTime()).toBeLessThanOrEqual(nextTask.createdAt.getTime());
                        }
                    }

                    // Verify that all tasks were processed in the correct order
                    expect(processedOrder.length).toBe(tasks.length);

                    // Verify that the ordering matches the expected sort
                    const expectedOrder = [...tasks].sort((a, b) => {
                        if (a.priority !== b.priority) {
                            return b.priority - a.priority; // Higher priority first
                        }
                        return a.createdAt.getTime() - b.createdAt.getTime(); // Older first for same priority
                    });

                    for (let i = 0; i < expectedOrder.length; i++) {
                        expect(processedOrder[i].id).toBe(expectedOrder[i].id);
                    }
                }
            ),
            { numRuns: 100 } // Run 100 iterations as specified in design document
        );
    });

    /**
     * Additional property test: Priority ordering with same timestamps
     * Verifies that priority takes precedence over timestamp when timestamps are identical
     */
    test('Property: Priority ordering with identical timestamps', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(
                    fc.integer({ min: 1, max: 10 }),
                    { minLength: 2, maxLength: 10 }
                ),
                async (priorities) => {
                    const sameTimestamp = new Date();
                    const tasks: Task[] = [];

                    // Create tasks with same timestamp but different priorities
                    for (let i = 0; i < priorities.length; i++) {
                        const task: Task = {
                            id: `task_${i}`,
                            type: 'simple',
                            priority: priorities[i],
                            prompt: `Task with priority ${priorities[i]}`,
                            dependencies: [],
                            status: 'pending',
                            createdAt: sameTimestamp,
                            retryCount: 0
                        };
                        tasks.push(task);
                        taskQueue.enqueue(task);
                    }

                    // Get tasks in processing order
                    const processedOrder: Task[] = [];
                    let nextTask = taskQueue.getNextTask();

                    while (nextTask !== null) {
                        processedOrder.push(nextTask);
                        taskQueue.dequeue();
                        nextTask = taskQueue.getNextTask();
                    }

                    // Verify priority ordering (higher priority first)
                    for (let i = 0; i < processedOrder.length - 1; i++) {
                        expect(processedOrder[i].priority).toBeGreaterThanOrEqual(processedOrder[i + 1].priority);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property test: Timestamp ordering with same priorities
     * Verifies that timestamp ordering works correctly when priorities are identical
     */
    test('Property: Timestamp ordering with identical priorities', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(
                    fc.integer({ min: 0, max: 5000 }), // timestamp offsets in milliseconds
                    { minLength: 2, maxLength: 10 }
                ),
                fc.integer({ min: 1, max: 5 }), // same priority for all tasks
                async (timestampOffsets, priority) => {
                    const baseTime = Date.now();
                    const tasks: Task[] = [];

                    // Create tasks with same priority but different timestamps
                    for (let i = 0; i < timestampOffsets.length; i++) {
                        const task: Task = {
                            id: `task_${i}`,
                            type: 'simple',
                            priority: priority,
                            prompt: `Task ${i}`,
                            dependencies: [],
                            status: 'pending',
                            createdAt: new Date(baseTime + timestampOffsets[i]),
                            retryCount: 0
                        };
                        tasks.push(task);
                        taskQueue.enqueue(task);
                    }

                    // Get tasks in processing order
                    const processedOrder: Task[] = [];
                    let nextTask = taskQueue.getNextTask();

                    while (nextTask !== null) {
                        processedOrder.push(nextTask);
                        taskQueue.dequeue();
                        nextTask = taskQueue.getNextTask();
                    }

                    // Verify timestamp ordering (older first)
                    for (let i = 0; i < processedOrder.length - 1; i++) {
                        expect(processedOrder[i].createdAt.getTime()).toBeLessThanOrEqual(processedOrder[i + 1].createdAt.getTime());
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property test: Only pending tasks are considered for ordering
     * Verifies that non-pending tasks are excluded from the ordering logic
     */
    test('Property: Only pending tasks are considered for ordering', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(
                    fc.record({
                        priority: fc.integer({ min: 1, max: 10 }),
                        status: fc.constantFrom('pending', 'running', 'completed', 'failed')
                    }),
                    { minLength: 3, maxLength: 15 }
                ),
                async (taskSpecs) => {
                    const tasks: Task[] = [];

                    // Create tasks with various statuses
                    for (let i = 0; i < taskSpecs.length; i++) {
                        const spec = taskSpecs[i];
                        const task: Task = {
                            id: `task_${i}`,
                            type: 'simple',
                            priority: spec.priority,
                            prompt: `Task ${i}`,
                            dependencies: [],
                            status: spec.status as any,
                            createdAt: new Date(Date.now() + i * 100), // Ensure different timestamps
                            retryCount: 0
                        };
                        tasks.push(task);

                        // Only enqueue tasks that are pending initially
                        if (spec.status === 'pending') {
                            taskQueue.enqueue(task);
                        } else {
                            // For non-pending tasks, enqueue them first then update status
                            taskQueue.enqueue(task);
                            taskQueue.updateTaskStatus(task.id, spec.status as any);
                        }
                    }

                    // Get the next task (should only be pending tasks)
                    const nextTask = taskQueue.getNextTask();

                    if (nextTask !== null) {
                        // Verify that the returned task is pending
                        expect(nextTask.status).toBe('pending');

                        // Verify that it's a pending task from the queue
                        const queueTasks = taskQueue.getTasks();
                        const pendingQueueTasks = queueTasks.filter(t => t.status === 'pending');

                        // The returned task should be one of the pending tasks in the queue
                        expect(pendingQueueTasks.some(t => t.id === nextTask.id)).toBe(true);
                    } else {
                        // If no task returned, verify there are no pending tasks in the queue
                        const queueTasks = taskQueue.getTasks();
                        const pendingQueueTasks = queueTasks.filter(t => t.status === 'pending');
                        expect(pendingQueueTasks.length).toBe(0);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });
});