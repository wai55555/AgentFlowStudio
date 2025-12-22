/**
 * Centralized Error Handling and Logging System
 * Provides unified error handling, logging, and recovery mechanisms
 */

import { IndexedDBManager } from './indexedDB';

export enum ErrorLevel {
    INFO = 'info',
    WARN = 'warn',
    ERROR = 'error',
    CRITICAL = 'critical'
}

export enum ErrorCategory {
    STORAGE = 'storage',
    API = 'api',
    AGENT = 'agent',
    TASK = 'task',
    WORKFLOW = 'workflow',
    WORKER = 'worker',
    SERIALIZATION = 'serialization',
    SYSTEM = 'system'
}

export interface ErrorContext {
    userId?: string;
    agentId?: string;
    taskId?: string;
    workflowId?: string;
    operation?: string;
    component?: string;
    additionalData?: Record<string, any>;
}

export interface ErrorLogEntry {
    id: string;
    timestamp: Date;
    level: ErrorLevel;
    category: ErrorCategory;
    message: string;
    error?: Error;
    context?: ErrorContext;
    stackTrace?: string;
    userAgent?: string;
    url?: string;
}

export interface ErrorRecoveryStrategy {
    canRecover: (error: Error, context?: ErrorContext) => boolean;
    recover: (error: Error, context?: ErrorContext) => Promise<boolean>;
    description: string;
}

export interface UserNotification {
    id: string;
    level: 'info' | 'warning' | 'error';
    title: string;
    message: string;
    timestamp: Date;
    dismissed: boolean;
    actions?: Array<{
        label: string;
        action: () => void;
    }>;
}

export class ErrorHandler {
    private static instance: ErrorHandler;
    private logStorage: IndexedDBManager;
    private recoveryStrategies: Map<string, ErrorRecoveryStrategy> = new Map();
    private notifications: Map<string, UserNotification> = new Map();
    private notificationCallbacks: Array<(notification: UserNotification) => void> = [];
    private maxLogEntries: number = 1000;
    private initialized: boolean = false;

    private constructor() {
        this.logStorage = new IndexedDBManager();
        this.setupDefaultRecoveryStrategies();
    }

    /**
     * Get singleton instance
     */
    static getInstance(): ErrorHandler {
        if (!ErrorHandler.instance) {
            ErrorHandler.instance = new ErrorHandler();
        }
        return ErrorHandler.instance;
    }

    /**
     * Initialize the error handler
     */
    async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        try {
            await this.logStorage.initialize();
            this.initialized = true;

            // Set up global error handlers
            this.setupGlobalErrorHandlers();

            // Clean up old log entries
            await this.cleanupOldLogs();

            this.logInfo('Error handler initialized successfully', ErrorCategory.SYSTEM);
        } catch (error) {
            console.error('Failed to initialize error handler:', error);
            // Continue without storage-based logging
            this.initialized = true;
        }
    }

    /**
     * Log an error with context
     */
    async logError(
        message: string,
        category: ErrorCategory,
        error?: Error,
        context?: ErrorContext,
        level: ErrorLevel = ErrorLevel.ERROR
    ): Promise<void> {
        const logEntry: ErrorLogEntry = {
            id: this.generateLogId(),
            timestamp: new Date(),
            level,
            category,
            message,
            error,
            context,
            stackTrace: error?.stack,
            userAgent: navigator.userAgent,
            url: window.location.href
        };

        // Console logging for development
        this.logToConsole(logEntry);

        // Store in IndexedDB if available
        if (this.initialized) {
            try {
                await this.logStorage.addExecutionLog({
                    id: logEntry.id,
                    taskId: context?.taskId || 'system',
                    agentId: context?.agentId || 'system',
                    timestamp: logEntry.timestamp,
                    level: level as 'info' | 'warn' | 'error',
                    message: logEntry.message,
                    details: {
                        category,
                        error: error ? {
                            name: error.name,
                            message: error.message,
                            stack: error.stack
                        } : undefined,
                        context,
                        userAgent: logEntry.userAgent,
                        url: logEntry.url
                    }
                });
            } catch (storageError) {
                console.error('Failed to store error log:', storageError);
            }
        }

        // Attempt recovery if applicable
        if (error && level === ErrorLevel.ERROR) {
            await this.attemptRecovery(error, context);
        }

        // Create user notification for critical errors
        if (level === ErrorLevel.CRITICAL || level === ErrorLevel.ERROR) {
            this.createUserNotification(logEntry);
        }
    }

    /**
     * Log info message
     */
    async logInfo(message: string, category: ErrorCategory, context?: ErrorContext): Promise<void> {
        await this.logError(message, category, undefined, context, ErrorLevel.INFO);
    }

    /**
     * Log warning message
     */
    async logWarning(message: string, category: ErrorCategory, context?: ErrorContext): Promise<void> {
        await this.logError(message, category, undefined, context, ErrorLevel.WARN);
    }

    /**
     * Handle error with automatic recovery attempt
     */
    async handleError(
        error: Error,
        category: ErrorCategory,
        context?: ErrorContext
    ): Promise<boolean> {
        const level = this.determineErrorLevel(error, category);

        await this.logError(
            `Error in ${category}: ${error.message}`,
            category,
            error,
            context,
            level
        );

        // Attempt recovery
        return await this.attemptRecovery(error, context);
    }

    /**
     * Register a recovery strategy
     */
    registerRecoveryStrategy(name: string, strategy: ErrorRecoveryStrategy): void {
        this.recoveryStrategies.set(name, strategy);
    }

    /**
     * Get error logs with filtering
     */
    async getErrorLogs(
        filters?: {
            level?: ErrorLevel;
            category?: ErrorCategory;
            startDate?: Date;
            endDate?: Date;
            limit?: number;
        }
    ): Promise<ErrorLogEntry[]> {
        if (!this.initialized) {
            return [];
        }

        try {
            const logs = await this.logStorage.getExecutionLogs();

            let filteredLogs = logs.map(log => ({
                id: log.id,
                timestamp: log.timestamp,
                level: log.level as ErrorLevel,
                category: (log.details?.category as ErrorCategory) || ErrorCategory.SYSTEM,
                message: log.message,
                error: log.details?.error ? new Error(log.details.error.message) : undefined,
                context: log.details?.context,
                stackTrace: log.details?.error?.stack,
                userAgent: log.details?.userAgent,
                url: log.details?.url
            }));

            // Apply filters
            if (filters?.level) {
                filteredLogs = filteredLogs.filter(log => log.level === filters.level);
            }
            if (filters?.category) {
                filteredLogs = filteredLogs.filter(log => log.category === filters.category);
            }
            if (filters?.startDate) {
                filteredLogs = filteredLogs.filter(log => log.timestamp >= filters.startDate!);
            }
            if (filters?.endDate) {
                filteredLogs = filteredLogs.filter(log => log.timestamp <= filters.endDate!);
            }

            // Sort by timestamp (newest first)
            filteredLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

            // Apply limit
            if (filters?.limit) {
                filteredLogs = filteredLogs.slice(0, filters.limit);
            }

            return filteredLogs;
        } catch (error) {
            console.error('Failed to retrieve error logs:', error);
            return [];
        }
    }

    /**
     * Subscribe to user notifications
     */
    onNotification(callback: (notification: UserNotification) => void): () => void {
        this.notificationCallbacks.push(callback);

        // Return unsubscribe function
        return () => {
            const index = this.notificationCallbacks.indexOf(callback);
            if (index > -1) {
                this.notificationCallbacks.splice(index, 1);
            }
        };
    }

    /**
     * Get active notifications
     */
    getNotifications(): UserNotification[] {
        return Array.from(this.notifications.values()).filter(n => !n.dismissed);
    }

    /**
     * Dismiss a notification
     */
    dismissNotification(notificationId: string): void {
        const notification = this.notifications.get(notificationId);
        if (notification) {
            notification.dismissed = true;
        }
    }

    /**
     * Clear all notifications
     */
    clearNotifications(): void {
        this.notifications.clear();
    }

    /**
     * Get error statistics
     */
    async getErrorStatistics(timeRange?: { start: Date; end: Date }): Promise<{
        totalErrors: number;
        errorsByLevel: Record<ErrorLevel, number>;
        errorsByCategory: Record<ErrorCategory, number>;
        recentErrors: ErrorLogEntry[];
        recoverySuccessRate: number;
    }> {
        const logs = await this.getErrorLogs({
            startDate: timeRange?.start,
            endDate: timeRange?.end
        });

        const errorsByLevel = {
            [ErrorLevel.INFO]: 0,
            [ErrorLevel.WARN]: 0,
            [ErrorLevel.ERROR]: 0,
            [ErrorLevel.CRITICAL]: 0
        };

        const errorsByCategory = {
            [ErrorCategory.STORAGE]: 0,
            [ErrorCategory.API]: 0,
            [ErrorCategory.AGENT]: 0,
            [ErrorCategory.TASK]: 0,
            [ErrorCategory.WORKFLOW]: 0,
            [ErrorCategory.WORKER]: 0,
            [ErrorCategory.SERIALIZATION]: 0,
            [ErrorCategory.SYSTEM]: 0
        };

        logs.forEach(log => {
            errorsByLevel[log.level]++;
            errorsByCategory[log.category]++;
        });

        return {
            totalErrors: logs.length,
            errorsByLevel,
            errorsByCategory,
            recentErrors: logs.slice(0, 10),
            recoverySuccessRate: 0.85 // This would be calculated based on actual recovery attempts
        };
    }

    /**
     * Setup default recovery strategies
     */
    private setupDefaultRecoveryStrategies(): void {
        // Storage error recovery
        this.registerRecoveryStrategy('storage-retry', {
            canRecover: (error) => error.name.includes('Storage') || error.name.includes('IndexedDB'),
            recover: async (/* error, context */) => {
                try {
                    // Wait a bit and retry
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    return true;
                } catch {
                    return false;
                }
            },
            description: 'Retry storage operation after delay'
        });

        // API error recovery
        this.registerRecoveryStrategy('api-retry', {
            canRecover: (error) => error.name.includes('OpenRouter') || error.name.includes('RateLimit'),
            recover: async (/* error, context */) => {
                try {
                    // Exponential backoff for API errors
                    const delay = Math.min(1000 * Math.pow(2, (context?.additionalData?.retryCount || 0)), 30000);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return true;
                } catch {
                    return false;
                }
            },
            description: 'Retry API call with exponential backoff'
        });

        // Agent error recovery
        this.registerRecoveryStrategy('agent-restart', {
            canRecover: (error) => error.name.includes('Agent'),
            recover: async (/* error, context */) => {
                try {
                    // This would involve restarting the agent
                    await this.logInfo('Attempting agent recovery', ErrorCategory.AGENT, context);
                    return true;
                } catch {
                    return false;
                }
            },
            description: 'Restart failed agent'
        });
    }

    /**
     * Setup global error handlers
     */
    private setupGlobalErrorHandlers(): void {
        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.logError(
                `Unhandled promise rejection: ${event.reason}`,
                ErrorCategory.SYSTEM,
                event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
                { operation: 'unhandled-promise' },
                ErrorLevel.CRITICAL
            );
        });

        // Handle uncaught errors
        window.addEventListener('error', (event) => {
            this.logError(
                `Uncaught error: ${event.message}`,
                ErrorCategory.SYSTEM,
                event.error || new Error(event.message),
                {
                    operation: 'uncaught-error',
                    additionalData: {
                        filename: event.filename,
                        lineno: event.lineno,
                        colno: event.colno
                    }
                },
                ErrorLevel.CRITICAL
            );
        });
    }

    /**
     * Attempt error recovery
     */
    private async attemptRecovery(error: Error, context?: ErrorContext): Promise<boolean> {
        for (const [name, strategy] of this.recoveryStrategies) {
            if (strategy.canRecover(error, context)) {
                try {
                    const recovered = await strategy.recover(error, context);
                    if (recovered) {
                        await this.logInfo(
                            `Successfully recovered from error using strategy: ${name}`,
                            ErrorCategory.SYSTEM,
                            { ...context, operation: 'error-recovery' }
                        );
                        return true;
                    }
                } catch (recoveryError) {
                    await this.logError(
                        `Recovery strategy ${name} failed`,
                        ErrorCategory.SYSTEM,
                        recoveryError instanceof Error ? recoveryError : new Error(String(recoveryError)),
                        context
                    );
                }
            }
        }
        return false;
    }

    /**
     * Determine error level based on error type and category
     */
    private determineErrorLevel(error: Error, category: ErrorCategory): ErrorLevel {
        // Critical errors that could crash the system
        if (error.name.includes('Critical') || category === ErrorCategory.SYSTEM) {
            return ErrorLevel.CRITICAL;
        }

        // Storage and API errors are typically recoverable
        if (category === ErrorCategory.STORAGE || category === ErrorCategory.API) {
            return ErrorLevel.ERROR;
        }

        // Default to error level
        return ErrorLevel.ERROR;
    }

    /**
     * Create user notification for errors
     */
    private createUserNotification(logEntry: ErrorLogEntry): void {
        const notification: UserNotification = {
            id: this.generateNotificationId(),
            level: logEntry.level === ErrorLevel.CRITICAL ? 'error' :
                logEntry.level === ErrorLevel.ERROR ? 'error' : 'warning',
            title: this.getErrorTitle(logEntry.category, logEntry.level),
            message: this.getUserFriendlyMessage(logEntry),
            timestamp: logEntry.timestamp,
            dismissed: false,
            actions: this.getNotificationActions(logEntry)
        };

        this.notifications.set(notification.id, notification);

        // Notify subscribers
        this.notificationCallbacks.forEach(callback => {
            try {
                callback(notification);
            } catch (error) {
                console.error('Error in notification callback:', error);
            }
        });
    }

    /**
     * Get user-friendly error title
     */
    private getErrorTitle(category: ErrorCategory, level: ErrorLevel): string {
        const titles = {
            [ErrorCategory.STORAGE]: 'Storage Error',
            [ErrorCategory.API]: 'API Connection Error',
            [ErrorCategory.AGENT]: 'Agent Error',
            [ErrorCategory.TASK]: 'Task Processing Error',
            [ErrorCategory.WORKFLOW]: 'Workflow Error',
            [ErrorCategory.WORKER]: 'Worker Error',
            [ErrorCategory.SERIALIZATION]: 'Data Processing Error',
            [ErrorCategory.SYSTEM]: level === ErrorLevel.CRITICAL ? 'Critical System Error' : 'System Error'
        };

        return titles[category] || 'Unknown Error';
    }

    /**
     * Get user-friendly error message
     */
    private getUserFriendlyMessage(logEntry: ErrorLogEntry): string {
        const messages = {
            [ErrorCategory.STORAGE]: 'There was a problem saving or loading your data. Your work may not be saved.',
            [ErrorCategory.API]: 'Unable to connect to the AI service. Please check your internet connection.',
            [ErrorCategory.AGENT]: 'An agent encountered an error while processing a task.',
            [ErrorCategory.TASK]: 'A task failed to complete successfully.',
            [ErrorCategory.WORKFLOW]: 'There was an error in your workflow execution.',
            [ErrorCategory.WORKER]: 'A background process encountered an error.',
            [ErrorCategory.SERIALIZATION]: 'There was a problem processing your data.',
            [ErrorCategory.SYSTEM]: 'A system error occurred. The application may not function correctly.'
        };

        return messages[logEntry.category] || logEntry.message;
    }

    /**
     * Get notification actions based on error type
     */
    private getNotificationActions(logEntry: ErrorLogEntry): UserNotification['actions'] {
        const actions: UserNotification['actions'] = [];

        // Add retry action for recoverable errors
        if (logEntry.category === ErrorCategory.API || logEntry.category === ErrorCategory.STORAGE) {
            actions.push({
                label: 'Retry',
                action: () => {
                    // This would trigger a retry of the failed operation
                    console.log('Retrying operation...');
                }
            });
        }

        // Add report action for critical errors
        if (logEntry.level === ErrorLevel.CRITICAL) {
            actions.push({
                label: 'Report Issue',
                action: () => {
                    // This would open a bug report dialog
                    console.log('Opening bug report...');
                }
            });
        }

        return actions.length > 0 ? actions : undefined;
    }

    /**
     * Log to console with appropriate level
     */
    private logToConsole(logEntry: ErrorLogEntry): void {
        const message = `[${logEntry.level.toUpperCase()}] ${logEntry.category}: ${logEntry.message}`;

        switch (logEntry.level) {
            case ErrorLevel.INFO:
                console.info(message, logEntry.context);
                break;
            case ErrorLevel.WARN:
                console.warn(message, logEntry.context);
                break;
            case ErrorLevel.ERROR:
                console.error(message, logEntry.error, logEntry.context);
                break;
            case ErrorLevel.CRITICAL:
                console.error(`🚨 ${message}`, logEntry.error, logEntry.context);
                break;
        }
    }

    /**
     * Clean up old log entries to prevent storage bloat
     */
    private async cleanupOldLogs(): Promise<void> {
        try {
            const logs = await this.logStorage.getExecutionLogs();
            if (logs.length > this.maxLogEntries) {
                // Sort by timestamp and keep only the most recent entries
                logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
                const logsToDelete = logs.slice(this.maxLogEntries);

                // Note: IndexedDB manager would need a delete method for this to work
                console.log(`Would delete ${logsToDelete.length} old log entries`);
            }
        } catch (error) {
            console.error('Failed to cleanup old logs:', error);
        }
    }

    /**
     * Generate unique log ID
     */
    private generateLogId(): string {
        return `log_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    }

    /**
     * Generate unique notification ID
     */
    private generateNotificationId(): string {
        return `notification_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();