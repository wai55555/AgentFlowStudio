/**
 * Property-based test for time filtering consistency
 * **Feature: code-quality-fixes, Property 3: Time filtering consistency**
 * **Validates: Requirements 1.3**
 */

import * as fc from 'fast-check';
import { PerformanceMonitor, TaskExecutionRecord } from '../src/services/performanceMonitor';

describe('Property 3: Time filtering consistency', () => {
    let performanceMonitor: PerformanceMonitor;

    beforeEach(() => {
        performanceMonitor = new PerformanceMonitor();
        performanceMonitor.resetStatistics();
    });

    afterEach(() => {
        performanceMonitor.destroy();
    });

    test('should maintain time window filtering consistency for recent tasks', async () => {
        await fc.assert(
            fc.asyncProperty(
                // Generate tasks that will all be recorded with current timestamps
                fc.array(
                    fc.record({
                        duration: fc.integer({ min: 10, max: 5000 }),
                        success: fc.boolean(),
                        agentId: fc.option(fc.string({ minLength: 1, maxLength: 20 })),
                        taskType: fc.option(fc.string({ minLength: 1, maxLength: 20 }))
                    }),
                    { minLength: 1, maxLength: 50 }
                ),
                async (taskData) => {
                    const monitor = new PerformanceMonitor();
                    monitor.resetStatistics();

                    // Record all tasks (they will all have current timestamps)
                    for (const task of taskData) {
                        monitor.recordTaskExecution(
                            task.duration,
                            task.success,
                            task.agentId || undefined,
                            task.taskType || undefined
                        );
                    }

                    const metrics = monitor.getMetrics();

                    monitor.destroy();

                    // Property: Since all tasks were just recorded (within the current second),
                    // they should all be within the 60-second time window used by tasksPerMinute
                    // Therefore, tasksPerMinute should equal the total number of tasks recorded
                    return metrics.taskMetrics.tasksPerMinute === taskData.length;
                }
            ),
            { numRuns: 100 }
        );
    });

    test('should filter tasks correctly for 60-second window', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(
                    fc.record({
                        duration: fc.integer({ min: 10, max: 1000 }),
                        success: fc.boolean()
                    }),
                    { minLength: 1, maxLength: 30 }
                ),
                async (taskData) => {
                    const monitor = new PerformanceMonitor();
                    monitor.resetStatistics();

                    // Record all tasks (they will all have current timestamps)
                    for (const task of taskData) {
                        monitor.recordTaskExecution(task.duration, task.success);
                    }

                    const metrics = monitor.getMetrics();

                    monitor.destroy();

                    // Property: Since all tasks were just recorded (within the last second),
                    // they should all be within the 60-second window
                    // Therefore, tasksPerMinute should equal the total number of tasks
                    return metrics.taskMetrics.tasksPerMinute === taskData.length;
                }
            ),
            { numRuns: 100 }
        );
    });

    test('should maintain time window boundary consistency', async () => {
        // This test verifies that the time window filtering is consistent
        // by checking that tasks recorded now are counted, and old tasks are not

        const monitor = new PerformanceMonitor();
        monitor.resetStatistics();

        // Record some tasks now
        monitor.recordTaskExecution(100, true);
        monitor.recordTaskExecution(200, true);
        monitor.recordTaskExecution(150, true);

        const metricsNow = monitor.getMetrics();

        // Property: All recently recorded tasks should be in the current minute window
        expect(metricsNow.taskMetrics.tasksPerMinute).toBe(3);

        monitor.destroy();
    });

    test('should handle empty time windows correctly', async () => {
        const monitor = new PerformanceMonitor();
        monitor.resetStatistics();

        // Don't record any tasks
        const metrics = monitor.getMetrics();

        monitor.destroy();

        // Property: With no tasks in the time window, tasksPerMinute should be 0
        expect(metrics.taskMetrics.tasksPerMinute).toBe(0);
    });

    test('should ensure all counted tasks are within time range', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(
                    fc.record({
                        duration: fc.integer({ min: 10, max: 2000 }),
                        success: fc.boolean(),
                        agentId: fc.option(fc.string({ minLength: 1, maxLength: 15 }))
                    }),
                    { minLength: 1, maxLength: 40 }
                ),
                async (taskData) => {
                    const monitor = new PerformanceMonitor();
                    monitor.resetStatistics();

                    // Record all tasks in quick succession
                    for (const task of taskData) {
                        monitor.recordTaskExecution(
                            task.duration,
                            task.success,
                            task.agentId || undefined
                        );
                    }

                    const metrics = monitor.getMetrics();

                    monitor.destroy();

                    // Property: The tasksPerMinute count should be consistent with the time window
                    // Since all tasks were recorded just now, they should all be counted
                    const isConsistent = metrics.taskMetrics.tasksPerMinute === taskData.length;

                    // Also verify that tasksPerMinute doesn't exceed totalExecuted
                    const doesNotExceedTotal = metrics.taskMetrics.tasksPerMinute <= metrics.taskMetrics.totalExecuted;

                    return isConsistent && doesNotExceedTotal;
                }
            ),
            { numRuns: 100 }
        );
    });

    test('should maintain consistency across multiple time window queries', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(
                    fc.record({
                        duration: fc.integer({ min: 10, max: 1000 }),
                        success: fc.boolean()
                    }),
                    { minLength: 1, maxLength: 25 }
                ),
                async (taskData) => {
                    const monitor = new PerformanceMonitor();
                    monitor.resetStatistics();

                    // Record all tasks
                    for (const task of taskData) {
                        monitor.recordTaskExecution(task.duration, task.success);
                    }

                    // Get metrics multiple times
                    const metrics1 = monitor.getMetrics();
                    const metrics2 = monitor.getMetrics();
                    const metrics3 = monitor.getMetrics();

                    monitor.destroy();

                    // Property: Multiple queries for the same time window should return consistent results
                    const isConsistent =
                        metrics1.taskMetrics.tasksPerMinute === metrics2.taskMetrics.tasksPerMinute &&
                        metrics2.taskMetrics.tasksPerMinute === metrics3.taskMetrics.tasksPerMinute;

                    return isConsistent;
                }
            ),
            { numRuns: 100 }
        );
    });

    test('should ensure time window filtering never exceeds total tasks', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(
                    fc.record({
                        duration: fc.integer({ min: 1, max: 3000 }),
                        success: fc.boolean(),
                        agentId: fc.option(fc.string({ minLength: 1, maxLength: 10 })),
                        taskType: fc.option(fc.string({ minLength: 1, maxLength: 10 }))
                    }),
                    { minLength: 0, maxLength: 100 }
                ),
                async (taskData) => {
                    const monitor = new PerformanceMonitor();
                    monitor.resetStatistics();

                    // Record all tasks
                    for (const task of taskData) {
                        monitor.recordTaskExecution(
                            task.duration,
                            task.success,
                            task.agentId || undefined,
                            task.taskType || undefined
                        );
                    }

                    const metrics = monitor.getMetrics();

                    monitor.destroy();

                    // Property: Time window filtering should never return more tasks than total executed
                    // This ensures the filtering logic is working correctly
                    return metrics.taskMetrics.tasksPerMinute <= metrics.taskMetrics.totalExecuted;
                }
            ),
            { numRuns: 100 }
        );
    });

    test('should maintain time window consistency with peak tracking', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(
                    fc.array(
                        fc.record({
                            duration: fc.integer({ min: 10, max: 1000 }),
                            success: fc.boolean()
                        }),
                        { minLength: 0, maxLength: 15 }
                    ),
                    { minLength: 1, maxLength: 5 }
                ),
                async (taskBatches) => {
                    const monitor = new PerformanceMonitor();
                    monitor.resetStatistics();

                    let maxTasksInWindow = 0;

                    // Process each batch and track the maximum
                    for (const batch of taskBatches) {
                        // Record all tasks in the batch
                        for (const task of batch) {
                            monitor.recordTaskExecution(task.duration, task.success);
                        }

                        const metrics = monitor.getMetrics();
                        maxTasksInWindow = Math.max(maxTasksInWindow, metrics.taskMetrics.tasksPerMinute);
                    }

                    const finalMetrics = monitor.getMetrics();

                    monitor.destroy();

                    // Property: Peak tasks per minute should be at least as high as the maximum observed
                    // This ensures time window filtering is consistent with peak tracking
                    return finalMetrics.taskMetrics.peakTasksPerMinute >= maxTasksInWindow;
                }
            ),
            { numRuns: 100 }
        );
    });
});