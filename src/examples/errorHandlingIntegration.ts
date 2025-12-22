/**
 * Example of Error Handling Integration
 * Demonstrates how to integrate the centralized error handling system with existing services
 */

import {
    errorHandler,
    ErrorCategory
} from '../services/errorHandler';
import { LocalStorageManager } from '../services/localStorage';
import { Agent } from '../types/agent';

/**
 * Enhanced LocalStorage Manager with integrated error handling
 */
export class EnhancedLocalStorageManager extends LocalStorageManager {

    /**
     * Save agents with enhanced error handling and performance monitoring
     */
    async saveAgents(agents: Agent[]): Promise<void> {
        try {
            await super.saveAgents(agents);

            // Log successful operation
            await errorHandler.logInfo(
                `Successfully saved ${agents.length} agents to storage`,
                ErrorCategory.STORAGE,
                {
                    operation: 'saveAgents',
                    additionalData: { agentCount: agents.length }
                }
            );
        } catch (error) {
            await errorHandler.handleError(
                error instanceof Error ? error : new Error(String(error)),
                ErrorCategory.STORAGE,
                { operation: 'saveAgents' }
            );
            throw error;
        }
    }

    /**
     * Load agents with error handling and fallback
     */
    async loadAgentsWithFallback(): Promise<Agent[]> {
        try {
            const agents = this.loadAgents();

            await errorHandler.logInfo(
                `Successfully loaded ${agents.length} agents from storage`,
                ErrorCategory.STORAGE,
                {
                    operation: 'loadAgents',
                    additionalData: { agentCount: agents.length }
                }
            );

            return agents;
        } catch (error) {
            await errorHandler.handleError(
                error instanceof Error ? error : new Error(String(error)),
                ErrorCategory.STORAGE,
                { operation: 'loadAgents' }
            );
            return []; // Return empty array as fallback
        }
    }

    /**
     * Export configuration with comprehensive error handling
     */
    async exportConfigurationSafely(): Promise<string | null> {
        try {
            const config = this.exportConfiguration();

            await errorHandler.logInfo(
                'Configuration exported successfully',
                ErrorCategory.STORAGE,
                { operation: 'exportConfiguration' }
            );

            return config;
        } catch (error) {
            const handled = await errorHandler.handleError(
                error instanceof Error ? error : new Error(String(error)),
                ErrorCategory.STORAGE,
                { operation: 'exportConfiguration' }
            );

            if (!handled) {
                // Create user-friendly error notification
                throw new Error(
                    'Failed to export configuration. Please try again.'
                );
            }

            return null; // Return null if error was handled but export still failed
        }
    }
}

/**
 * Example service that demonstrates error handling patterns
 */
export class ExampleService {
    constructor() {
        // Initialize service
    }

    /**
     * Batch operation with error handling
     */
    async processBatchOperations(operations: Array<() => Promise<any>>): Promise<void> {
        // const results = await handleBatch(
        //     operations,
        //     ErrorCategory.SYSTEM,
        //     'processBatchOperations'
        // );

        // Simplified implementation
        const results = await Promise.allSettled(operations.map(op => op()));
        const failures = results.filter(r => r.status === 'rejected');
        const successes = results.filter(r => r.status === 'fulfilled');

        await errorHandler.logInfo(
            `Batch processing completed: ${successes.length} succeeded, ${failures.length} failed`,
            ErrorCategory.SYSTEM,
            {
                operation: 'processBatchOperations',
                additionalData: {
                    totalOperations: operations.length,
                    successes: successes.length,
                    failures: failures.length
                }
            }
        );

        if (failures.length > 0) {
            throw new Error(`${failures.length} operations failed in batch processing`);
        }
    }

    /**
     * Demonstrate recovery mechanism
     */
    async demonstrateRecovery(): Promise<void> {
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            try {
                // Simulate an operation that might fail
                if (Math.random() < 0.7) { // 70% chance of failure
                    throw new Error('Simulated operation failure');
                }

                await errorHandler.logInfo(
                    'Operation succeeded after recovery',
                    ErrorCategory.SYSTEM,
                    {
                        operation: 'demonstrateRecovery',
                        additionalData: { attempts: attempts + 1 }
                    }
                );
                return;

            } catch (error) {
                attempts++;

                const recovered = await errorHandler.handleError(
                    error instanceof Error ? error : new Error(String(error)),
                    ErrorCategory.SYSTEM,
                    {
                        operation: 'demonstrateRecovery',
                        additionalData: {
                            attempt: attempts,
                            maxAttempts
                        }
                    }
                );

                if (!recovered && attempts >= maxAttempts) {
                    throw new Error(`Operation failed after ${maxAttempts} attempts`);
                }

                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
            }
        }
    }
}

/**
 * Initialize error handling integration example
 */
export async function initializeErrorHandlingExample(): Promise<void> {
    try {
        // Initialize error handler
        await errorHandler.initialize();

        // Create example service
        const exampleService = new ExampleService();

        // Demonstrate various error handling patterns
        await errorHandler.logInfo(
            'Error handling integration example initialized',
            ErrorCategory.SYSTEM,
            { operation: 'initializeExample' }
        );

        // Example of successful operation
        const enhancedStorage = new EnhancedLocalStorageManager();
        await enhancedStorage.loadAgentsWithFallback();

        // Example of batch processing
        await exampleService.processBatchOperations([
            async () => Promise.resolve('Operation 1'),
            async () => Promise.resolve('Operation 2'),
            async () => Promise.resolve('Operation 3')
        ]);

        // Example of recovery mechanism
        await exampleService.demonstrateRecovery();

    } catch (error) {
        await errorHandler.handleError(
            error instanceof Error ? error : new Error(String(error)),
            ErrorCategory.SYSTEM,
            { operation: 'initializeExample' }
        );
    }
}

// Export for use in other parts of the application
// export { handleBatch } from '../services/errorIntegration';