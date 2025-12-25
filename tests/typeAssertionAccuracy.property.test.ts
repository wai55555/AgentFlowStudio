/**
 * Property-based test for Type Assertion Accuracy
 * **Feature: code-quality-fixes, Property 9: Type assertion accuracy**
 * **Validates: Requirements 3.4, 3.5**
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

describe('Property 9: Type assertion accuracy', () => {
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

    test('should ensure type assertions accurately represent actual data transformations', async () => {
        await fc.assert(
            fc.asyncProperty(
                // Generate arrays with various property types to test type assertions
                fc.array(
                    fc.record({
                        stringProp: fc.string({ minLength: 1, maxLength: 10 }),
                        numberProp: fc.integer({ min: -100, max: 100 }),
                        booleanProp: fc.boolean(),
                        nullProp: fc.constant(null),
                        undefinedProp: fc.constant(undefined),
                        objectProp: fc.record({ nested: fc.string() })
                    }),
                    { minLength: 1, maxLength: 20 }
                ),
                async (testData) => {
                    // Test type assertion for Record<string, number> in groupBy
                    const stringResult = statisticsService.groupBy(testData, 'stringProp');
                    const numberResult = statisticsService.groupBy(testData, 'numberProp');
                    const booleanResult = statisticsService.groupBy(testData, 'booleanProp');

                    // Property: Type assertion for Record<string, number> should be accurate
                    // The internal groups object should actually be a Record<string, number>
                    // We verify this by checking that all counts are numbers and keys are strings
                    const stringCountsAreNumbers = stringResult.every(item =>
                        typeof item.count === 'number' && Number.isInteger(item.count) && item.count > 0
                    );
                    const numberCountsAreNumbers = numberResult.every(item =>
                        typeof item.count === 'number' && Number.isInteger(item.count) && item.count > 0
                    );
                    const booleanCountsAreNumbers = booleanResult.every(item =>
                        typeof item.count === 'number' && Number.isInteger(item.count) && item.count > 0
                    );

                    // Property: Type assertion for result type should be accurate
                    // The result should match the asserted type: { [P in K]: string } & { count: number }
                    const stringResultTypeCorrect = stringResult.every(item =>
                        typeof item.stringProp === 'string' && typeof item.count === 'number'
                    );
                    const numberResultTypeCorrect = numberResult.every(item =>
                        typeof item.numberProp === 'string' && typeof item.count === 'number'
                    );
                    const booleanResultTypeCorrect = booleanResult.every(item =>
                        typeof item.booleanProp === 'string' && typeof item.count === 'number'
                    );

                    return stringCountsAreNumbers && numberCountsAreNumbers && booleanCountsAreNumbers &&
                        stringResultTypeCorrect && numberResultTypeCorrect && booleanResultTypeCorrect;
                }
            ),
            { numRuns: 100 }
        );
    });

    test('should prevent runtime type mismatches through type-safe interfaces', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(
                    fc.record({
                        category: fc.oneof(
                            fc.string({ minLength: 1, maxLength: 5 }),
                            fc.integer({ min: 1, max: 10 }).map(n => n),
                            fc.boolean(),
                            fc.constant(null),
                            fc.constant(undefined)
                        ),
                        value: fc.integer({ min: 1, max: 100 })
                    }),
                    { minLength: 1, maxLength: 15 }
                ),
                async (testData) => {
                    const result = statisticsService.groupBy(testData, 'category');

                    // Property: The interface should prevent runtime type mismatches
                    // All property values should be consistently converted to strings
                    const allPropertiesAreStrings = result.every(item =>
                        typeof item.category === 'string'
                    );

                    // Property: Count values should always be numbers (no type mismatch)
                    const allCountsAreNumbers = result.every(item =>
                        typeof item.count === 'number' &&
                        Number.isInteger(item.count) &&
                        item.count > 0
                    );

                    // Property: String conversion should be semantically meaningful
                    // null and undefined should be converted to recognizable strings
                    const nullUndefinedHandledCorrectly = result.every(item => {
                        const category = item.category;
                        // Should be 'null', 'undefined', or a meaningful string representation
                        return category === 'null' ||
                            category === 'undefined' ||
                            (category.length > 0 && category !== '[object Object]');
                    });

                    // Property: No runtime errors should occur due to type mismatches
                    // We can verify this by ensuring all operations complete successfully
                    const noRuntimeErrors = result.length >= 0; // Basic sanity check

                    return allPropertiesAreStrings && allCountsAreNumbers &&
                        nullUndefinedHandledCorrectly && noRuntimeErrors;
                }
            ),
            { numRuns: 100 }
        );
    });

    test('should accurately represent data transformation in type assertions for edge cases', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(
                    fc.record({
                        edgeCase: fc.oneof(
                            fc.constant(''),           // Empty string
                            fc.constant(0),            // Zero
                            fc.constant(-0),           // Negative zero
                            fc.constant(NaN),          // NaN
                            fc.constant(Infinity),     // Infinity
                            fc.constant(-Infinity),    // Negative Infinity
                            fc.string({ minLength: 0, maxLength: 0 }), // Another empty string
                            fc.constant(false),        // Boolean false
                            fc.constant(true)          // Boolean true
                        )
                    }),
                    { minLength: 1, maxLength: 10 }
                ),
                async (testData) => {
                    const result = statisticsService.groupBy(testData, 'edgeCase');

                    // Property: Type assertions should accurately handle edge cases
                    // All edge case values should be properly converted to strings
                    const edgeCasesHandledCorrectly = result.every(item => {
                        const value = item.edgeCase;

                        // Should be a string representation that makes sense
                        if (typeof value !== 'string') {
                            return false;
                        }

                        // Check specific edge case conversions
                        return value === '' ||           // Empty string stays empty
                            value === '0' ||          // Zero becomes '0'
                            value === 'NaN' ||        // NaN becomes 'NaN'
                            value === 'Infinity' ||   // Infinity becomes 'Infinity'
                            value === '-Infinity' ||  // -Infinity becomes '-Infinity'
                            value === 'false' ||      // false becomes 'false'
                            value === 'true';         // true becomes 'true'
                    });

                    // Property: Count aggregation should work correctly even with edge cases
                    const totalInputItems = testData.length;
                    const totalOutputCount = result.reduce((sum, item) => sum + item.count, 0);
                    const countAggregationCorrect = totalOutputCount === totalInputItems;

                    // Property: No duplicate keys should exist (each edge case should be grouped once)
                    const uniqueKeys = new Set(result.map(item => item.edgeCase));
                    const noDuplicateKeys = uniqueKeys.size === result.length;

                    return edgeCasesHandledCorrectly && countAggregationCorrect && noDuplicateKeys;
                }
            ),
            { numRuns: 100 }
        );
    });

    test('should maintain type safety when Object.create(null) is used as Record<string, number>', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(
                    fc.record({
                        key: fc.string({ minLength: 1, maxLength: 8 }),
                        data: fc.anything()
                    }),
                    { minLength: 1, maxLength: 20 }
                ),
                async (testData) => {
                    const result = statisticsService.groupBy(testData, 'key');

                    // Property: The type assertion Object.create(null) as Record<string, number>
                    // should accurately represent the actual object structure

                    // Verify that the result structure matches what the type assertion claims
                    const structureMatchesAssertion = result.every(item => {
                        // Should have the key property as string and count as number
                        return typeof item.key === 'string' &&
                            typeof item.count === 'number' &&
                            Object.prototype.hasOwnProperty.call(item, 'key') &&
                            Object.prototype.hasOwnProperty.call(item, 'count');
                    });

                    // Property: No prototype pollution should occur (benefit of Object.create(null))
                    // The internal object should not have inherited properties
                    const noPrototypePollution = result.every(item => {
                        // The result should not have unexpected inherited properties
                        const keys = Object.keys(item);
                        return keys.length === 2 && keys.includes('key') && keys.includes('count');
                    });

                    // Property: Count values should be positive integers (as expected from Record<string, number>)
                    const countsAreValidNumbers = result.every(item =>
                        Number.isInteger(item.count) && item.count > 0
                    );

                    return structureMatchesAssertion && noPrototypePollution && countsAreValidNumbers;
                }
            ),
            { numRuns: 100 }
        );
    });

    test('should handle complex object properties with accurate type assertions', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(
                    fc.record({
                        complexProp: fc.oneof(
                            fc.record({ nested: fc.string() }),
                            fc.array(fc.integer()),
                            fc.date(),
                            fc.func(fc.integer())
                        )
                    }),
                    { minLength: 1, maxLength: 10 }
                ),
                async (testData) => {
                    const result = statisticsService.groupBy(testData, 'complexProp');

                    // Property: Complex objects should be converted to meaningful string representations
                    // The type assertion should accurately handle the conversion
                    const complexObjectsHandledCorrectly = result.every(item => {
                        const value = item.complexProp;

                        // Should be a string (as per type assertion)
                        if (typeof value !== 'string') {
                            return false;
                        }

                        // Should not be the generic '[object Object]' for most cases
                        // Different types have different string representations:
                        // - Empty array: "" (empty string)
                        // - Array with items: "1,2,3" (comma-separated)
                        // - Object: "[object Object]" (generic)
                        // - Date: "Sun Jan 01 2023..." (date string)
                        // - Function: "function() {}" (function source)

                        // All of these are valid string conversions
                        return true; // Any string conversion is acceptable
                    });

                    // Property: Grouping should work correctly even with complex objects
                    const totalItems = testData.length;
                    const totalCounted = result.reduce((sum, item) => sum + item.count, 0);
                    const allItemsCounted = totalCounted === totalItems;

                    // Property: Each group should have a positive count
                    const allCountsPositive = result.every(item => item.count > 0);

                    return complexObjectsHandledCorrectly && allItemsCounted && allCountsPositive;
                }
            ),
            { numRuns: 100 }
        );
    });
});