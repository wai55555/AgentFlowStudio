/**
 * Property-Based Tests for Task Retry Mechanism
 * Feature: ai-agent-orchestration, Property 6: Task retry mechanism
 * Validates: Requirements 2.4
 */

import * as fc from 'fast-check';
import { TaskQueueEngine, TaskQueueError } from '../src/services/taskQueue';
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

describe('Property Tests: Task Retry Mechanism', () => {
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
     * Property 6: Task retry mechanism
     * For any failed task, the system should retry up to three times before marking as permanently failed
     * Validates: Requirements 2.4
     */
    test('Property 6: Task retry mechanism', async () => {
        await fc.assert(
            fc.asyncProperty(
                // Generate task specifications
                fc.record({
                    priority: fc.integer({ min: 1, max: 10 }),
                    prompt: fc.string({ minLength: 1, maxLength: 100 }),
                    type: fc.constantFrom('simple' as TaskType, 'workflow' as TaskType),
                    initialRetryCount: fc.integer({ min: 0, max: 2 }) // Start with 0-2 retries already done
                }),
                async (taskSpec) => {
                    // Create a task that can be retried
                    const task: Task = {
                        id: `retry_test_${Math.random().toString(36).substring(2, 8)}`,
                        type: taskSpec.type,
                        priority: taskSpec.priority,
                        prompt: taskSpec.prompt,
                        dependencies: [],
                        status: 'failed',
                        createdAt: new Date(),
                        retryCount: taskSpec.initialRetryCount,
                        error: 'Simulated failure'
                    };

                    // Enqueue the task
                    taskQueue.enqueue(task);

                    // Calculate how many retries should be possible
                    const maxRetries = 3;
                    const remainingRetries = maxRetries - taskSpec.initialRetryCount;

                    if (remainingRetries > 0) {
                        // Task should be retryable
                        for (let i = 0; i < remainingRetries; i++) {
                            const currentRetryCount = taskSpec.initialRetryCount + i;

                            // Verify task can be retried
                            expect(() => taskQueue.retryTask(task.id)).not.toThrow();

                            // Verify retry count incremented
                            const retriedTask = taskQueue.getTask(task.id);
                            expect(retriedTask?.retryCount).toBe(currentRetryCount + 1);

                            // Verify status reset to pending
                            expect(retriedTask?.status).toBe('pending');

                            // Verify error cleared
                            expect(retriedTask?.error).toBeUndefined();

                            // Verify timing fields cleared
                            expect(retriedTask?.startedAt).toBeUndefined();
                            expect(retriedTask?.completedAt).toBeUndefined();

                            // Set back to failed for next iteration (if any)
                            if (i < remainingRetries - 1) {
                                taskQueue.updateTaskStatus(task.id, 'failed');
                                const failedTask = taskQueue.getTask(task.id);
                                if (failedTask) {
                                    failedTask.error = 'Simulated failure';
                                }
                            }
                        }

                        // After all retries are exhausted, further retry attempts should fail
                        const finalTask = taskQueue.getTask(task.id);
                        if (finalTask && finalTask.retryCount >= maxRetries) {
                            expect(() => taskQueue.retryTask(task.id)).toThrow(TaskQueueError);
                            expect(() => taskQueue.retryTask(task.id)).toThrow(/exceeded maximum retry limit/);
                        }
                    } else {
                        // Task has already reached max retries, should not be retryable
                        expect(() => taskQueue.retryTask(task.id)).toThrow(TaskQueueError);
                        expect(() => taskQueue.retryTask(task.id)).toThrow(/exceeded maximum retry limit/);

                        // Verify task state unchanged after failed retry attempt
                        const unchangedTask = taskQueue.getTask(task.id);
                        expect(unchangedTask?.retryCount).toBe(taskSpec.initialRetryCount);
                        expect(unchangedTask?.status).toBe('failed');
                    }
                }
            ),
            { numRuns: 100 } // Run 100 iterations as specified in design document
        );
    });

    /**
     * Property test: Retry count progression
     * Verifies that retry count increments correctly with each retry attempt
     */
    test('Property: Retry count progression', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    priority: fc.integer({ min: 1, max: 10 }),
                    prompt: fc.string({ minLength: 1, maxLength: 50 }),
                    type: fc.constantFrom('simple' as TaskType, 'workflow' as TaskType)
                }),
                async (taskSpec) => {
                    // Create a fresh task with no retries
                    const task: Task = {
                        id: `progression_test_${Math.random().toString(36).substring(2, 8)}`,
                        type: taskSpec.type,
                        priority: taskSpec.priority,
                        prompt: taskSpec.prompt,
                        dependencies: [],
                        status: 'failed',
                        createdAt: new Date(),
                        retryCount: 0,
                        error: 'Initial failure'
                    };

                    taskQueue.enqueue(task);

                    // Perform retries and verify count progression
                    for (let expectedCount = 1; expectedCount <= 3; expectedCount++) {
                        taskQueue.retryTask(task.id);

                        const retriedTask = taskQueue.getTask(task.id);
                        expect(retriedTask?.retryCount).toBe(expectedCount);
                        expect(retriedTask?.status).toBe('pending');

                        // Set back to failed for next retry (except on last iteration)
                        if (expectedCount < 3) {
                            taskQueue.updateTaskStatus(task.id, 'failed');
                            const failedTask = taskQueue.getTask(task.id);
                            if (failedTask) {
                                failedTask.error = `Failure ${expectedCount}`;
                            }
                        }
                    }

                    // Verify that the 4th retry attempt fails
                    expect(() => taskQueue.retryTask(task.id)).toThrow(TaskQueueError);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property test: Retry resets task state
     * Verifies that retrying a task properly resets its state fields
     */
    test('Property: Retry resets task state', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    priority: fc.integer({ min: 1, max: 10 }),
                    prompt: fc.string({ minLength: 1, maxLength: 50 }),
                    type: fc.constantFrom('simple' as TaskType, 'workflow' as TaskType),
                    errorMessage: fc.string({ minLength: 1, maxLength: 100 }),
                    retryCount: fc.integer({ min: 0, max: 2 })
                }),
                async (taskSpec) => {
                    // Create a task with various state fields set
                    const task: Task = {
                        id: `reset_test_${Math.random().toString(36).substring(2, 8)}`,
                        type: taskSpec.type,
                        priority: taskSpec.priority,
                        prompt: taskSpec.prompt,
                        dependencies: [],
                        status: 'failed',
                        createdAt: new Date(),
                        startedAt: new Date(Date.now() - 1000),
                        completedAt: new Date(),
                        retryCount: taskSpec.retryCount,
                        error: taskSpec.errorMessage,
                        result: 'Some previous result'
                    };

                    taskQueue.enqueue(task);

                    // Retry the task
                    taskQueue.retryTask(task.id);

                    // Verify state reset
                    const retriedTask = taskQueue.getTask(task.id);
                    expect(retriedTask?.status).toBe('pending');
                    expect(retriedTask?.error).toBeUndefined();
                    expect(retriedTask?.startedAt).toBeUndefined();
                    expect(retriedTask?.completedAt).toBeUndefined();
                    expect(retriedTask?.retryCount).toBe(taskSpec.retryCount + 1);

                    // Verify fields that should remain unchanged
                    expect(retriedTask?.id).toBe(task.id);
                    expect(retriedTask?.type).toBe(task.type);
                    expect(retriedTask?.priority).toBe(task.priority);
                    expect(retriedTask?.prompt).toBe(task.prompt);
                    expect(retriedTask?.createdAt).toEqual(task.createdAt);
                    expect(retriedTask?.dependencies).toEqual(task.dependencies);
                    // Note: result field behavior may vary - some systems clear it, others keep it
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property test: Non-existent task retry handling
     * Verifies that attempting to retry a non-existent task throws appropriate error
     */
    test('Property: Non-existent task retry handling', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 1, maxLength: 50 }).filter(id => !id.includes(' ')),
                async (nonExistentId) => {
                    // Ensure the task doesn't exist in the queue
                    const existingTask = taskQueue.getTask(nonExistentId);
                    expect(existingTask).toBeUndefined();

                    // Attempt to retry non-existent task should throw error
                    expect(() => taskQueue.retryTask(nonExistentId)).toThrow(TaskQueueError);
                    expect(() => taskQueue.retryTask(nonExistentId)).toThrow(/not found/);
                }
            ),
            { numRuns: 50 } // Fewer runs since this is a simpler property
        );
    });
});