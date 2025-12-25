/**
 * Property-based test for GroupBy type consistency
 * **Feature: code-quality-fixes, Property 8: GroupBy type consistency**
 * **Validates: Requirements 3.1, 3.2, 3.3**
 */

import * as fc from 'fast-check';
import { StatisticsService } from '../src/services/statisticsService';
import { AgentManager } from '../src/services/agentManager';
import { TaskQueueEngine } from '../src/services/taskQueue';
import { WorkflowEngine } from '../src/services/workflowEngine';

// Mock the dependencies
jest.mock('../src/services/agentManager');
jest.mock('../src/services/taskQueue');
jest.mock('../src/services/workflowEngine');

describe('Property 8: GroupBy type consistency', () => {
    let statisticsService: StatisticsService;
    let mockAgentManager: jest.Mocked<AgentManager>;
    let mockTaskQueue: jest.Mocked<TaskQueueEngine>;
    let mockWorkflowEngine: jest.Mocked<WorkflowEngine>;

    beforeEach(() => {
        mockAgentManager = new AgentManager() as jest.Mocked<AgentManager>;
        mockTaskQueue = new TaskQueueEngine() as jest.Mocked<TaskQueueEngine>;
        mockWorkflowEngine = new WorkflowEngine() as jest.Mocked<WorkflowEngine>;

        // Mock the methods that are called in the constructor
        mockAgentManager.getAllAgents = jest.fn().mockReturnValue([]);
        mockTaskQueue.getTasks = jest.fn().mockReturnValue([]);
        mockTaskQueue.getQueueStats = jest.fn().mockReturnValue({
            pending: 0,
            running: 0,
            completed: 0,
            failed: 0
        });
        mockWorkflowEngine.getWorkflows = jest.fn().mockReturnValue([]);

        statisticsService = new StatisticsService(mockAgentManager, mockTaskQueue, mockWorkflowEngine);
    });

    afterEach(() => {
        statisticsService.destroy();
    });

    test('should return string values for all property types in groupBy results', async () => {
        await fc.assert(
            fc.asyncProperty(
                // Generate arrays of objects with different property types
                fc.array(
                    fc.record({
                        stringProp: fc.string({ minLength: 1, maxLength: 10 }),
                        numberProp: fc.integer({ min: 0, max: 100 }),
                        booleanProp: fc.boolean(),
                        id: fc.uuid()
                    }),
                    { minLength: 1, maxLength: 20 }
                ),
                async (testData) => {
                    // Test grouping by string property
                    const stringResult = statisticsService.groupBy(testData, 'stringProp');
                    const stringTypeConsistent = stringResult.every(item =>
                        typeof item.stringProp === 'string' && typeof item.count === 'number'
                    );

                    // Test grouping by number property (should be converted to string)
                    const numberResult = statisticsService.groupBy(testData, 'numberProp');
                    const numberTypeConsistent = numberResult.every(item =>
                        typeof item.numberProp === 'string' && typeof item.count === 'number'
                    );

                    // Test grouping by boolean property (should be converted to string)
                    const booleanResult = statisticsService.groupBy(testData, 'booleanProp');
                    const booleanTypeConsistent = booleanResult.every(item =>
                        typeof item.booleanProp === 'string' && typeof item.count === 'number'
                    );

                    // Property: All grouped properties should be strings in the result,
                    // regardless of their original type, and count should always be number
                    return stringTypeConsistent && numberTypeConsistent && booleanTypeConsistent;
                }
            ),
            { numRuns: 100 }
        );
    });

    test('should maintain correct count values that match actual grouping', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(
                    fc.record({
                        category: fc.constantFrom('A', 'B', 'C'),
                        value: fc.integer({ min: 1, max: 5 })
                    }),
                    { minLength: 1, maxLength: 30 }
                ),
                async (testData) => {
                    const result = statisticsService.groupBy(testData, 'category');

                    // Calculate expected counts manually
                    const expectedCounts = testData.reduce((acc, item) => {
                        const key = String(item.category);
                        acc[key] = (acc[key] || 0) + 1;
                        return acc;
                    }, {} as Record<string, number>);

                    // Property: The count in each group should match the actual count
                    // of items with that property value
                    const countsMatch = result.every(group => {
                        const expectedCount = expectedCounts[group.category];
                        return group.count === expectedCount;
                    });

                    // Property: Total count should equal original array length
                    const totalCount = result.reduce((sum, group) => sum + group.count, 0);
                    const totalMatches = totalCount === testData.length;

                    return countsMatch && totalMatches;
                }
            ),
            { numRuns: 100 }
        );
    });

    test('should convert numeric values to strings while preserving semantic meaning', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(
                    fc.record({
                        priority: fc.integer({ min: 1, max: 5 }),
                        id: fc.uuid()
                    }),
                    { minLength: 1, maxLength: 15 }
                ),
                async (testData) => {
                    const result = statisticsService.groupBy(testData, 'priority');

                    // Property: Numeric values should be converted to strings,
                    // but the string representation should be semantically equivalent
                    const conversionCorrect = result.every(group => {
                        // The string value should be parseable back to the original number
                        const parsedValue = parseInt(group.priority, 10);
                        return !isNaN(parsedValue) && parsedValue >= 1 && parsedValue <= 5;
                    });

                    // Property: All priority values in result should be strings
                    const allStrings = result.every(group => typeof group.priority === 'string');

                    return conversionCorrect && allStrings;
                }
            ),
            { numRuns: 100 }
        );
    });

    test('should handle boolean conversion to strings correctly', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(
                    fc.record({
                        active: fc.boolean(),
                        name: fc.string({ minLength: 1, maxLength: 10 })
                    }),
                    { minLength: 1, maxLength: 20 }
                ),
                async (testData) => {
                    const result = statisticsService.groupBy(testData, 'active');

                    // Property: Boolean values should be converted to 'true' or 'false' strings
                    const validBooleanStrings = result.every(group =>
                        group.active === 'true' || group.active === 'false'
                    );

                    // Property: Should only have at most 2 groups (true and false)
                    const validGroupCount = result.length <= 2;

                    // Property: All active values should be strings
                    const allStrings = result.every(group => typeof group.active === 'string');

                    return validBooleanStrings && validGroupCount && allStrings;
                }
            ),
            { numRuns: 100 }
        );
    });

    test('should handle empty arrays correctly', async () => {
        const testData: Array<{ type: string }> = [];
        const result = statisticsService.groupBy(testData, 'type');

        // Property: Empty input should produce empty output
        expect(result).toEqual([]);
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(0);
    });

    test('should maintain type consistency across different property types', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    stringItems: fc.array(fc.record({
                        prop: fc.string({ minLength: 1, maxLength: 5 })
                    }), { minLength: 1, maxLength: 10 }),
                    numberItems: fc.array(fc.record({
                        prop: fc.integer({ min: 0, max: 10 })
                    }), { minLength: 1, maxLength: 10 }),
                    booleanItems: fc.array(fc.record({
                        prop: fc.boolean()
                    }), { minLength: 1, maxLength: 10 })
                }),
                async ({ stringItems, numberItems, booleanItems }) => {
                    const stringResult = statisticsService.groupBy(stringItems, 'prop');
                    const numberResult = statisticsService.groupBy(numberItems, 'prop');
                    const booleanResult = statisticsService.groupBy(booleanItems, 'prop');

                    // Property: Regardless of input type, all results should have
                    // the same structure with string property values and number counts
                    const stringStructureCorrect = stringResult.every(item =>
                        typeof item.prop === 'string' && typeof item.count === 'number'
                    );

                    const numberStructureCorrect = numberResult.every(item =>
                        typeof item.prop === 'string' && typeof item.count === 'number'
                    );

                    const booleanStructureCorrect = booleanResult.every(item =>
                        typeof item.prop === 'string' && typeof item.count === 'number'
                    );

                    return stringStructureCorrect && numberStructureCorrect && booleanStructureCorrect;
                }
            ),
            { numRuns: 100 }
        );
    });
});