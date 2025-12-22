/**
 * Statistics Service
 * Integrates with existing services to collect and provide real-time statistics
 */

import { PerformanceMonitor, PerformanceMetrics, UsageStatistics } from './performanceMonitor';
import { AgentManager } from './agentManager';
import { TaskQueueEngine } from './taskQueue';
import { WorkflowEngine } from './workflowEngine';
import { Agent } from '../types/agent';
import { Task } from '../types/task';
import { Workflow } from '../types/workflow';

export interface RealTimeStats {
    // Current system state
    currentState: {
        totalAgents: number;
        activeAgents: number;
        idleAgents: number;
        errorAgents: number;
        totalTasks: number;
        pendingTasks: number;
        runningTasks: number;
        completedTasks: number;
        failedTasks: number;
        totalWorkflows: number;
        runningWorkflows: number;
        queueLength: number;
    };

    // Performance indicators
    performance: {
        tasksPerMinute: number;
        averageTaskDuration: number;
        agentUtilization: number;
        successRate: number;
        errorRate: number;
        systemUptime: number;
    };

    // Resource usage
    resources: {
        memoryUsage: number;
        storageUsage: number;
        storageQuota: number;
        storagePercentage: number;
        apiCallsPerMinute: number;
        networkLatency: number;
    };

    // Trends (compared to previous period)
    trends: {
        tasksTrend: 'up' | 'down' | 'stable';
        performanceTrend: 'up' | 'down' | 'stable';
        errorTrend: 'up' | 'down' | 'stable';
        utilizationTrend: 'up' | 'down' | 'stable';
    };

    lastUpdated: Date;
}

export interface DetailedStatistics {
    // Agent statistics
    agentStats: {
        topPerformers: Array<{
            id: string;
            name: string;
            tasksCompleted: number;
            averageResponseTime: number;
            successRate: number;
            utilizationRate: number;
        }>;
        agentDistribution: {
            byRole: Array<{ role: string; count: number }>;
            byStatus: Array<{ status: string; count: number }>;
        };
    };

    // Task statistics
    taskStats: {
        recentTasks: Array<{
            id: string;
            type: string;
            status: string;
            duration?: number;
            createdAt: Date;
            completedAt?: Date;
        }>;
        taskDistribution: {
            byType: Array<{ type: string; count: number }>;
            byStatus: Array<{ status: string; count: number }>;
            byPriority: Array<{ priority: number; count: number }>;
        };
        executionTimes: {
            fastest: number;
            slowest: number;
            average: number;
            median: number;
        };
    };

    // Workflow statistics
    workflowStats: {
        recentWorkflows: Array<{
            id: string;
            name: string;
            status: string;
            nodeCount: number;
            duration?: number;
            createdAt?: Date;
        }>;
        nodeUsage: Array<{
            nodeType: string;
            count: number;
            averageExecutionTime: number;
        }>;
    };

    // Historical trends
    historicalData: {
        dailyTaskCounts: Array<{ date: string; count: number }>;
        hourlyActivity: Array<{ hour: number; activity: number }>;
        weeklyTrends: Array<{ week: string; tasks: number; success: number; errors: number }>;
    };
}

export class StatisticsServiceError extends Error {
    constructor(message: string, public code?: string) {
        super(message);
        this.name = 'StatisticsServiceError';
    }
}

export class StatisticsService {
    private performanceMonitor: PerformanceMonitor;
    private agentManager: AgentManager;
    private taskQueue: TaskQueueEngine;
    private workflowEngine: WorkflowEngine;
    private updateInterval: number | null = null;
    private listeners: Array<(stats: RealTimeStats) => void> = [];
    private previousStats: RealTimeStats | null = null;

    constructor(
        agentManager: AgentManager,
        taskQueue: TaskQueueEngine,
        workflowEngine: WorkflowEngine
    ) {
        this.agentManager = agentManager;
        this.taskQueue = taskQueue;
        this.workflowEngine = workflowEngine;
        this.performanceMonitor = new PerformanceMonitor();

        this.startRealTimeUpdates();
        this.setupServiceIntegration();
    }

    /**
     * Start real-time statistics updates
     */
    private startRealTimeUpdates(): void {
        if (this.updateInterval !== null) {
            return;
        }

        // Update statistics every 2 seconds for real-time feel
        this.updateInterval = window.setInterval(() => {
            this.updateRealTimeStats();
        }, 2000);

        // Initial update
        this.updateRealTimeStats();
    }

    /**
     * Setup integration with existing services to capture events
     */
    private setupServiceIntegration(): void {
        // Note: In a real implementation, we would hook into service events
        // For now, we'll poll the services for their current state

        // Monitor performance metrics
        this.performanceMonitor.subscribe((metrics: PerformanceMetrics) => {
            this.updateFromPerformanceMetrics(metrics);
        });
    }

    /**
     * Update statistics from performance metrics
     */
    private updateFromPerformanceMetrics(metrics: PerformanceMetrics): void {
        // Update agent metrics
        this.performanceMonitor.updateAgentMetrics(
            this.agentManager.getAllAgents().length,
            this.agentManager.getAvailableAgents().length
        );

        // Update workflow metrics
        this.performanceMonitor.updateWorkflowMetrics(
            this.workflowEngine.getWorkflows().length,
            this.workflowEngine.getWorkflows().filter(w => w.status === 'running').length
        );
    }

    /**
     * Update real-time statistics
     */
    private updateRealTimeStats(): void {
        try {
            const agents = this.agentManager.getAllAgents();
            const tasks = this.taskQueue.getTasks();
            const workflows = this.workflowEngine.getWorkflows();
            const queueStats = this.taskQueue.getQueueStats();
            const metrics = this.performanceMonitor.getMetrics();

            const currentStats: RealTimeStats = {
                currentState: {
                    totalAgents: agents.length,
                    activeAgents: agents.filter(a => a.status === 'busy').length,
                    idleAgents: agents.filter(a => a.status === 'idle').length,
                    errorAgents: agents.filter(a => a.status === 'error').length,
                    totalTasks: tasks.length,
                    pendingTasks: queueStats.pending,
                    runningTasks: queueStats.running,
                    completedTasks: queueStats.completed,
                    failedTasks: queueStats.failed,
                    totalWorkflows: workflows.length,
                    runningWorkflows: workflows.filter(w => w.status === 'running').length,
                    queueLength: queueStats.pending
                },
                performance: {
                    tasksPerMinute: metrics.taskMetrics.tasksPerMinute,
                    averageTaskDuration: metrics.taskMetrics.averageExecutionTime,
                    agentUtilization: metrics.agentMetrics.averageUtilization * 100,
                    successRate: metrics.taskMetrics.successRate * 100,
                    errorRate: metrics.taskMetrics.failureRate * 100,
                    systemUptime: metrics.systemMetrics.uptime
                },
                resources: {
                    memoryUsage: metrics.systemMetrics.memoryUsage,
                    storageUsage: metrics.systemMetrics.storageUsage,
                    storageQuota: metrics.systemMetrics.storageQuota,
                    storagePercentage: metrics.systemMetrics.storageQuota > 0
                        ? (metrics.systemMetrics.storageUsage / metrics.systemMetrics.storageQuota) * 100
                        : 0,
                    apiCallsPerMinute: metrics.systemMetrics.apiCallsPerMinute,
                    networkLatency: 0 // Would be calculated from API call metrics
                },
                trends: this.calculateTrends(currentStats, this.previousStats),
                lastUpdated: new Date()
            };

            this.previousStats = currentStats;
            this.notifyListeners(currentStats);

        } catch (error) {
            console.error('Failed to update real-time statistics:', error);
        }
    }

    /**
     * Calculate trends by comparing current stats with previous
     */
    private calculateTrends(current: RealTimeStats, previous: RealTimeStats | null): RealTimeStats['trends'] {
        if (!previous) {
            return {
                tasksTrend: 'stable',
                performanceTrend: 'stable',
                errorTrend: 'stable',
                utilizationTrend: 'stable'
            };
        }

        const tasksDiff = current.currentState.totalTasks - previous.currentState.totalTasks;
        const performanceDiff = current.performance.averageTaskDuration - previous.performance.averageTaskDuration;
        const errorDiff = current.performance.errorRate - previous.performance.errorRate;
        const utilizationDiff = current.performance.agentUtilization - previous.performance.agentUtilization;

        return {
            tasksTrend: tasksDiff > 0 ? 'up' : tasksDiff < 0 ? 'down' : 'stable',
            performanceTrend: performanceDiff < 0 ? 'up' : performanceDiff > 0 ? 'down' : 'stable', // Lower duration is better
            errorTrend: errorDiff > 0 ? 'up' : errorDiff < 0 ? 'down' : 'stable',
            utilizationTrend: utilizationDiff > 0 ? 'up' : utilizationDiff < 0 ? 'down' : 'stable'
        };
    }

    /**
     * Get current real-time statistics
     */
    getRealTimeStats(): RealTimeStats {
        if (!this.previousStats) {
            this.updateRealTimeStats();
        }
        return this.previousStats || this.createEmptyStats();
    }

    /**
     * Get detailed statistics with historical data
     */
    getDetailedStatistics(): DetailedStatistics {
        const agents = this.agentManager.getAllAgents();
        const tasks = this.taskQueue.getTasks();
        const workflows = this.workflowEngine.getWorkflows();
        const statistics = this.performanceMonitor.getStatistics();

        return {
            agentStats: {
                topPerformers: agents
                    .map(agent => ({
                        id: agent.id,
                        name: agent.name,
                        tasksCompleted: agent.stats.tasksCompleted,
                        averageResponseTime: agent.stats.averageResponseTime,
                        successRate: agent.stats.errorCount > 0
                            ? (agent.stats.tasksCompleted / (agent.stats.tasksCompleted + agent.stats.errorCount)) * 100
                            : 100,
                        utilizationRate: agent.status === 'busy' ? 100 : 0
                    }))
                    .sort((a, b) => b.tasksCompleted - a.tasksCompleted)
                    .slice(0, 10),
                agentDistribution: {
                    byRole: this.groupBy(agents, 'role'),
                    byStatus: this.groupBy(agents, 'status')
                }
            },
            taskStats: {
                recentTasks: tasks
                    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
                    .slice(0, 20)
                    .map(task => ({
                        id: task.id,
                        type: task.type,
                        status: task.status,
                        duration: task.completedAt && task.startedAt
                            ? task.completedAt.getTime() - task.startedAt.getTime()
                            : undefined,
                        createdAt: task.createdAt,
                        completedAt: task.completedAt
                    })),
                taskDistribution: {
                    byType: this.groupBy(tasks, 'type'),
                    byStatus: this.groupBy(tasks, 'status'),
                    byPriority: this.groupBy(tasks, 'priority')
                },
                executionTimes: this.calculateExecutionTimeStats(tasks)
            },
            workflowStats: {
                recentWorkflows: workflows
                    .slice(0, 10)
                    .map(workflow => ({
                        id: workflow.id,
                        name: workflow.name,
                        status: workflow.status,
                        nodeCount: workflow.nodes.length,
                        duration: undefined, // Would need to track execution times
                        createdAt: undefined // Would need to add creation timestamps
                    })),
                nodeUsage: this.calculateNodeUsage(workflows)
            },
            historicalData: {
                dailyTaskCounts: statistics.dailyStats.map(stat => ({
                    date: stat.date,
                    count: stat.tasksExecuted
                })),
                hourlyActivity: this.calculateHourlyActivity(tasks),
                weeklyTrends: this.calculateWeeklyTrends(statistics.dailyStats)
            }
        };
    }

    /**
     * Record task execution for performance monitoring
     */
    recordTaskExecution(taskId: string, executionTime: number, success: boolean): void {
        this.performanceMonitor.recordTaskExecution(taskId, executionTime, success);
    }

    /**
     * Record agent performance
     */
    recordAgentPerformance(agentId: string, agentName: string, responseTime: number, success: boolean): void {
        this.performanceMonitor.recordAgentPerformance(agentId, agentName, responseTime, success);
    }

    /**
     * Record workflow execution
     */
    recordWorkflowExecution(workflowId: string, executionTime: number, success: boolean, nodeTypes: string[]): void {
        this.performanceMonitor.recordWorkflowExecution(workflowId, executionTime, success, nodeTypes);
    }

    /**
     * Record API call metrics
     */
    recordAPICall(duration: number, success: boolean): void {
        this.performanceMonitor.recordAPICall(duration, success);
    }

    /**
     * Subscribe to real-time statistics updates
     */
    subscribe(listener: (stats: RealTimeStats) => void): () => void {
        this.listeners.push(listener);

        // Send current stats immediately
        const currentStats = this.getRealTimeStats();
        listener(currentStats);

        return () => {
            const index = this.listeners.indexOf(listener);
            if (index > -1) {
                this.listeners.splice(index, 1);
            }
        };
    }

    /**
     * Get performance metrics
     */
    getPerformanceMetrics(): PerformanceMetrics {
        return this.performanceMonitor.getMetrics();
    }

    /**
     * Get usage statistics
     */
    getUsageStatistics(): UsageStatistics {
        return this.performanceMonitor.getStatistics();
    }

    /**
     * Export all statistics data
     */
    exportStatistics(): string {
        return JSON.stringify({
            realTimeStats: this.getRealTimeStats(),
            detailedStats: this.getDetailedStatistics(),
            performanceMetrics: this.getPerformanceMetrics(),
            usageStatistics: this.getUsageStatistics(),
            exportDate: new Date().toISOString()
        }, null, 2);
    }

    /**
     * Reset all statistics
     */
    resetStatistics(): void {
        this.performanceMonitor.resetStatistics();
        this.previousStats = null;
    }

    /**
     * Stop real-time updates
     */
    stopUpdates(): void {
        if (this.updateInterval !== null) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    /**
     * Notify all listeners of statistics updates
     */
    private notifyListeners(stats: RealTimeStats): void {
        this.listeners.forEach(listener => {
            try {
                listener(stats);
            } catch (error) {
                console.error('Error in statistics listener:', error);
            }
        });
    }

    /**
     * Create empty statistics structure
     */
    private createEmptyStats(): RealTimeStats {
        return {
            currentState: {
                totalAgents: 0,
                activeAgents: 0,
                idleAgents: 0,
                errorAgents: 0,
                totalTasks: 0,
                pendingTasks: 0,
                runningTasks: 0,
                completedTasks: 0,
                failedTasks: 0,
                totalWorkflows: 0,
                runningWorkflows: 0,
                queueLength: 0
            },
            performance: {
                tasksPerMinute: 0,
                averageTaskDuration: 0,
                agentUtilization: 0,
                successRate: 0,
                errorRate: 0,
                systemUptime: 0
            },
            resources: {
                memoryUsage: 0,
                storageUsage: 0,
                storageQuota: 0,
                storagePercentage: 0,
                apiCallsPerMinute: 0,
                networkLatency: 0
            },
            trends: {
                tasksTrend: 'stable',
                performanceTrend: 'stable',
                errorTrend: 'stable',
                utilizationTrend: 'stable'
            },
            lastUpdated: new Date()
        };
    }

    /**
     * Group array items by a property
     */
    private groupBy<T>(array: T[], property: keyof T): Array<{ [key: string]: any; count: number }> {
        const groups = array.reduce((acc, item) => {
            const key = String(item[property]);
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        return Object.entries(groups).map(([key, count]) => ({
            [property]: key,
            count
        }));
    }

    /**
     * Calculate execution time statistics
     */
    private calculateExecutionTimeStats(tasks: Task[]): DetailedStatistics['taskStats']['executionTimes'] {
        const completedTasks = tasks.filter(t => t.status === 'completed' && t.startedAt && t.completedAt);

        if (completedTasks.length === 0) {
            return { fastest: 0, slowest: 0, average: 0, median: 0 };
        }

        const durations = completedTasks.map(t =>
            t.completedAt!.getTime() - t.startedAt!.getTime()
        ).sort((a, b) => a - b);

        return {
            fastest: durations[0],
            slowest: durations[durations.length - 1],
            average: durations.reduce((sum, d) => sum + d, 0) / durations.length,
            median: durations[Math.floor(durations.length / 2)]
        };
    }

    /**
     * Calculate node usage statistics
     */
    private calculateNodeUsage(workflows: Workflow[]): DetailedStatistics['workflowStats']['nodeUsage'] {
        const nodeUsage = new Map<string, { count: number; totalTime: number }>();

        workflows.forEach(workflow => {
            workflow.nodes.forEach(node => {
                const current = nodeUsage.get(node.type) || { count: 0, totalTime: 0 };
                current.count++;
                nodeUsage.set(node.type, current);
            });
        });

        return Array.from(nodeUsage.entries()).map(([nodeType, usage]) => ({
            nodeType,
            count: usage.count,
            averageExecutionTime: usage.count > 0 ? usage.totalTime / usage.count : 0
        }));
    }

    /**
     * Calculate hourly activity patterns
     */
    private calculateHourlyActivity(tasks: Task[]): Array<{ hour: number; activity: number }> {
        const hourlyActivity = new Array(24).fill(0);

        tasks.forEach(task => {
            const hour = task.createdAt.getHours();
            hourlyActivity[hour]++;
        });

        return hourlyActivity.map((activity, hour) => ({ hour, activity }));
    }

    /**
     * Calculate weekly trends
     */
    private calculateWeeklyTrends(dailyStats: any[]): Array<{ week: string; tasks: number; success: number; errors: number }> {
        // Group daily stats by week
        const weeklyData = new Map<string, { tasks: number; success: number; errors: number }>();

        dailyStats.forEach(stat => {
            const date = new Date(stat.date);
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            const weekKey = weekStart.toISOString().split('T')[0];

            const current = weeklyData.get(weekKey) || { tasks: 0, success: 0, errors: 0 };
            current.tasks += stat.tasksExecuted;
            current.errors += stat.errorCount;
            current.success += stat.tasksExecuted - stat.errorCount;
            weeklyData.set(weekKey, current);
        });

        return Array.from(weeklyData.entries()).map(([week, data]) => ({
            week,
            ...data
        }));
    }

    /**
     * Cleanup resources
     */
    destroy(): void {
        this.stopUpdates();
        this.performanceMonitor.destroy();
        this.listeners = [];
    }
}