import { PerformanceMonitor, TaskExecutionRecord } from '../src/services/performanceMonitor';

describe('PerformanceMonitor', () => {
    let performanceMonitor: PerformanceMonitor;

    beforeEach(() => {
        performanceMonitor = new PerformanceMonitor();
        // Clear any existing data
        performanceMonitor.resetStatistics();
    });

    afterEach(() => {
        performanceMonitor.destroy();
    });

    describe('Time-based metrics calculation', () => {
        it('should calculate tasks per minute based on actual time window', () => {
            // Record some tasks
            performanceMonitor.recordTaskExecution(100, true, 'agent1', 'test');
            performanceMonitor.recordTaskExecution(150, true, 'agent2', 'test');
            performanceMonitor.recordTaskExecution(200, false, 'agent1', 'test');

            const metrics = performanceMonitor.getMetrics();

            // Should have 3 tasks in the last minute
            expect(metrics.taskMetrics.tasksPerMinute).toBe(3);
            expect(metrics.taskMetrics.totalExecuted).toBe(3);
        });

        it('should update peak tasks per minute correctly', () => {
            // Record multiple tasks to increase current rate
            for (let i = 0; i < 5; i++) {
                performanceMonitor.recordTaskExecution(100, true, 'agent1', 'test');
            }

            const metrics = performanceMonitor.getMetrics();

            expect(metrics.taskMetrics.tasksPerMinute).toBe(5);
            expect(metrics.taskMetrics.peakTasksPerMinute).toBe(5);
        });

        it('should create TaskExecutionRecord with proper structure', () => {
            performanceMonitor.recordTaskExecution(100, true, 'agent1', 'test_task');

            // Access private field for testing (not ideal but necessary for verification)
            const records = (performanceMonitor as any).taskExecutionRecords as TaskExecutionRecord[];

            expect(records).toHaveLength(1);
            expect(records[0]).toMatchObject({
                duration: 100,
                success: true,
                agentId: 'agent1',
                taskType: 'test_task'
            });
            expect(records[0].id).toBeDefined();
            expect(records[0].timestamp).toBeInstanceOf(Date);
        });

        it('should calculate average execution time from recent records', () => {
            // Record tasks with different execution times
            performanceMonitor.recordTaskExecution(100, true);
            performanceMonitor.recordTaskExecution(200, true);
            performanceMonitor.recordTaskExecution(300, true);

            const metrics = performanceMonitor.getMetrics();

            // Average should be (100 + 200 + 300) / 3 = 200
            expect(metrics.taskMetrics.averageExecutionTime).toBe(200);
        });
    });

    describe('Success and failure rate calculation', () => {
        it('should calculate success rate correctly', () => {
            performanceMonitor.recordTaskExecution(100, true);
            performanceMonitor.recordTaskExecution(150, true);
            performanceMonitor.recordTaskExecution(200, false);

            const metrics = performanceMonitor.getMetrics();

            expect(metrics.taskMetrics.successRate).toBeCloseTo(2 / 3, 2);
            expect(metrics.taskMetrics.failureRate).toBeCloseTo(1 / 3, 2);
        });
    });
});