/**
 * Property-Based Tests: Error Logging Consistency
 * **Feature: ai-agent-orchestration, Property 10: Error logging consistency**
 * **Validates: Requirements 4.4**
 */

import fc from 'fast-check';
import { errorHandler, ErrorCategory, ErrorLevel } from '../src/services/errorHandler';

describe('Property Tests: Error Logging Consistency', () => {
    // Mock console methods to capture logs
    let consoleLogs: any[] = [];
    let originalConsoleError: any;
    let originalConsoleWarn: any;
    let originalConsoleInfo: any;

    beforeEach(async () => {
        // Initialize error handler before each test
        await errorHandler.initialize();

        // Clear any existing notifications
        errorHandler.clearNotifications();

        // Mock console methods to capture logs
        consoleLogs = [];
        originalConsoleError = console.error;
        originalConsoleWarn = console.warn;
        originalConsoleInfo = console.info;

        console.error = (...args: any[]) => {
            consoleLogs.push({ level: 'error', args });
        };
        console.warn = (...args: any[]) => {
            consoleLogs.push({ level: 'warn', args });
        };
        console.info = (...args: any[]) => {
            consoleLogs.push({ level: 'info', args });
        };
    });

    afterEach(() => {
        // Clean up after each test
        errorHandler.clearNotifications();

        // Restore console methods
        console.error = originalConsoleError;
        console.warn = originalConsoleWarn;
        console.info = originalConsoleInfo;
    });

    /**
     * Property 10: Error logging consistency
     * For any system error, the error should be logged with complete details for debugging purposes
     */
    it('Property 10: Error logging consistency', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    message: fc.string({ minLength: 1, maxLength: 200 }),
                    category: fc.constantFrom(...Object.values(ErrorCategory)),
                    level: fc.constantFrom(...Object.values(ErrorLevel)),
                    errorName: fc.string({ minLength: 1, maxLength: 50 }),
                    errorMessage: fc.string({ minLength: 1, maxLength: 100 }),
                    contextData: fc.record({
                        operation: fc.string({ minLength: 1, maxLength: 50 }),
                        agentId: fc.option(fc.string({ minLength: 1, maxLength: 20 })),
                        taskId: fc.option(fc.string({ minLength: 1, maxLength: 20 })),
                        additionalData: fc.option(fc.record({
                            key1: fc.string(),
                            key2: fc.integer(),
                            key3: fc.boolean()
                        }))
                    })
                }),
                async ({ message, category, level, errorName, errorMessage, contextData }) => {
                    // Clear previous logs
                    consoleLogs = [];

                    // Create a test error
                    const testError = new Error(errorMessage);
                    testError.name = errorName;

                    // Log the error
                    await errorHandler.logError(message, category, testError, contextData, level);

                    // Property: Error should be logged to console with complete details
                    const expectedLogLevel = level === ErrorLevel.INFO ? 'info' :
                        level === ErrorLevel.WARN ? 'warn' : 'error';

                    const matchingLog = consoleLogs.find(log =>
                        log.level === expectedLogLevel &&
                        log.args[0] &&
                        log.args[0].includes(message)
                    );

                    // Verify the error was logged to console
                    expect(matchingLog).toBeDefined();

                    if (matchingLog) {
                        // Verify error details are included in console log
                        expect(matchingLog.args[0]).toContain(message);
                        expect(matchingLog.args[0]).toContain(category);

                        // For error levels, verify error object is passed
                        if (level === ErrorLevel.ERROR || level === ErrorLevel.CRITICAL) {
                            expect(matchingLog.args[1]).toBeDefined();
                            expect(matchingLog.args[1].message).toBe(errorMessage);
                        }

                        // Verify context is passed
                        expect(matchingLog.args[matchingLog.args.length - 1]).toBeDefined();
                        expect(matchingLog.args[matchingLog.args.length - 1].operation).toBe(contextData.operation);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Error notification creation for critical errors
     * Critical and error level logs should create user notifications
     */
    it('Property: Error notification creation for critical errors', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    message: fc.string({ minLength: 1, maxLength: 100 }),
                    category: fc.constantFrom(...Object.values(ErrorCategory)),
                    level: fc.constantFrom(ErrorLevel.ERROR, ErrorLevel.CRITICAL)
                }),
                async ({ message, category, level }) => {
                    // Clear notifications
                    errorHandler.clearNotifications();

                    // Log an error
                    await errorHandler.logError(message, category, new Error('Test error'), {}, level);

                    // Property: Critical and error level logs should create notifications
                    const notifications = errorHandler.getNotifications();

                    expect(notifications.length).toBeGreaterThan(0);

                    // Check that at least one notification was created for error/critical levels
                    const hasErrorNotification = notifications.some(n => n.level === 'error');
                    expect(hasErrorNotification).toBe(true);
                }
            ),
            { numRuns: 50 }
        );
    });

    /**
     * Property: Console log level consistency
     * Error logs should use appropriate console methods based on level
     */
    it('Property: Console log level consistency', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    message: fc.string({ minLength: 1, maxLength: 100 }),
                    category: fc.constantFrom(...Object.values(ErrorCategory)),
                    level: fc.constantFrom(...Object.values(ErrorLevel))
                }),
                async ({ message, category, level }) => {
                    // Clear previous logs
                    consoleLogs = [];

                    // Log an error with specific level
                    await errorHandler.logError(message, category, new Error('Test'), {}, level);

                    // Property: Console method should match error level
                    const expectedLogLevel = level === ErrorLevel.INFO ? 'info' :
                        level === ErrorLevel.WARN ? 'warn' : 'error';

                    const matchingLog = consoleLogs.find(log =>
                        log.level === expectedLogLevel &&
                        log.args[0] &&
                        log.args[0].includes(message)
                    );

                    expect(matchingLog).toBeDefined();
                    expect(matchingLog?.level).toBe(expectedLogLevel);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Error context preservation
     * Error context should be preserved in console logs
     */
    it('Property: Error context preservation', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    message: fc.string({ minLength: 1, maxLength: 100 }),
                    category: fc.constantFrom(...Object.values(ErrorCategory)),
                    operation: fc.string({ minLength: 1, maxLength: 50 }),
                    agentId: fc.option(fc.string({ minLength: 1, maxLength: 20 })),
                    taskId: fc.option(fc.string({ minLength: 1, maxLength: 20 }))
                }),
                async ({ message, category, operation, agentId, taskId }) => {
                    // Clear previous logs
                    consoleLogs = [];

                    const context = {
                        operation,
                        agentId: agentId || undefined,
                        taskId: taskId || undefined
                    };

                    // Log an error with context
                    await errorHandler.logError(message, category, new Error('Test'), context);

                    // Property: Context should be preserved in console logs
                    const errorLog = consoleLogs.find(log =>
                        log.level === 'error' &&
                        log.args[0] &&
                        log.args[0].includes(message)
                    );

                    expect(errorLog).toBeDefined();

                    if (errorLog) {
                        const contextArg = errorLog.args[errorLog.args.length - 1];
                        expect(contextArg).toBeDefined();
                        expect(contextArg.operation).toBe(operation);

                        if (agentId) {
                            expect(contextArg.agentId).toBe(agentId);
                        }

                        if (taskId) {
                            expect(contextArg.taskId).toBe(taskId);
                        }
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Error message formatting consistency
     * Error messages should be consistently formatted in console logs
     */
    it('Property: Error message formatting consistency', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    message: fc.string({ minLength: 1, maxLength: 100 }),
                    category: fc.constantFrom(...Object.values(ErrorCategory)),
                    level: fc.constantFrom(...Object.values(ErrorLevel))
                }),
                async ({ message, category, level }) => {
                    // Clear previous logs
                    consoleLogs = [];

                    // Log an error
                    await errorHandler.logError(message, category, new Error('Test'), {}, level);

                    // Property: Console log should contain formatted message with level and category
                    const expectedLogLevel = level === ErrorLevel.INFO ? 'info' :
                        level === ErrorLevel.WARN ? 'warn' : 'error';

                    const matchingLog = consoleLogs.find(log =>
                        log.level === expectedLogLevel &&
                        log.args[0] &&
                        log.args[0].includes(message)
                    );

                    expect(matchingLog).toBeDefined();

                    if (matchingLog) {
                        const logMessage = matchingLog.args[0];

                        // Verify message format includes level and category
                        expect(logMessage).toContain(`[${level.toUpperCase()}]`);
                        expect(logMessage).toContain(category);
                        expect(logMessage).toContain(message);

                        // Critical errors should have special formatting
                        if (level === ErrorLevel.CRITICAL) {
                            expect(logMessage).toContain('🚨');
                        }
                    }
                }
            ),
            { numRuns: 100 }
        );
    });
});