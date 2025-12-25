/**
 * Property-based test for metrics value semantic accuracy
 * **Feature: code-quality-fixes, Property 2: Metrics value semantic accuracy**
 * **Validates: Requirements 1.2**
 */

import * as fc from 'fast-check';
import { PerformanceMonitor } from '../src/services/performanceMonitor';

describe('Property 2: Metrics value semantic accuracy', () => {
    let performanceMonitor: PerformanceMonitor;

    beforeEach(() => {
        performanceMonitor = new PerformanceMonitor();
        performanceMonitor.resetStatistics();
    });

    afterEach(() => {
        performanceMonitor.destroy();
    });

    test('should calculate success rate accurately from actual task results', async () => {
        await fc.assert(
            fc.asyncProperty(
                // Generate tasks with known success/failure distribution
                fc.array(
                    fc.record({
                        duration: fc.integer({ min: 10, max: 1000 }),
                        success: fc.boolean()
                    }),
                    { minLength: 1, maxLength: 100 }
                ),
                async (taskData) => {
                    const monitor = new PerformanceMonitor();
                    monitor.resetStatistics();

                    // Record all tasks
                    for (const task of taskData) {
                        monitor.recordTaskExecution(task.duration, task.success);
                    }

                    const metrics = monitor.getMetrics();

                    // Calculate expected success rate from actual data
                    const successfulTasks = taskData.filter(task => task.success).length;
                    const totalTasks = taskData.length;
                    const expectedSuccessRate = totalTasks > 0 ? successfulTasks / totalTasks : 0;
                    const expectedFailureRate = totalTasks > 0 ? (totalTasks - successfulTasks) / totalTasks : 0;

                    monitor.destroy();

                    // Property: Success rate must match actual calculation from recorded data
                    const successRateAccurate = Math.abs(metrics.taskMetrics.successRate - expectedSuccessRate) < 0.0001;
                    const failureRateAccurate = Math.abs(metrics.taskMetrics.failureRate - expectedFailureRate) < 0.0001;
                    const totalExecutedAccurate = metrics.taskMetrics.totalExecuted === totalTasks;

                    return successRateAccurate && failureRateAccurate && totalExecutedAccurate;
                }
            ),
            { numRuns: 100 }
        );
    });

    test('should calculate average execution time accurately from actual durations', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(
                    fc.record({
                        duration: fc.integer({ min: 1, max: 5000 }),
                        success: fc.boolean()
                    }),
                    { minLength: 1, maxLength: 50 }
                ),
                async (taskData) => {
                    const monitor = new PerformanceMonitor();
                    monitor.resetStatistics();

                    // Record all tasks
                    for (const task of taskData) {
                        monitor.recordTaskExecution(task.duration, task.success);
                    }

                    const metrics = monitor.getMetrics();

                    // Calculate expected average from actual data
                    const totalDuration = taskData.reduce((sum, task) => sum + task.duration, 0);
                    const expectedAverage = taskData.length > 0 ? totalDuration / taskData.length : 0;

                    monitor.destroy();

                    // Property: Average execution time must match actual calculation from recorded durations
                    return Math.abs(metrics.taskMetrics.averageExecutionTime - expectedAverage) < 0.1;
                }
            ),
            { numRuns: 100 }
        );
    });

    test('should maintain peak tasks per minute as monotonically increasing', async () => {
        await fc.assert(
            fc.asyncProperty(
                // Generate multiple batches of tasks to simulate different time periods
                fc.array(
                    fc.array(
                        fc.record({
                            duration: fc.integer({ min: 10, max: 1000 }),
                            success: fc.boolean()
                        }),
                        { minLength: 0, maxLength: 20 }
                    ),
                    { minLength: 1, maxLength: 10 }
                ),
                async (taskBatches) => {
                    const monitor = new PerformanceMonitor();
                    monitor.resetStatistics();

                    let previousPeak = 0;
                    let isMonotonic = true;

                    // Process each batch and check peak monotonicity
                    for (const batch of taskBatches) {
                        // Record all tasks in the batch
                        for (const task of batch) {
                            monitor.recordTaskExecution(task.duration, task.success);
                        }

                        const metrics = monitor.getMetrics();
                        const currentPeak = metrics.taskMetrics.peakTasksPerMinute;

                        // Property: Peak value should never decrease
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

    test('should ensure total executed count matches actual recorded tasks', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(
                    fc.record({
                        duration: fc.integer({ min: 1, max: 2000 }),
                        success: fc.boolean(),
                        agentId: fc.option(fc.string({ minLength: 1, maxLength: 10 })),
                        taskType: fc.option(fc.string({ minLength: 1, maxLength: 10 }))
                    }),
                    { minLength: 0, maxLength: 200 }
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

                    // Property: Total executed count must exactly match the number of tasks recorded
                    return metrics.taskMetrics.totalExecuted === taskData.length;
                }
            ),
            { numRuns: 100 }
        );
    });

    test('should calculate agent utilization accurately from agent counts', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    totalAgents: fc.integer({ min: 0, max: 100 }),
                    activeAgents: fc.integer({ min: 0, max: 100 })
                }).filter(({ totalAgents, activeAgents }) => activeAgents <= totalAgents),
                async ({ totalAgents, activeAgents }) => {
                    const monitor = new PerformanceMonitor();
                    monitor.resetStatistics();

                    // Update agent metrics
                    monitor.updateAgentMetrics(totalAgents, activeAgents);

                    const metrics = monitor.getMetrics();

                    // Calculate expected utilization
                    const expectedUtilization = totalAgents > 0 ? activeAgents / totalAgents : 0;

                    monitor.destroy();

                    // Property: Agent utilization must match actual calculation from agent counts
                    return Math.abs(metrics.agentMetrics.averageUtilization - expectedUtilization) < 0.0001;
                }
            ),
            { numRuns: 100 }
        );
    });

    test('should maintain consistency between success and failure rates', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(
                    fc.record({
                        duration: fc.integer({ min: 10, max: 1000 }),
                        success: fc.boolean()
                    }),
                    { minLength: 1, maxLength: 50 }
                ),
                async (taskData) => {
                    const monitor = new PerformanceMonitor();
                    monitor.resetStatistics();

                    // Record all tasks
                    for (const task of taskData) {
                        monitor.recordTaskExecution(task.duration, task.success);
                    }

                    const metrics = monitor.getMetrics();

                    monitor.destroy();

                    // Property: Success rate + failure rate should equal 1.0 (within floating point precision)
                    const rateSum = metrics.taskMetrics.successRate + metrics.taskMetrics.failureRate;
                    return Math.abs(rateSum - 1.0) < 0.0001;
                }
            ),
            { numRuns: 100 }
        );
    });
});