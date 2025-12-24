/**
 * Property-based test for time-based task counting
 * **Feature: code-quality-fixes, Property 1: Time-based task counting**
 * **Validates: Requirements 1.1**
 */

import * as fc from 'fast-check';
import { PerformanceMonitor } from '../src/services/performanceMonitor';

describe('Property 1: Time-based task counting', () => {
    let performanceMonitor: PerformanceMonitor;

    beforeEach(() => {
        performanceMonitor = new PerformanceMonitor();
        performanceMonitor.resetStatistics();
    });

    afterEach(() => {
        performanceMonitor.destroy();
    });

    test('should count tasks within 60-second window accurately', async () => {
        await fc.assert(
            fc.asyncProperty(
                // Generate tasks with different execution times and success states
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

                    // Record all tasks in quick succession (they should all be within the 60-second window)
                    for (const task of taskData) {
                        monitor.recordTaskExecution(
                            task.duration,
                            task.success,
                            task.agentId || undefined,
                            task.taskType || undefined
                        );
                    }

                    // Get the calculated tasks per minute immediately after recording
                    const metrics = monitor.getMetrics();
                    const calculatedTasksPerMinute = metrics.taskMetrics.tasksPerMinute;

                    monitor.destroy();

                    // Property: Since all tasks were recorded within a short time span,
                    // tasksPerMinute should equal the total number of tasks recorded
                    return calculatedTasksPerMinute === taskData.length;
                }
            ),
            { numRuns: 100 }
        );
    });

    test('should handle empty task list correctly', async () => {
        const monitor = new PerformanceMonitor();
        monitor.resetStatistics();

        const metrics = monitor.getMetrics();

        monitor.destroy();

        // Property: With no tasks recorded, tasksPerMinute should be 0
        expect(metrics.taskMetrics.tasksPerMinute).toBe(0);
    });

    test('should maintain consistency between total executed and recent tasks', async () => {
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

                    // Record tasks
                    for (const task of taskData) {
                        monitor.recordTaskExecution(task.duration, task.success);
                    }

                    const metrics = monitor.getMetrics();

                    monitor.destroy();

                    // Property: For recently recorded tasks, tasksPerMinute should not exceed totalExecuted
                    return metrics.taskMetrics.tasksPerMinute <= metrics.taskMetrics.totalExecuted;
                }
            ),
            { numRuns: 100 }
        );
    });

    test('should calculate tasks per minute based on actual time window', async () => {
        // This test verifies the core property by testing the actual implementation
        const monitor = new PerformanceMonitor();
        monitor.resetStatistics();

        // Record some tasks
        monitor.recordTaskExecution(100, true);
        monitor.recordTaskExecution(200, false);
        monitor.recordTaskExecution(150, true);

        const metrics = monitor.getMetrics();

        monitor.destroy();

        // Property: The tasksPerMinute should reflect the actual count of tasks in the time window
        // Since we just recorded 3 tasks, they should all be in the current minute window
        expect(metrics.taskMetrics.tasksPerMinute).toBe(3);
    });
});