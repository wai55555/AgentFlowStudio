/**
 * Example integration of monitoring services with the main application
 * This shows how to set up real-time monitoring and statistics collection
 */

import {
    AgentManager,
    TaskQueueEngine,
    WorkflowEngine,
    UnifiedStorageManager,
    StatisticsService,
    PerformanceMonitorService
} from '../services';

/**
 * Example of how to integrate monitoring services into the main application
 */
export class MonitoringIntegrationExample {
    private agentManager: AgentManager;
    private taskQueue: TaskQueueEngine;
    private workflowEngine: WorkflowEngine;
    private statisticsService: StatisticsService;
    private performanceMonitor: PerformanceMonitorService;

    constructor(storageManager: UnifiedStorageManager) {
        // Initialize core services
        this.agentManager = new AgentManager(storageManager);
        this.taskQueue = new TaskQueueEngine(storageManager, this.agentManager);
        this.workflowEngine = new WorkflowEngine(storageManager, this.taskQueue, this.agentManager);

        // Initialize monitoring services
        this.statisticsService = new StatisticsService(
            this.agentManager,
            this.taskQueue,
            this.workflowEngine
        );
        this.performanceMonitor = new PerformanceMonitorService();

        // Set up monitoring hooks
        this.setupMonitoringHooks();
    }

    /**
     * Set up monitoring hooks to capture events from core services
     */
    private setupMonitoringHooks(): void {
        // Hook into task completion events
        this.hookTaskCompletion();

        // Hook into agent performance events
        this.hookAgentPerformance();

        // Hook into workflow execution events
        this.hookWorkflowExecution();

        // Hook into API call events
        this.hookAPICallEvents();
    }

    /**
     * Hook into task completion to record performance metrics
     */
    private hookTaskCompletion(): void {
        // In a real implementation, this would be event-driven
        // For demonstration, we'll show how to record metrics when tasks complete

        const originalCompleteTask = this.taskQueue.completeTask.bind(this.taskQueue);
        this.taskQueue.completeTask = async (taskId: string, result?: string, error?: string) => {
            const task = this.taskQueue.getTask(taskId);
            if (task) {
                const executionTime = task.startedAt
                    ? Date.now() - task.startedAt.getTime()
                    : 0;

                const success = !error;

                // Record metrics
                this.statisticsService.recordTaskExecution(taskId, executionTime, success);
                this.performanceMonitor.recordTaskExecution(taskId, executionTime, success);
            }

            return originalCompleteTask(taskId, result, error);
        };
    }

    /**
     * Hook into agent performance tracking
     */
    private hookAgentPerformance(): void {
        // Hook into agent task assignment to track performance
        const originalAssignTask = this.agentManager.assignTask.bind(this.agentManager);
        this.agentManager.assignTask = async (agentId: string, task: any) => {
            const startTime = Date.now();

            try {
                await originalAssignTask(agentId, task);

                const responseTime = Date.now() - startTime;
                const agent = this.agentManager.getAgent(agentId);

                if (agent) {
                    this.statisticsService.recordAgentPerformance(
                        agentId,
                        agent.name,
                        responseTime,
                        true
                    );
                }
            } catch (error) {
                const responseTime = Date.now() - startTime;
                const agent = this.agentManager.getAgent(agentId);

                if (agent) {
                    this.statisticsService.recordAgentPerformance(
                        agentId,
                        agent.name,
                        responseTime,
                        false
                    );
                }
                throw error;
            }
        };
    }

    /**
     * Hook into workflow execution tracking
     */
    private hookWorkflowExecution(): void {
        const originalExecuteWorkflow = this.workflowEngine.executeWorkflow.bind(this.workflowEngine);
        this.workflowEngine.executeWorkflow = async (workflowId: string) => {
            const startTime = Date.now();
            const workflow = this.workflowEngine.getWorkflow(workflowId);

            try {
                await originalExecuteWorkflow(workflowId);

                const executionTime = Date.now() - startTime;
                const nodeTypes = workflow?.nodes.map(n => n.type) || [];

                this.statisticsService.recordWorkflowExecution(
                    workflowId,
                    executionTime,
                    true,
                    nodeTypes
                );
            } catch (error) {
                const executionTime = Date.now() - startTime;
                const nodeTypes = workflow?.nodes.map(n => n.type) || [];

                this.statisticsService.recordWorkflowExecution(
                    workflowId,
                    executionTime,
                    false,
                    nodeTypes
                );
                throw error;
            }
        };
    }

    /**
     * Hook into API call tracking (would be integrated with OpenRouter client)
     */
    private hookAPICallEvents(): void {
        // This would typically be integrated into the OpenRouter client
        // For demonstration purposes, we'll show how to record API metrics

        // Example of recording an API call
        const recordAPICall = (duration: number, success: boolean) => {
            this.statisticsService.recordAPICall(duration, success);
            this.performanceMonitor.recordAPICall(duration, success);
        };

        // In a real implementation, this would be called from the API client
        // recordAPICall(1500, true); // 1.5 second successful call
        // recordAPICall(3000, false); // 3 second failed call
    }

    /**
     * Get real-time statistics for the UI
     */
    getRealTimeStats() {
        return this.statisticsService.getRealTimeStats();
    }

    /**
     * Get detailed statistics for analytics
     */
    getDetailedStatistics() {
        return this.statisticsService.getDetailedStatistics();
    }

    /**
     * Get performance metrics
     */
    getPerformanceMetrics() {
        return this.performanceMonitor.getMetrics();
    }

    /**
     * Subscribe to real-time updates
     */
    subscribeToUpdates(callback: (stats: any) => void) {
        return this.statisticsService.subscribe(callback);
    }

    /**
     * Export all monitoring data
     */
    exportMonitoringData() {
        return {
            statistics: this.statisticsService.exportStatistics(),
            performance: this.performanceMonitor.exportData(),
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Reset all monitoring data
     */
    resetMonitoringData() {
        this.statisticsService.resetStatistics();
        this.performanceMonitor.resetStatistics();
    }

    /**
     * Get system resource information
     */
    async getSystemResourceInfo() {
        return await this.performanceMonitor.getSystemResourceInfo();
    }

    /**
     * Cleanup monitoring services
     */
    destroy() {
        this.statisticsService.destroy();
        this.performanceMonitor.destroy();
    }
}

/**
 * Example usage in a React component or main application
 */
export const useMonitoringIntegration = (storageManager: UnifiedStorageManager) => {
    const monitoring = new MonitoringIntegrationExample(storageManager);

    return {
        // Real-time statistics
        getRealTimeStats: () => monitoring.getRealTimeStats(),

        // Detailed analytics
        getDetailedStats: () => monitoring.getDetailedStatistics(),

        // Performance metrics
        getPerformanceMetrics: () => monitoring.getPerformanceMetrics(),

        // Subscribe to updates
        subscribe: (callback: (stats: any) => void) => monitoring.subscribeToUpdates(callback),

        // System resources
        getSystemInfo: () => monitoring.getSystemResourceInfo(),

        // Data management
        exportData: () => monitoring.exportMonitoringData(),
        resetData: () => monitoring.resetMonitoringData(),

        // Cleanup
        cleanup: () => monitoring.destroy()
    };
};

/**
 * Example of how to use monitoring in a React component
 */
export const MonitoringComponentExample = `
import React, { useState, useEffect } from 'react';
import { useMonitoringIntegration } from './monitoringIntegration';

const Dashboard = ({ storageManager }) => {
    const [stats, setStats] = useState(null);
    const monitoring = useMonitoringIntegration(storageManager);

    useEffect(() => {
        // Subscribe to real-time updates
        const unsubscribe = monitoring.subscribe((newStats) => {
            setStats(newStats);
        });

        return unsubscribe;
    }, [monitoring]);

    return (
        <div>
            <h1>System Dashboard</h1>
            {stats && (
                <div>
                    <p>Tasks per minute: {stats.performance.tasksPerMinute}</p>
                    <p>Agent utilization: {stats.performance.agentUtilization}%</p>
                    <p>Success rate: {stats.performance.successRate}%</p>
                    <p>System uptime: {stats.performance.systemUptime}ms</p>
                </div>
            )}
        </div>
    );
};
`;