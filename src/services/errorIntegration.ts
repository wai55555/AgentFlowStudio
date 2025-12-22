/**
 * Error Integration Utilities
 * Provides utilities to integrate existing services with centralized error handling
 */

import { errorHandler, ErrorCategory, ErrorLevel } from './errorHandler';

/**
 * Wrapper function to handle errors from existing services
 */
export async function withErrorHandling<T>(
    operation: () => Promise<T>,
    category: ErrorCategory,
    operationName: string,
    context?: Record<string, any>
): Promise<T> {
    try {
        return await operation();
    } catch (error) {
        const handled = await errorHandler.handleError(
            error instanceof Error ? error : new Error(String(error)),
            category,
            {
                operation: operationName,
                additionalData: context
            }
        );

        // If error was not recovered, re-throw it
        if (!handled) {
            throw error;
        }

        // If recovered, try the operation again (simple retry)
        try {
            return await operation();
        } catch (retryError) {
            // If retry also fails, throw the original error
            throw error;
        }
    }
}

/**
 * Decorator for service methods to add error handling
 */
export function handleErrors(category: ErrorCategory, operationName?: string) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;
        const opName = operationName || `${target.constructor.name}.${propertyKey}`;

        descriptor.value = async function (...args: any[]) {
            return withErrorHandling(
                () => originalMethod.apply(this, args),
                category,
                opName,
                { args: args.length > 0 ? args : undefined }
            );
        };

        return descriptor;
    };
}

/**
 * Enhanced error classes that integrate with centralized error handling
 */
export class EnhancedError extends Error {
    constructor(
        message: string,
        public category: ErrorCategory,
        public operation?: string,
        public context?: Record<string, any>,
        public level: ErrorLevel = ErrorLevel.ERROR
    ) {
        super(message);
        this.name = this.constructor.name;

        // Automatically log the error when created
        errorHandler.logError(message, category, this, {
            operation,
            additionalData: context
        }, level).catch(console.error);
    }
}

/**
 * Storage-specific enhanced error
 */
export class EnhancedStorageError extends EnhancedError {
    constructor(message: string, operation?: string, context?: Record<string, any>) {
        super(message, ErrorCategory.STORAGE, operation, context);
    }
}

/**
 * API-specific enhanced error
 */
export class EnhancedAPIError extends EnhancedError {
    constructor(message: string, operation?: string, context?: Record<string, any>) {
        super(message, ErrorCategory.API, operation, context);
    }
}

/**
 * Agent-specific enhanced error
 */
export class EnhancedAgentError extends EnhancedError {
    constructor(message: string, operation?: string, context?: Record<string, any>) {
        super(message, ErrorCategory.AGENT, operation, context);
    }
}

/**
 * Task-specific enhanced error
 */
export class EnhancedTaskError extends EnhancedError {
    constructor(message: string, operation?: string, context?: Record<string, any>) {
        super(message, ErrorCategory.TASK, operation, context);
    }
}

/**
 * Workflow-specific enhanced error
 */
export class EnhancedWorkflowError extends EnhancedError {
    constructor(message: string, operation?: string, context?: Record<string, any>) {
        super(message, ErrorCategory.WORKFLOW, operation, context);
    }
}

/**
 * Worker-specific enhanced error
 */
export class EnhancedWorkerError extends EnhancedError {
    constructor(message: string, operation?: string, context?: Record<string, any>) {
        super(message, ErrorCategory.WORKER, operation, context);
    }
}

/**
 * Utility to convert existing errors to enhanced errors
 */
export function enhanceError(
    error: Error,
    category: ErrorCategory,
    operation?: string,
    context?: Record<string, any>
): EnhancedError {
    if (error instanceof EnhancedError) {
        return error;
    }

    return new EnhancedError(
        error.message,
        category,
        operation,
        context
    );
}

/**
 * Promise wrapper that automatically handles errors
 */
export function handlePromise<T>(
    promise: Promise<T>,
    category: ErrorCategory,
    operation: string,
    context?: Record<string, any>
): Promise<T> {
    return promise.catch(error => {
        throw enhanceError(error, category, operation, context);
    });
}

/**
 * Async function wrapper with automatic error handling
 */
export function withAsyncErrorHandling<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    category: ErrorCategory,
    operation: string
) {
    return async (...args: T): Promise<R> => {
        try {
            return await fn(...args);
        } catch (error) {
            throw enhanceError(
                error instanceof Error ? error : new Error(String(error)),
                category,
                operation,
                { args }
            );
        }
    };
}

/**
 * Batch error handling for multiple operations
 */
export async function handleBatch<T>(
    operations: Array<() => Promise<T>>,
    category: ErrorCategory,
    batchName: string
): Promise<Array<{ success: boolean; result?: T; error?: Error }>> {
    const results: Array<{ success: boolean; result?: T; error?: Error }> = [];

    for (let i = 0; i < operations.length; i++) {
        try {
            const result = await operations[i]();
            results.push({ success: true, result });
        } catch (error) {
            const enhancedError = enhanceError(
                error instanceof Error ? error : new Error(String(error)),
                category,
                `${batchName}[${i}]`
            );
            results.push({ success: false, error: enhancedError });
        }
    }

    return results;
}

/**
 * Error boundary utility for React components
 */
export class ErrorBoundaryHandler {
    static handleError(error: Error, errorInfo: { componentStack: string }) {
        errorHandler.logError(
            `React component error: ${error.message}`,
            ErrorCategory.SYSTEM,
            error,
            {
                operation: 'react-error-boundary',
                additionalData: {
                    componentStack: errorInfo.componentStack
                }
            },
            ErrorLevel.CRITICAL
        );
    }
}

/**
 * Performance monitoring with error tracking
 */
export class PerformanceMonitor {
    private static timers: Map<string, number> = new Map();

    static startTimer(operation: string): void {
        this.timers.set(operation, performance.now());
    }

    static endTimer(operation: string, category: ErrorCategory, threshold?: number): void {
        const startTime = this.timers.get(operation);
        if (!startTime) {
            return;
        }

        const duration = performance.now() - startTime;
        this.timers.delete(operation);

        // Log performance warning if operation took too long
        if (threshold && duration > threshold) {
            errorHandler.logWarning(
                `Operation ${operation} took ${duration.toFixed(2)}ms (threshold: ${threshold}ms)`,
                category,
                {
                    operation: 'performance-monitoring',
                    additionalData: {
                        duration,
                        threshold,
                        operationName: operation
                    }
                }
            );
        }
    }

    static async measureAsync<T>(
        operation: string,
        category: ErrorCategory,
        fn: () => Promise<T>,
        threshold?: number
    ): Promise<T> {
        this.startTimer(operation);
        try {
            const result = await fn();
            this.endTimer(operation, category, threshold);
            return result;
        } catch (error) {
            this.endTimer(operation, category, threshold);
            throw error;
        }
    }
}