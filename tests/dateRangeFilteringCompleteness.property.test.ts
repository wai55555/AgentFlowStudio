/**
 * Property-based test for date range filtering completeness
 * **Feature: code-quality-fixes, Property 5: Date range filtering completeness**
 * **Validates: Requirements 2.1, 2.2, 2.3**
 */

import * as fc from 'fast-check';
import { IndexedDBManager, type ExecutionLog, type DateFilterOptions } from '../src/services/indexedDB';

describe('Property 5: Date range filtering completeness', () => {
    let manager: IndexedDBManager;

    beforeEach(() => {
        manager = new IndexedDBManager();
    });

    afterEach(() => {
        if (manager) {
            manager.close();
        }
    });

    // Generator for valid ExecutionLog objects
    const executionLogArbitrary = fc.record({
        id: fc.string({ minLength: 1, maxLength: 20 }),
        taskId: fc.string({ minLength: 1, maxLength: 20 }),
        agentId: fc.string({ minLength: 1, maxLength: 20 }),
        timestamp: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }),
        level: fc.constantFrom('info', 'warn', 'error'),
        message: fc.string({ minLength: 1, maxLength: 100 }),
        details: fc.option(fc.anything())
    }) as fc.Arbitrary<ExecutionLog>;

    // Generator for date ranges
    const dateRangeArbitrary = fc.tuple(
        fc.date({ min: new Date('2020-01-01'), max: new Date('2024-12-31') }),
        fc.date({ min: new Date('2020-01-01'), max: new Date('2024-12-31') })
    ).map(([date1, date2]) => {
        // Ensure startDate <= endDate
        const startDate = date1 <= date2 ? date1 : date2;
        const endDate = date1 <= date2 ? date2 : date1;
        return { startDate, endDate };
    });

    test('should include all logs within date range and exclude all logs outside range', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(executionLogArbitrary, { minLength: 0, maxLength: 50 }),
                dateRangeArbitrary,
                async (logs, { startDate, endDate }) => {
                    // Use the private filterLogsByDateRange method to test the core logic
                    const filtered = (manager as any).filterLogsByDateRange(logs, startDate, endDate);

                    // Property: All filtered logs must be within the date range
                    const allWithinRange = filtered.every((log: ExecutionLog) => {
                        const logTimestamp = new Date(log.timestamp);
                        return logTimestamp >= startDate && logTimestamp <= endDate;
                    });

                    // Property: All logs within the range must be included
                    const expectedLogsInRange = logs.filter(log => {
                        const logTimestamp = new Date(log.timestamp);
                        return logTimestamp >= startDate && logTimestamp <= endDate;
                    });

                    const allIncluded = expectedLogsInRange.length === filtered.length &&
                        expectedLogsInRange.every(expectedLog =>
                            filtered.some((filteredLog: ExecutionLog) => filteredLog.id === expectedLog.id)
                        );

                    return allWithinRange && allIncluded;
                }
            ),
            { numRuns: 100 }
        );
    });

    test('should handle startDate-only filtering correctly', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(executionLogArbitrary, { minLength: 0, maxLength: 30 }),
                fc.date({ min: new Date('2020-01-01'), max: new Date('2024-12-31') }),
                async (logs, startDate) => {
                    const filtered = (manager as any).filterLogsByDateRange(logs, startDate, undefined);

                    // Property: All filtered logs must be on or after startDate
                    const allAfterStart = filtered.every((log: ExecutionLog) => {
                        const logTimestamp = new Date(log.timestamp);
                        return logTimestamp >= startDate;
                    });

                    // Property: All logs on or after startDate must be included
                    const expectedLogs = logs.filter(log => {
                        const logTimestamp = new Date(log.timestamp);
                        return logTimestamp >= startDate;
                    });

                    const allIncluded = expectedLogs.length === filtered.length &&
                        expectedLogs.every(expectedLog =>
                            filtered.some((filteredLog: ExecutionLog) => filteredLog.id === expectedLog.id)
                        );

                    return allAfterStart && allIncluded;
                }
            ),
            { numRuns: 100 }
        );
    });

    test('should handle endDate-only filtering correctly', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(executionLogArbitrary, { minLength: 0, maxLength: 30 }),
                fc.date({ min: new Date('2020-01-01'), max: new Date('2024-12-31') }),
                async (logs, endDate) => {
                    const filtered = (manager as any).filterLogsByDateRange(logs, undefined, endDate);

                    // Property: All filtered logs must be on or before endDate
                    const allBeforeEnd = filtered.every((log: ExecutionLog) => {
                        const logTimestamp = new Date(log.timestamp);
                        return logTimestamp <= endDate;
                    });

                    // Property: All logs on or before endDate must be included
                    const expectedLogs = logs.filter(log => {
                        const logTimestamp = new Date(log.timestamp);
                        return logTimestamp <= endDate;
                    });

                    const allIncluded = expectedLogs.length === filtered.length &&
                        expectedLogs.every(expectedLog =>
                            filtered.some((filteredLog: ExecutionLog) => filteredLog.id === expectedLog.id)
                        );

                    return allBeforeEnd && allIncluded;
                }
            ),
            { numRuns: 100 }
        );
    });

    test('should return all logs when no date filters are provided', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(executionLogArbitrary, { minLength: 0, maxLength: 40 }),
                async (logs) => {
                    const filtered = (manager as any).filterLogsByDateRange(logs, undefined, undefined);

                    // Property: When no date filters are provided, all logs should be returned
                    const allIncluded = logs.length === filtered.length &&
                        logs.every(originalLog =>
                            filtered.some((filteredLog: ExecutionLog) => filteredLog.id === originalLog.id)
                        );

                    return allIncluded;
                }
            ),
            { numRuns: 100 }
        );
    });

    test('should handle exact timestamp boundary conditions', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.date({ min: new Date('2020-01-01'), max: new Date('2024-12-31') }),
                async (exactDate) => {
                    // Create logs with exact timestamp matches
                    const logs: ExecutionLog[] = [
                        {
                            id: 'exact-match',
                            taskId: 'task1',
                            agentId: 'agent1',
                            timestamp: exactDate,
                            level: 'info',
                            message: 'Exact match log'
                        },
                        {
                            id: 'before',
                            taskId: 'task2',
                            agentId: 'agent1',
                            timestamp: new Date(exactDate.getTime() - 1000), // 1 second before
                            level: 'info',
                            message: 'Before log'
                        },
                        {
                            id: 'after',
                            taskId: 'task3',
                            agentId: 'agent1',
                            timestamp: new Date(exactDate.getTime() + 1000), // 1 second after
                            level: 'info',
                            message: 'After log'
                        }
                    ];

                    // Test exact date as both start and end
                    const exactFiltered = (manager as any).filterLogsByDateRange(logs, exactDate, exactDate);

                    // Property: Only the exact match should be included
                    const exactMatchOnly = exactFiltered.length === 1 &&
                        exactFiltered[0].id === 'exact-match';

                    // Test exact date as start only
                    const startFiltered = (manager as any).filterLogsByDateRange(logs, exactDate, undefined);

                    // Property: Exact match and after should be included
                    const startCorrect = startFiltered.length === 2 &&
                        startFiltered.some((log: ExecutionLog) => log.id === 'exact-match') &&
                        startFiltered.some((log: ExecutionLog) => log.id === 'after');

                    // Test exact date as end only
                    const endFiltered = (manager as any).filterLogsByDateRange(logs, undefined, exactDate);

                    // Property: Before and exact match should be included
                    const endCorrect = endFiltered.length === 2 &&
                        endFiltered.some((log: ExecutionLog) => log.id === 'exact-match') &&
                        endFiltered.some((log: ExecutionLog) => log.id === 'before');

                    return exactMatchOnly && startCorrect && endCorrect;
                }
            ),
            { numRuns: 100 }
        );
    });

    test('should maintain filtering completeness with empty result sets', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(executionLogArbitrary, { minLength: 0, maxLength: 20 }),
                dateRangeArbitrary,
                async (logs, { startDate, endDate }) => {
                    // Ensure the date range is outside all log timestamps
                    const maxLogDate = logs.length > 0
                        ? new Date(Math.max(...logs.map(log => new Date(log.timestamp).getTime())))
                        : new Date('2020-01-01');

                    // Create a date range that's definitely after all logs
                    const futureStartDate = new Date(maxLogDate.getTime() + 86400000); // 1 day after
                    const futureEndDate = new Date(maxLogDate.getTime() + 172800000); // 2 days after

                    const filtered = (manager as any).filterLogsByDateRange(logs, futureStartDate, futureEndDate);

                    // Property: When no logs fall within the range, result should be empty
                    return filtered.length === 0;
                }
            ),
            { numRuns: 100 }
        );
    });

    test('should preserve log identity and properties during filtering', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(executionLogArbitrary, { minLength: 1, maxLength: 20 }),
                dateRangeArbitrary,
                async (logs, { startDate, endDate }) => {
                    const filtered = (manager as any).filterLogsByDateRange(logs, startDate, endDate);

                    // Property: All filtered logs should be identical to their originals
                    const allIdentical = filtered.every((filteredLog: ExecutionLog) => {
                        const originalLog = logs.find(log => log.id === filteredLog.id);
                        if (!originalLog) return false;

                        return originalLog.id === filteredLog.id &&
                            originalLog.taskId === filteredLog.taskId &&
                            originalLog.agentId === filteredLog.agentId &&
                            originalLog.timestamp.getTime() === new Date(filteredLog.timestamp).getTime() &&
                            originalLog.level === filteredLog.level &&
                            originalLog.message === filteredLog.message;
                    });

                    return allIdentical;
                }
            ),
            { numRuns: 100 }
        );
    });

    test('should handle date filtering with various log levels and properties', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(executionLogArbitrary, { minLength: 0, maxLength: 30 }),
                dateRangeArbitrary,
                async (logs, { startDate, endDate }) => {
                    const filtered = (manager as any).filterLogsByDateRange(logs, startDate, endDate);

                    // Property: Date filtering should not affect other log properties
                    // All log levels should be preserved proportionally
                    const originalLevels = logs.filter(log => {
                        const logTimestamp = new Date(log.timestamp);
                        return logTimestamp >= startDate && logTimestamp <= endDate;
                    }).map(log => log.level);

                    const filteredLevels = filtered.map((log: ExecutionLog) => log.level);

                    // Check that the same levels are present in the same quantities
                    const levelCounts = (levels: string[]) => {
                        const counts: Record<string, number> = {};
                        levels.forEach(level => counts[level] = (counts[level] || 0) + 1);
                        return counts;
                    };

                    const originalCounts = levelCounts(originalLevels);
                    const filteredCounts = levelCounts(filteredLevels);

                    const countsMatch = Object.keys(originalCounts).every(level =>
                        originalCounts[level] === (filteredCounts[level] || 0)
                    ) && Object.keys(filteredCounts).every(level =>
                        filteredCounts[level] === (originalCounts[level] || 0)
                    );

                    return countsMatch;
                }
            ),
            { numRuns: 100 }
        );
    });
});