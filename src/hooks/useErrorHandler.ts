/**
 * React Hook for Error Handling
 * Provides easy integration of error handling in React components
 */

import { useCallback, useEffect, useState } from 'react';
import { errorHandler, ErrorCategory, ErrorLevel, ErrorLogEntry, UserNotification } from '../services/errorHandler';

export interface UseErrorHandlerReturn {
    logError: (message: string, category: ErrorCategory, error?: Error) => Promise<void>;
    logWarning: (message: string, category: ErrorCategory) => Promise<void>;
    logInfo: (message: string, category: ErrorCategory) => Promise<void>;
    handleError: (error: Error, category: ErrorCategory) => Promise<boolean>;
    notifications: UserNotification[];
    dismissNotification: (id: string) => void;
    clearNotifications: () => void;
    errorStats: {
        totalErrors: number;
        recentErrors: ErrorLogEntry[];
    } | null;
}

export const useErrorHandler = (): UseErrorHandlerReturn => {
    const [notifications, setNotifications] = useState<UserNotification[]>([]);
    const [errorStats, setErrorStats] = useState<{
        totalErrors: number;
        recentErrors: ErrorLogEntry[];
    } | null>(null);

    // Initialize error handler and load initial data
    useEffect(() => {
        const initializeErrorHandler = async () => {
            try {
                await errorHandler.initialize();

                // Load initial notifications
                setNotifications(errorHandler.getNotifications());

                // Load error statistics
                const stats = await errorHandler.getErrorStatistics();
                setErrorStats({
                    totalErrors: stats.totalErrors,
                    recentErrors: stats.recentErrors
                });
            } catch (error) {
                console.error('Failed to initialize error handler:', error);
            }
        };

        initializeErrorHandler();

        // Subscribe to new notifications
        const unsubscribe = errorHandler.onNotification((notification) => {
            setNotifications(prev => {
                // Add new notification and remove duplicates
                const filtered = prev.filter(n => n.id !== notification.id);
                return [notification, ...filtered];
            });
        });

        return unsubscribe;
    }, []);

    // Memoized error logging functions
    const logError = useCallback(async (
        message: string,
        category: ErrorCategory,
        error?: Error
    ) => {
        await errorHandler.logError(message, category, error);

        // Update error stats
        const stats = await errorHandler.getErrorStatistics();
        setErrorStats({
            totalErrors: stats.totalErrors,
            recentErrors: stats.recentErrors
        });
    }, []);

    const logWarning = useCallback(async (
        message: string,
        category: ErrorCategory
    ) => {
        await errorHandler.logWarning(message, category);
    }, []);

    const logInfo = useCallback(async (
        message: string,
        category: ErrorCategory
    ) => {
        await errorHandler.logInfo(message, category);
    }, []);

    const handleError = useCallback(async (
        error: Error,
        category: ErrorCategory
    ): Promise<boolean> => {
        const recovered = await errorHandler.handleError(error, category);

        // Update error stats
        const stats = await errorHandler.getErrorStatistics();
        setErrorStats({
            totalErrors: stats.totalErrors,
            recentErrors: stats.recentErrors
        });

        return recovered;
    }, []);

    const dismissNotification = useCallback((id: string) => {
        errorHandler.dismissNotification(id);
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    const clearNotifications = useCallback(() => {
        errorHandler.clearNotifications();
        setNotifications([]);
    }, []);

    return {
        logError,
        logWarning,
        logInfo,
        handleError,
        notifications,
        dismissNotification,
        clearNotifications,
        errorStats
    };
};

export default useErrorHandler;