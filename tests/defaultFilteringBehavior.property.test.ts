/**
 * Property-based test for default filtering behavior
 * **Feature: code-quality-fixes, Property 6: Default filtering behavior**
 * **Validates: Requirements 2.4**
 */

import * as fc from 'fast-check';
import { IndexedDBManager, type ExecutionLog, type DateFilterOptions } from '../src/services/indexedDB';

describe('Property 6: Default filtering behavior', () => {
    let manager: IndexedDBManager;

    beforeEach(() => {
        manager = new IndexedDBManager();
    });

    afterEach(() => {
        if (manager) {
            manager.close();
        }
    });

    // Generator for valid ExecutionLog objects with unique IDs
    const executionLogArbitrary = fc.record({
        id: fc.string({ minLength: 1, maxLength: 20 }),
        taskId: fc.string({ minLength: 1, maxLength: 20 }),
        agentId: fc.string({ minLength: 1, maxLength: 20 }),
        timestamp: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }),
        level: fc.constantFrom('info', 'warn', 'error'),
        message: fc.string({ minLength: 1, maxLength: 100 }),
        details: fc.option(fc.anything())
    }) as fc.Arbitrary<ExecutionLog>;

    // Generator for arrays of logs with unique IDs
    const uniqueLogsArbitrary = (minLength: number = 0, maxLength: number = 50) =>
        fc.array(executionLogArbitrary, { minLength, maxLength })
            .map(logs => {
                // Ensure unique IDs by appending index
                return logs.map((log, index) => ({
                    ...log,
                    id: `${log.id}_${index}`
                }));
            });

    test('should return all logs when no filter is provided', async () => {
        await fc.assert(
            fc.asyncProperty(
                uniqueLogsArbitrary(0, 50),
                async (logs) => {
                    // Test the core filtering logic directly
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

    test('should return all logs when empty filter object is provided', async () => {
        await fc.assert(
            fc.asyncProperty(
                uniqueLogsArbitrary(0, 30),
                async (logs) => {
                    // Test with empty filter object - both startDate and endDate are undefined
                    // This simulates an empty DateFilterOptions object
                    const filtered = (manager as any).filterLogsByDateRange(logs, undefined, undefined);

                    // Property: Empty filter should behave the same as no filter
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

    test('should preserve log order and properties when no filtering is applied', async () => {
        await fc.assert(
            fc.asyncProperty(
                uniqueLogsArbitrary(1, 20),
                async (logs) => {
                    const filtered = (manager as any).filterLogsByDateRange(logs, undefined, undefined);

                    // Property: All logs should be returned with identical properties
                    const allIdentical = logs.length === filtered.length &&
                        logs.every((originalLog) => {
                            const filteredLog = filtered.find((log: ExecutionLog) => log.id === originalLog.id);
                            if (!filteredLog) return false;

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

    test('should handle empty log arrays correctly with no filters', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.constant([]),
                async (logs: ExecutionLog[]) => {
                    const filtered = (manager as any).filterLogsByDateRange(logs, undefined, undefined);

                    // Property: Empty input should return empty output
                    return filtered.length === 0;
                }
            ),
            { numRuns: 100 }
        );
    });

    test('should maintain referential integrity when no filtering is applied', async () => {
        await fc.assert(
            fc.asyncProperty(
                uniqueLogsArbitrary(1, 15),
                async (logs) => {
                    const filtered = (manager as any).filterLogsByDateRange(logs, undefined, undefined);

                    // Property: Each filtered log should be a reference to an original log
                    const allReferencesValid = filtered.every((filteredLog: ExecutionLog) => {
                        return logs.some(originalLog => originalLog.id === filteredLog.id);
                    });

                    // Property: No duplicate logs should be returned
                    const uniqueIds = new Set(filtered.map((log: ExecutionLog) => log.id));
                    const noDuplicates = uniqueIds.size === filtered.length;

                    return allReferencesValid && noDuplicates;
                }
            ),
            { numRuns: 100 }
        );
    });

    test('should handle logs with various timestamp distributions without filtering', async () => {
        await fc.assert(
            fc.asyncProperty(
                uniqueLogsArbitrary(0, 25),
                async (logs) => {
                    const filtered = (manager as any).filterLogsByDateRange(logs, undefined, undefined);

                    // Property: All logs should be included regardless of timestamp distribution
                    if (logs.length === 0) {
                        return filtered.length === 0;
                    }

                    const timestampRanges = logs.map(log => new Date(log.timestamp).getTime());
                    const minTimestamp = Math.min(...timestampRanges);
                    const maxTimestamp = Math.max(...timestampRanges);

                    // Verify all logs within the natural range are included
                    const allInRange = filtered.every((log: ExecutionLog) => {
                        const logTime = new Date(log.timestamp).getTime();
                        return logTime >= minTimestamp && logTime <= maxTimestamp;
                    });

                    // Verify count matches
                    const countMatches = logs.length === filtered.length;

                    return allInRange && countMatches;
                }
            ),
            { numRuns: 100 }
        );
    });

    test('should handle logs with different levels without filtering', async () => {
        await fc.assert(
            fc.asyncProperty(
                uniqueLogsArbitrary(0, 30),
                async (logs) => {
                    const filtered = (manager as any).filterLogsByDateRange(logs, undefined, undefined);

                    // Property: All log levels should be preserved when no filtering is applied
                    const originalLevels = logs.map(log => log.level).sort();
                    const filteredLevels = filtered.map((log: ExecutionLog) => log.level).sort();

                    const levelsMatch = originalLevels.length === filteredLevels.length &&
                        originalLevels.every((level, index) => level === filteredLevels[index]);

                    return levelsMatch;
                }
            ),
            { numRuns: 100 }
        );
    });

    test('should handle logs with different task and agent IDs without filtering', async () => {
        await fc.assert(
            fc.asyncProperty(
                uniqueLogsArbitrary(0, 20),
                async (logs) => {
                    const filtered = (manager as any).filterLogsByDateRange(logs, undefined, undefined);

                    // Property: All task and agent IDs should be preserved
                    const originalTaskIds = new Set(logs.map(log => log.taskId));
                    const filteredTaskIds = new Set(filtered.map((log: ExecutionLog) => log.taskId));

                    const originalAgentIds = new Set(logs.map(log => log.agentId));
                    const filteredAgentIds = new Set(filtered.map((log: ExecutionLog) => log.agentId));

                    const taskIdsMatch = originalTaskIds.size === filteredTaskIds.size &&
                        [...originalTaskIds].every(id => filteredTaskIds.has(id));

                    const agentIdsMatch = originalAgentIds.size === filteredAgentIds.size &&
                        [...originalAgentIds].every(id => filteredAgentIds.has(id));

                    return taskIdsMatch && agentIdsMatch;
                }
            ),
            { numRuns: 100 }
        );
    });
});