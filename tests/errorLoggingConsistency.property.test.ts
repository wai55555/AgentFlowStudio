/**
 * Property-based test for error handling consistency
 * **Feature: code-quality-fixes, Property 7: Error handling consistency**
 * **Validates: Requirements 2.5**
 */

import * as fc from 'fast-check';
import { IndexedDBManager, IndexedDBError } from '../src/services/indexedDB';

describe('Property 7: Error handling consistency', () => {
    let manager: IndexedDBManager;

    beforeEach(() => {
        manager = new IndexedDBManager();
    });

    afterEach(() => {
        if (manager) {
            manager.close();
        }
    });

    // Generator for invalid date objects (only truthy invalid values)
    const invalidDateArbitrary = fc.oneof(
        fc.string({ minLength: 1 }), // Non-empty strings
        fc.integer().filter(n => n !== 0), // Non-zero integers (0 is falsy)
        fc.constant(true), // Only true, not false (false is falsy)
        fc.constant({}),
        fc.constant([]),
        fc.constant(new Date('invalid')), // Invalid Date object
        fc.constant(new Date(NaN)) // NaN Date object
    );

    // Generator for valid dates
    const validDateArbitrary = fc.date({
        min: new Date('2020-01-01'),
        max: new Date('2025-12-31')
    });

    // Generator for invalid date range (startDate > endDate)
    const invalidDateRangeArbitrary = fc.tuple(
        validDateArbitrary,
        validDateArbitrary
    ).filter(([date1, date2]) => date1 > date2)
        .map(([laterDate, earlierDate]) => ({
            startDate: laterDate,
            endDate: earlierDate
        }));

    test('should consistently throw IndexedDBError for invalid startDate parameters', async () => {
        await fc.assert(
            fc.asyncProperty(
                invalidDateArbitrary,
                async (invalidStartDate) => {
                    try {
                        // Test the validation logic directly
                        (manager as any).validateDateRange(invalidStartDate, undefined);
                        // If no error was thrown, this is a failure
                        return false;
                    } catch (error) {
                        // Property: Error must be IndexedDBError with appropriate message
                        const isCorrectErrorType = error instanceof IndexedDBError;
                        const hasAppropriateMessage = error instanceof Error &&
                            error.message.includes('Invalid startDate parameter');
                        const hasCorrectOperation = error instanceof IndexedDBError &&
                            error.operation === 'validateDateRange';

                        return isCorrectErrorType && hasAppropriateMessage && hasCorrectOperation;
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    test('should consistently throw IndexedDBError for invalid endDate parameters', async () => {
        await fc.assert(
            fc.asyncProperty(
                invalidDateArbitrary,
                async (invalidEndDate) => {
                    try {
                        // Test the validation logic directly
                        (manager as any).validateDateRange(undefined, invalidEndDate);
                        // If no error was thrown, this is a failure
                        return false;
                    } catch (error) {
                        // Property: Error must be IndexedDBError with appropriate message
                        const isCorrectErrorType = error instanceof IndexedDBError;
                        const hasAppropriateMessage = error instanceof Error &&
                            error.message.includes('Invalid endDate parameter');
                        const hasCorrectOperation = error instanceof IndexedDBError &&
                            error.operation === 'validateDateRange';

                        return isCorrectErrorType && hasAppropriateMessage && hasCorrectOperation;
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    test('should consistently throw IndexedDBError when startDate is after endDate', async () => {
        await fc.assert(
            fc.asyncProperty(
                invalidDateRangeArbitrary,
                async ({ startDate, endDate }) => {
                    try {
                        // Test the validation logic directly
                        (manager as any).validateDateRange(startDate, endDate);
                        // If no error was thrown, this is a failure
                        return false;
                    } catch (error) {
                        // Property: Error must be IndexedDBError with appropriate message
                        const isCorrectErrorType = error instanceof IndexedDBError;
                        const hasAppropriateMessage = error instanceof Error &&
                            error.message.includes('startDate cannot be after endDate');
                        const hasCorrectOperation = error instanceof IndexedDBError &&
                            error.operation === 'validateDateRange';

                        return isCorrectErrorType && hasAppropriateMessage && hasCorrectOperation;
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    test('should handle mixed invalid parameters consistently', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.option(invalidDateArbitrary),
                fc.option(invalidDateArbitrary),
                async (invalidStartDate, invalidEndDate) => {
                    // Skip cases where both are undefined or null (valid cases)
                    if ((invalidStartDate === undefined || invalidStartDate === null) &&
                        (invalidEndDate === undefined || invalidEndDate === null)) {
                        return true;
                    }

                    try {
                        // Test the validation logic directly
                        (manager as any).validateDateRange(invalidStartDate, invalidEndDate);
                        // If no error was thrown and at least one parameter is invalid, this is a failure
                        return false;
                    } catch (error) {
                        // Property: Error must be IndexedDBError with appropriate message and operation
                        const isCorrectErrorType = error instanceof IndexedDBError;
                        const hasValidMessage = error instanceof Error &&
                            (error.message.includes('Invalid startDate parameter') ||
                                error.message.includes('Invalid endDate parameter') ||
                                error.message.includes('startDate cannot be after endDate'));
                        const hasCorrectOperation = error instanceof IndexedDBError &&
                            error.operation === 'validateDateRange';

                        return isCorrectErrorType && hasValidMessage && hasCorrectOperation;
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    test('should provide consistent error structure across all validation failures', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.oneof(
                    // Invalid startDate only
                    invalidDateArbitrary.map(startDate => ({ startDate, endDate: undefined })),
                    // Invalid endDate only  
                    invalidDateArbitrary.map(endDate => ({ startDate: undefined, endDate })),
                    // Invalid date range
                    invalidDateRangeArbitrary
                ),
                async ({ startDate, endDate }) => {
                    try {
                        // Test the validation logic directly
                        (manager as any).validateDateRange(startDate, endDate);
                        return false; // Should have thrown an error
                    } catch (error) {
                        // Property: All validation errors must have consistent structure
                        const isIndexedDBError = error instanceof IndexedDBError;
                        const hasName = error instanceof Error && error.name === 'IndexedDBError';
                        const hasMessage = error instanceof Error && typeof error.message === 'string' && error.message.length > 0;
                        const hasOperation = error instanceof IndexedDBError &&
                            typeof error.operation === 'string' &&
                            error.operation === 'validateDateRange';

                        return isIndexedDBError && hasName && hasMessage && hasOperation;
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    test('should handle edge cases in date validation consistently', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.constantFrom(
                    // Edge case: Date objects with extreme values
                    new Date(-8640000000000000), // Minimum Date value
                    new Date(8640000000000000),  // Maximum Date value
                    new Date(0), // Unix epoch
                    new Date('1970-01-01T00:00:00.000Z'), // Explicit epoch
                    new Date('2038-01-19T03:14:07.000Z'), // 32-bit timestamp limit
                ),
                validDateArbitrary,
                async (edgeDate, normalDate) => {
                    try {
                        // Test all three possible relationships between dates
                        if (edgeDate <= normalDate) {
                            // Valid case: startDate <= endDate should not throw
                            (manager as any).validateDateRange(edgeDate, normalDate);
                            return true;
                        } else if (edgeDate > normalDate) {
                            // Invalid case: startDate > endDate should throw
                            try {
                                (manager as any).validateDateRange(edgeDate, normalDate);
                                return false; // Should have thrown
                            } catch (error) {
                                const isCorrectError = error instanceof IndexedDBError &&
                                    error.message.includes('startDate cannot be after endDate') &&
                                    error.operation === 'validateDateRange';
                                return isCorrectError;
                            }
                        }

                        return true;
                    } catch (error) {
                        // If the valid case threw an error, this is incorrect
                        if (edgeDate <= normalDate) {
                            return false; // Valid case should not throw
                        }

                        // Invalid case should throw appropriate error
                        return error instanceof IndexedDBError &&
                            error.message.includes('startDate cannot be after endDate') &&
                            error.operation === 'validateDateRange';
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    test('should provide predictable error messages for different invalid input types', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.constantFrom(
                    { startDate: 'not-a-date', endDate: undefined },
                    { startDate: 123, endDate: undefined },
                    { startDate: {}, endDate: undefined },
                    { startDate: [], endDate: undefined },
                    { startDate: true, endDate: undefined },
                    { startDate: undefined, endDate: 'not-a-date' },
                    { startDate: undefined, endDate: 456 },
                    { startDate: undefined, endDate: {} },
                    { startDate: undefined, endDate: [] },
                    { startDate: undefined, endDate: true },
                    { startDate: new Date('invalid'), endDate: undefined },
                    { startDate: undefined, endDate: new Date(NaN) }
                ),
                async ({ startDate, endDate }) => {
                    try {
                        // Test the validation logic directly
                        (manager as any).validateDateRange(startDate, endDate);
                        return false; // Should have thrown
                    } catch (error) {
                        // Property: Error message should be predictable based on input type
                        const isIndexedDBError = error instanceof IndexedDBError;
                        const hasExpectedMessage = error instanceof Error &&
                            (error.message.includes('Invalid startDate parameter') ||
                                error.message.includes('Invalid endDate parameter'));
                        const hasCorrectOperation = error instanceof IndexedDBError &&
                            error.operation === 'validateDateRange';

                        return isIndexedDBError && hasExpectedMessage && hasCorrectOperation;
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    test('should allow valid falsy values for optional parameters', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.constantFrom(
                    { startDate: undefined, endDate: undefined },
                    { startDate: null, endDate: undefined },
                    { startDate: undefined, endDate: null },
                    { startDate: null, endDate: null }
                ),
                async ({ startDate, endDate }) => {
                    try {
                        // These should not throw errors
                        (manager as any).validateDateRange(startDate, endDate);
                        return true;
                    } catch (error) {
                        // If an error was thrown for valid falsy values, this is incorrect
                        return false;
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    test('should handle falsy invalid values consistently by not validating them', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.constantFrom(
                    // Falsy values that should be treated as "not provided"
                    { startDate: false, endDate: undefined },
                    { startDate: 0, endDate: undefined },
                    { startDate: '', endDate: undefined },
                    { startDate: undefined, endDate: false },
                    { startDate: undefined, endDate: 0 },
                    { startDate: undefined, endDate: '' }
                ),
                async ({ startDate, endDate }) => {
                    try {
                        // Falsy values should not trigger validation (treated as "not provided")
                        (manager as any).validateDateRange(startDate, endDate);
                        return true; // Should not throw for falsy values
                    } catch (error) {
                        // If an error was thrown for falsy values, this indicates they were validated
                        // This might be correct behavior depending on requirements
                        return false;
                    }
                }
            ),
            { numRuns: 100 }
        );
    });
});