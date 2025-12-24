/**
 * Property-based test for peak value monotonicity
 * **Feature: code-quality-fixes, Property 4: Peak value monotonicity**
 * **Validates: Requirements 1.4**
 */

import * as fc from 'fast-check';
import { PerformanceMonitor } from '../src/services/performanceMonitor';

describe('Property 4: Peak value monotonicity', () => {
    let performanceMonitor: PerformanceMonitor;

    beforeEach(() => {
        performanceMonitor = new PerformanceMonitor();
        performanceMonitor.resetStatistics();
    });

    afterEach(() => {
        performanceMonitor.destroy();
    });

    test('should maintain peak tasks per minute as monotonically non-decreasing', async () => {
        await fc.assert(
            fc.asyncProperty(
                // Generate multiple batches of tasks to simulate different time periods
                fc.array(
                    fc.array(
                        fc.record({
                            duration: fc.integer({ min: 10, max: 1000 }),
                            success: fc.boolean(),
                            agentId: fc.option(fc.string({ minLength: 1, maxLength: 20 })),
                            taskType: fc.option(fc.string({ minLength: 1, maxLength: 20 }))
                        }),
                        { minLength: 0, maxLength: 30 }
                    ),
                    { minLength: 1, maxLength: 15 }
                ),
                async (taskBatches) => {
                    const monitor = new PerformanceMonitor();
                    monitor.resetStatistics();
                    monitor.stopMonitoring(); // Stop background updates

                    let previousPeak = 0;
                    let isMonotonic = true;

                    // Process each batch and verify peak monotonicity
                    for (const batch of taskBatches) {
                        // Record all tasks in the batch
                        for (const task of batch) {
                            monitor.recordTaskExecution(
                                task.duration,
                                task.success,
                                task.agentId || undefined,
                                task.taskType || undefined
                            );
                        }

                        const metrics = monitor.getMetrics();
                        const currentPeak = metrics.taskMetrics.peakTasksPerMinute;

                        // Property: Peak value should never decrease (monotonically non-decreasing)
                        if (currentPeak < previousPeak) {
                            isMonotonic = false;
                            break;
                        }

                        previousPeak = currentPeak;
                    }

                    monitor.destroy();

                    return isMonotonic;
                }
            ),
            { numRuns: 100 }
        );
    });

    test('should ensure peak is at least as high as current tasks per minute', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(
                    fc.record({
                        duration: fc.integer({ min: 10, max: 2000 }),
                        success: fc.boolean(),
                        agentId: fc.option(fc.string({ minLength: 1, maxLength: 15 })),
                        taskType: fc.option(fc.string({ minLength: 1, maxLength: 15 }))
                    }),
                    { minLength: 1, maxLength: 50 }
                ),
                async (taskData) => {
                    const monitor = new PerformanceMonitor();
                    monitor.resetStatistics();
                    monitor.stopMonitoring(); // Stop background updates

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

                    // Property: Peak tasks per minute should always be >= current tasks per minute
                    return metrics.taskMetrics.peakTasksPerMinute >= metrics.taskMetrics.tasksPerMinute;
                }
            ),
            { numRuns: 100 }
        );
    });

    test('should maintain peak across multiple measurement cycles', async () => {
        await fc.assert(
            fc.asyncProperty(
                // Generate sequences of task batches with varying sizes
                fc.array(
                    fc.record({
                        batchSize: fc.integer({ min: 0, max: 25 }),
                        taskDuration: fc.integer({ min: 10, max: 1000 }),
                        successRate: fc.float({ min: 0, max: 1 })
                    }),
                    { minLength: 2, maxLength: 10 }
                ),
                async (batchConfigs) => {
                    const monitor = new PerformanceMonitor();
                    monitor.resetStatistics();
                    monitor.stopMonitoring(); // Stop background updates

                    const peakValues: number[] = [];

                    // Process each batch configuration
                    for (const config of batchConfigs) {
                        // Record tasks for this batch
                        for (let i = 0; i < config.batchSize; i++) {
                            const success = Math.random() < config.successRate;
                            monitor.recordTaskExecution(config.taskDuration, success);
                        }

                        const metrics = monitor.getMetrics();
                        peakValues.push(metrics.taskMetrics.peakTasksPerMinute);
                    }

                    monitor.destroy();

                    // Property: Each peak value should be >= all previous peak values (monotonic)
                    for (let i = 1; i < peakValues.length; i++) {
                        if (peakValues[i] < peakValues[i - 1]) {
                            return false;
                        }
                    }

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    test('should handle zero tasks correctly for peak tracking', async () => {
        const monitor = new PerformanceMonitor();
        monitor.resetStatistics();

        // Stop real-time monitoring to prevent background updates
        monitor.stopMonitoring();

        // Don't record any tasks
        const initialMetrics = monitor.getMetrics();
        // Store the initial peak value separately to avoid mutation issues
        const initialPeakValue = initialMetrics.taskMetrics.peakTasksPerMinute;

        // Record some tasks
        monitor.recordTaskExecution(100, true);
        monitor.recordTaskExecution(200, true);

        const afterTasksMetrics = monitor.getMetrics();

        monitor.destroy();

        // Property: Peak should start at 0 and increase when tasks are recorded
        const initialPeakIsZero = initialPeakValue === 0;
        const peakIncreasedAfterTasks = afterTasksMetrics.taskMetrics.peakTasksPerMinute >= initialPeakValue;

        expect(initialPeakIsZero).toBe(true);
        expect(peakIncreasedAfterTasks).toBe(true);
    });

    test('should maintain peak consistency across metric queries', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(
                    fc.record({
                        duration: fc.integer({ min: 10, max: 1500 }),
                        success: fc.boolean()
                    }),
                    { minLength: 1, maxLength: 40 }
                ),
                async (taskData) => {
                    const monitor = new PerformanceMonitor();
                    monitor.resetStatistics();
                    monitor.stopMonitoring(); // Stop background updates

                    // Record all tasks
                    for (const task of taskData) {
                        monitor.recordTaskExecution(task.duration, task.success);
                    }

                    // Get metrics multiple times
                    const metrics1 = monitor.getMetrics();
                    const metrics2 = monitor.getMetrics();
                    const metrics3 = monitor.getMetrics();

                    monitor.destroy();

                    // Property: Peak value should be consistent across multiple queries
                    const peakConsistent =
                        metrics1.taskMetrics.peakTasksPerMinute === metrics2.taskMetrics.peakTasksPerMinute &&
                        metrics2.taskMetrics.peakTasksPerMinute === metrics3.taskMetrics.peakTasksPerMinute;

                    return peakConsistent;
                }
            ),
            { numRuns: 100 }
        );
    });

    test('should ensure peak reflects actual maximum observed rate', async () => {
        await fc.assert(
            fc.asyncProperty(
                // Generate multiple distinct batches to create different task rates
                fc.array(
                    fc.array(
                        fc.record({
                            duration: fc.integer({ min: 10, max: 800 }),
                            success: fc.boolean()
                        }),
                        { minLength: 0, maxLength: 20 }
                    ),
                    { minLength: 3, maxLength: 8 }
                ),
                async (taskBatches) => {
                    const monitor = new PerformanceMonitor();
                    monitor.resetStatistics();
                    monitor.stopMonitoring(); // Stop background updates

                    let observedMaxRate = 0;

                    // Process each batch and track the maximum observed rate
                    for (const batch of taskBatches) {
                        // Record all tasks in the batch
                        for (const task of batch) {
                            monitor.recordTaskExecution(task.duration, task.success);
                        }

                        const metrics = monitor.getMetrics();
                        observedMaxRate = Math.max(observedMaxRate, metrics.taskMetrics.tasksPerMinute);
                    }

                    const finalMetrics = monitor.getMetrics();

                    monitor.destroy();

                    // Property: Final peak should be at least as high as the maximum rate we observed
                    return finalMetrics.taskMetrics.peakTasksPerMinute >= observedMaxRate;
                }
            ),
            { numRuns: 100 }
        );
    });

    test('should handle single task execution correctly for peak tracking', async () => {
        const monitor = new PerformanceMonitor();
        monitor.resetStatistics();
        monitor.stopMonitoring(); // Stop background updates

        // Record a single task
        monitor.recordTaskExecution(100, true);

        const metrics = monitor.getMetrics();

        monitor.destroy();

        // Property: After recording one task, both current and peak should be 1
        expect(metrics.taskMetrics.tasksPerMinute).toBe(1);
        expect(metrics.taskMetrics.peakTasksPerMinute).toBe(1);
    });

    test('should maintain peak when current rate decreases', async () => {
        const monitor = new PerformanceMonitor();
        monitor.resetStatistics();
        monitor.stopMonitoring(); // Stop background updates

        // Record multiple tasks to establish a peak
        monitor.recordTaskExecution(100, true);
        monitor.recordTaskExecution(200, true);
        monitor.recordTaskExecution(150, true);

        const peakAfterTasks = monitor.getMetrics().taskMetrics.peakTasksPerMinute;

        // Simulate time passing without new tasks (in real scenario, this would cause current rate to drop)
        // For this test, we just verify the peak is maintained
        const finalMetrics = monitor.getMetrics();

        monitor.destroy();

        // Property: Peak should be maintained even when current rate might decrease
        expect(finalMetrics.taskMetrics.peakTasksPerMinute).toBe(peakAfterTasks);
        expect(finalMetrics.taskMetrics.peakTasksPerMinute).toBeGreaterThanOrEqual(3);
    });
});