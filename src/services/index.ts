/**
 * Services exports
 */

export { LocalStorageManager, LocalStorageError } from './localStorage';
export { IndexedDBManager, IndexedDBError } from './indexedDB';
export { DataSerializer, SerializationError } from './serialization';
export { UnifiedStorageManager, StorageManagerError } from './storageManager';
export { OpenRouterClient, OpenRouterError, RateLimitError } from './openRouterClient';
export { AgentManager, AgentManagerError } from './agentManager';
export { TaskQueueEngine, TaskQueueError } from './taskQueue';
export { WorkflowEngine, WorkflowEngineError } from './workflowEngine';
export { WorkerPool, WorkerPoolError } from './workerPool';
export { WebWorkerIntegration, WebWorkerIntegrationError } from './webWorkerIntegration';
export { ConfigurationManager, ConfigurationManagerError } from './configurationManager';
export { ErrorHandler, errorHandler, ErrorLevel, ErrorCategory } from './errorHandler';
export {
    withErrorHandling,
    handleErrors,
    EnhancedError,
    EnhancedStorageError,
    EnhancedAPIError,
    EnhancedAgentError,
    EnhancedTaskError,
    EnhancedWorkflowError,
    EnhancedWorkerError,
    enhanceError,
    handlePromise,
    withAsyncErrorHandling,
    handleBatch,
    ErrorBoundaryHandler,
    PerformanceMonitor
} from './errorIntegration';
export { PerformanceMonitor as PerformanceMonitorService, PerformanceMonitorError } from './performanceMonitor';
export { StatisticsService, StatisticsServiceError } from './statisticsService';

export type { ExecutionLog, TaskResult } from './indexedDB';
export type { SerializationOptions } from './serialization';
export type { StorageQuota } from './localStorage';
export type { OpenRouterConfig } from './openRouterClient';
export type { WorkerMessage, WorkerInfo, WorkerPoolConfig } from './workerPool';
export type { ConfigurationData, ConfigurationValidationResult, BackupMetadata } from './configurationManager';
export type { ErrorHandler, ErrorLevel, ErrorCategory, ErrorContext, ErrorLogEntry, UserNotification } from './errorHandler';
export type {
    PerformanceMetrics,
    UsageStatistics,
    SystemResourceInfo
} from './performanceMonitor';
export type {
    RealTimeStats,
    DetailedStatistics
} from './statisticsService';