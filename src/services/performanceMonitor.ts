/**
 * Performance Monitor Service
 * Collects and tracks performance metrics, usage statistics, and system resources
 */

export interface TaskExecutionRecord {
    id: string;
    timestamp: Date;
    duration: number;
    success: boolean;
    agentId?: string;
    taskType?: string;
}

export interface PerformanceMetrics {
    // Task execution metrics
    taskMetrics: {
        totalExecuted: number;
        averageExecutionTime: number;
        successRate: number;
        failureRate: number;
        tasksPerMinute: number;
        peakTasksPerMinute: number;
    };

    // Agent performance metrics
    agentMetrics: {
        totalAgents: number;
        activeAgents: number;
        averageUtilization: number;
        averageResponseTime: number;
        topPerformers: Array<{
            agentId: string;
            name: string;
            tasksCompleted: number;
            averageResponseTime: number;
            successRate: number;
        }>;
    };

    // Workflow metrics
    workflowMetrics: {
        totalWorkflows: number;
        activeWorkflows: number;
        averageExecutionTime: number;
        successRate: number;
        mostUsedNodes: Array<{
            nodeType: string;
            count: number;
        }>;
    };

    // System resource metrics
    systemMetrics: {
        memoryUsage: number;
        storageUsage: number;
        storageQuota: number;
        apiCallsPerMinute: number;
        errorRate: number;
        uptime: number;
    };

    // Real-time metrics
    realTimeMetrics: {
        currentTasks: number;
        queueLength: number;
        processingRate: number;
        lastUpdateTime: Date;
    };
}

export interface UsageStatistics {
    // Historical data
    dailyStats: Array<{
        date: string;
        tasksExecuted: number;
        agentsUsed: number;
        workflowsRun: number;
        averageResponseTime: number;
        errorCount: number;
    }>;

    // Cumulative statistics
    totalStats: {
        totalTasksExecuted: number;
        totalAgentsCreated: number;
        totalWorkflowsCreated: number;
        totalWorkflowsExecuted: number;
        totalUptime: number;
        firstUsageDate: Date;
        lastActiveDate: Date;
    };

    // Usage patterns
    patterns: {
        peakUsageHours: number[];
        mostUsedFeatures: Array<{
            feature: string;
            usageCount: number;
        }>;
        averageSessionDuration: number;
    };
}

export interface SystemResourceInfo {
    memory: {
        used: number;
        available: number;
        percentage: number;
    };
    storage: {
        used: number;
        quota: number;
        percentage: number;
        breakdown: {
            agents: number;
            tasks: number;
            workflows: number;
            logs: number;
            other: number;
        };
    };
    network: {
        apiCallsTotal: number;
        apiCallsPerMinute: number;
        averageLatency: number;
        errorRate: number;
    };
    browser: {
        userAgent: string;
        language: string;
        platform: string;
        cookiesEnabled: boolean;
        localStorageAvailable: boolean;
        indexedDBAvailable: boolean;
    };
}

export class PerformanceMonitorError extends Error {
    constructor(message: string, public code?: string) {
        super(message);
        this.name = 'PerformanceMonitorError';
    }
}

export class PerformanceMonitor {
    private metrics: PerformanceMetrics = {} as PerformanceMetrics;
    private statistics: UsageStatistics = {} as UsageStatistics;
    private startTime: Date;
    private updateInterval: number | null = null;
    private listeners: Array<(metrics: PerformanceMetrics) => void> = [];
    private taskExecutionRecords: TaskExecutionRecord[] = [];
    private apiCallTimes: Array<{ timestamp: Date; duration: number; success: boolean }> = [];
    // Note: Session start tracking can be added here when needed for session-based metrics

    constructor() {
        this.startTime = new Date();
        // this.__sessionStart = new Date(); // Uncomment when session tracking is implemented
        this.initializeMetrics();
        this.initializeStatistics();
        this.startRealTimeMonitoring();
        this.loadHistoricalData();
    }

    /**
     * Initialize default metrics structure
     */
    private initializeMetrics(): void {
        this.metrics = {
            taskMetrics: {
                totalExecuted: 0,
                averageExecutionTime: 0,
                successRate: 0,
                failureRate: 0,
                tasksPerMinute: 0,
                peakTasksPerMinute: 0
            },
            agentMetrics: {
                totalAgents: 0,
                activeAgents: 0,
                averageUtilization: 0,
                averageResponseTime: 0,
                topPerformers: []
            },
            workflowMetrics: {
                totalWorkflows: 0,
                activeWorkflows: 0,
                averageExecutionTime: 0,
                successRate: 0,
                mostUsedNodes: []
            },
            systemMetrics: {
                memoryUsage: 0,
                storageUsage: 0,
                storageQuota: 0,
                apiCallsPerMinute: 0,
                errorRate: 0,
                uptime: 0
            },
            realTimeMetrics: {
                currentTasks: 0,
                queueLength: 0,
                processingRate: 0,
                lastUpdateTime: new Date()
            }
        };
    }

    /**
     * Initialize default statistics structure
     */
    private initializeStatistics(): void {
        this.statistics = {
            dailyStats: [],
            totalStats: {
                totalTasksExecuted: 0,
                totalAgentsCreated: 0,
                totalWorkflowsCreated: 0,
                totalWorkflowsExecuted: 0,
                totalUptime: 0,
                firstUsageDate: new Date(),
                lastActiveDate: new Date()
            },
            patterns: {
                peakUsageHours: [],
                mostUsedFeatures: [],
                averageSessionDuration: 0
            }
        };
    }

    /**
     * Start real-time monitoring with periodic updates
     */
    private startRealTimeMonitoring(): void {
        if (this.updateInterval !== null) {
            return; // Already monitoring
        }

        // Update metrics every 5 seconds
        this.updateInterval = window.setInterval(() => {
            this.updateRealTimeMetrics();
            this.updateSystemMetrics();
            this.notifyListeners();
        }, 5000);
    }

    /**
     * Stop real-time monitoring
     */
    stopMonitoring(): void {
        if (this.updateInterval !== null) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    /**
     * Record task execution metrics
     */
    recordTaskExecution(executionTime: number, success: boolean, agentId?: string, taskType?: string): void {
        const taskRecord: TaskExecutionRecord = {
            id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date(),
            duration: executionTime,
            success,
            agentId,
            taskType
        };

        this.taskExecutionRecords.push(taskRecord);
        this.metrics.taskMetrics.totalExecuted++;

        // Keep only last 1000 execution records for performance
        if (this.taskExecutionRecords.length > 1000) {
            this.taskExecutionRecords.shift();
        }

        // Update success/failure rates using taskExecutionRecords length as denominator
        const recordsCount = this.taskExecutionRecords.length;
        const successCount = this.taskExecutionRecords.filter(record => record.success).length;
        const failureCount = this.taskExecutionRecords.filter(record => !record.success).length;

        this.metrics.taskMetrics.successRate = recordsCount > 0 ? successCount / recordsCount : 0;
        this.metrics.taskMetrics.failureRate = recordsCount > 0 ? failureCount / recordsCount : 0;

        // Update average execution time using recent records
        const recentRecords = this.getTimeWindowTasks(60 * 1000); // Last minute
        if (recentRecords.length > 0) {
            this.metrics.taskMetrics.averageExecutionTime =
                recentRecords.reduce((sum, record) => sum + record.duration, 0) / recentRecords.length;
        }

        // Update tasks per minute immediately
        this.metrics.taskMetrics.tasksPerMinute = this.calculateTasksPerMinute();

        // Update peak tasks per minute
        if (this.metrics.taskMetrics.tasksPerMinute > this.metrics.taskMetrics.peakTasksPerMinute) {
            this.metrics.taskMetrics.peakTasksPerMinute = this.metrics.taskMetrics.tasksPerMinute;
        }

        // Update statistics
        this.statistics.totalStats.totalTasksExecuted++;
        this.statistics.totalStats.lastActiveDate = new Date();

        this.saveStatistics();
    }

    /**
     * Record agent performance metrics
     */
    recordAgentPerformance(agentId: string, agentName: string, responseTime: number, success: boolean): void {
        // Update agent metrics in the top performers list
        let performer = this.metrics.agentMetrics.topPerformers.find(p => p.agentId === agentId);

        if (!performer) {
            performer = {
                agentId,
                name: agentName,
                tasksCompleted: 0,
                averageResponseTime: responseTime,
                successRate: 1
            };
            this.metrics.agentMetrics.topPerformers.push(performer);
        }

        // Update performer metrics
        const oldCount = performer.tasksCompleted;
        performer.tasksCompleted++;

        // Update average response time
        performer.averageResponseTime =
            ((performer.averageResponseTime * oldCount) + responseTime) / performer.tasksCompleted;

        // Update success rate
        performer.successRate =
            ((performer.successRate * oldCount) + (success ? 1 : 0)) / performer.tasksCompleted;

        // Sort top performers by tasks completed
        this.metrics.agentMetrics.topPerformers.sort((a, b) => b.tasksCompleted - a.tasksCompleted);

        // Keep only top 10 performers
        if (this.metrics.agentMetrics.topPerformers.length > 10) {
            this.metrics.agentMetrics.topPerformers = this.metrics.agentMetrics.topPerformers.slice(0, 10);
        }
    }

    /**
     * Record workflow execution metrics
     */
    recordWorkflowExecution(/* workflowId: string, */ executionTime: number, success: boolean, nodeTypes: string[]): void {
        this.statistics.totalStats.totalWorkflowsExecuted++;

        // Update workflow success rate
        const totalExecuted = this.statistics.totalStats.totalWorkflowsExecuted;
        if (success) {
            this.metrics.workflowMetrics.successRate =
                ((this.metrics.workflowMetrics.successRate * (totalExecuted - 1)) + 1) / totalExecuted;
        }

        // Update average execution time (simplified)
        this.metrics.workflowMetrics.averageExecutionTime =
            ((this.metrics.workflowMetrics.averageExecutionTime * (totalExecuted - 1)) + executionTime) / totalExecuted;

        // Update most used nodes
        nodeTypes.forEach(nodeType => {
            let nodeUsage = this.metrics.workflowMetrics.mostUsedNodes.find(n => n.nodeType === nodeType);
            if (!nodeUsage) {
                nodeUsage = { nodeType, count: 0 };
                this.metrics.workflowMetrics.mostUsedNodes.push(nodeUsage);
            }
            nodeUsage.count++;
        });

        // Sort and limit most used nodes
        this.metrics.workflowMetrics.mostUsedNodes.sort((a, b) => b.count - a.count);
        if (this.metrics.workflowMetrics.mostUsedNodes.length > 10) {
            this.metrics.workflowMetrics.mostUsedNodes = this.metrics.workflowMetrics.mostUsedNodes.slice(0, 10);
        }

        this.statistics.totalStats.lastActiveDate = new Date();
        this.saveStatistics();
    }

    /**
     * Record API call metrics
     */
    recordAPICall(duration: number, success: boolean): void {
        const now = new Date();
        this.apiCallTimes.push({ timestamp: now, duration, success });

        // Keep only last hour of API calls
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        this.apiCallTimes = this.apiCallTimes.filter(call => call.timestamp > oneHourAgo);

        // Update API calls per minute
        const lastMinute = new Date(now.getTime() - 60 * 1000);
        const callsLastMinute = this.apiCallTimes.filter(call => call.timestamp > lastMinute).length;
        this.metrics.systemMetrics.apiCallsPerMinute = callsLastMinute;

        // Update error rate
        const totalCalls = this.apiCallTimes.length;
        const failedCalls = this.apiCallTimes.filter(call => !call.success).length;
        this.metrics.systemMetrics.errorRate = totalCalls > 0 ? failedCalls / totalCalls : 0;
    }

    /**
     * Update agent count metrics
     */
    updateAgentMetrics(totalAgents: number, activeAgents: number): void {
        this.metrics.agentMetrics.totalAgents = totalAgents;
        this.metrics.agentMetrics.activeAgents = activeAgents;
        this.metrics.agentMetrics.averageUtilization =
            totalAgents > 0 ? activeAgents / totalAgents : 0;

        // Update total agents created if it's higher
        if (totalAgents > this.statistics.totalStats.totalAgentsCreated) {
            this.statistics.totalStats.totalAgentsCreated = totalAgents;
        }
    }

    /**
     * Update workflow count metrics
     */
    updateWorkflowMetrics(totalWorkflows: number, activeWorkflows: number): void {
        this.metrics.workflowMetrics.totalWorkflows = totalWorkflows;
        this.metrics.workflowMetrics.activeWorkflows = activeWorkflows;

        // Update total workflows created if it's higher
        if (totalWorkflows > this.statistics.totalStats.totalWorkflowsCreated) {
            this.statistics.totalStats.totalWorkflowsCreated = totalWorkflows;
        }
    }

    /**
     * Get tasks within a specific time window
     */
    private getTimeWindowTasks(windowMs: number): TaskExecutionRecord[] {
        const now = new Date();
        const windowStart = new Date(now.getTime() - windowMs);
        return this.taskExecutionRecords.filter(record => record.timestamp >= windowStart);
    }

    /**
     * Calculate tasks per minute based on actual time window
     */
    private calculateTasksPerMinute(): number {
        const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
        const tasksInLastMinute = this.taskExecutionRecords.filter(
            record => record.timestamp >= oneMinuteAgo
        );
        return tasksInLastMinute.length;
    }

    /**
     * Update real-time metrics
     */
    private updateRealTimeMetrics(): void {
        const now = new Date();

        // Calculate tasks per minute based on actual time window (last 60 seconds)
        const tasksPerMinute = this.calculateTasksPerMinute();
        this.metrics.taskMetrics.tasksPerMinute = tasksPerMinute;

        // Update peak tasks per minute
        if (tasksPerMinute > this.metrics.taskMetrics.peakTasksPerMinute) {
            this.metrics.taskMetrics.peakTasksPerMinute = tasksPerMinute;
        }

        // Update uptime
        this.metrics.systemMetrics.uptime = now.getTime() - this.startTime.getTime();
        this.statistics.totalStats.totalUptime = this.metrics.systemMetrics.uptime;

        // Update last update time
        this.metrics.realTimeMetrics.lastUpdateTime = now;
    }

    /**
     * Update system resource metrics
     */
    private async updateSystemMetrics(): Promise<void> {
        try {
            // Get storage usage
            const storageInfo = await this.getStorageInfo();
            this.metrics.systemMetrics.storageUsage = storageInfo.used;
            this.metrics.systemMetrics.storageQuota = storageInfo.quota;

            // Get memory usage (approximate)
            this.metrics.systemMetrics.memoryUsage = this.getMemoryUsage();

        } catch (error) {
            console.error('Failed to update system metrics:', error);
        }
    }

    /**
     * Get storage usage information
     */
    private async getStorageInfo(): Promise<{ used: number; quota: number }> {
        try {
            if ('storage' in navigator && 'estimate' in navigator.storage) {
                const estimate = await navigator.storage.estimate();
                return {
                    used: estimate.usage || 0,
                    quota: estimate.quota || 0
                };
            }
        } catch (error) {
            console.error('Failed to get storage estimate:', error);
        }

        // Fallback: estimate based on localStorage
        let localStorageSize = 0;
        try {
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    localStorageSize += localStorage[key].length;
                }
            }
        } catch (error) {
            // localStorage might not be available
        }

        return {
            used: localStorageSize,
            quota: 5 * 1024 * 1024 // 5MB default estimate
        };
    }

    /**
     * Get approximate memory usage
     */
    private getMemoryUsage(): number {
        // This is an approximation since we can't get actual memory usage in browsers
        if ('memory' in performance && 'usedJSHeapSize' in (performance as any).memory) {
            return (performance as any).memory.usedJSHeapSize;
        }
        return 0;
    }

    /**
     * Get current performance metrics
     */
    getMetrics(): PerformanceMetrics {
        return { ...this.metrics };
    }

    /**
     * Get usage statistics
     */
    getStatistics(): UsageStatistics {
        return { ...this.statistics };
    }

    /**
     * Get system resource information
     */
    async getSystemResourceInfo(): Promise<SystemResourceInfo> {
        const storageInfo = await this.getStorageInfo();

        return {
            memory: {
                used: this.getMemoryUsage(),
                available: 0, // Not available in browsers
                percentage: 0
            },
            storage: {
                used: storageInfo.used,
                quota: storageInfo.quota,
                percentage: storageInfo.quota > 0 ? (storageInfo.used / storageInfo.quota) * 100 : 0,
                breakdown: {
                    agents: 0, // Would need to be calculated
                    tasks: 0,
                    workflows: 0,
                    logs: 0,
                    other: storageInfo.used
                }
            },
            network: {
                apiCallsTotal: this.apiCallTimes.length,
                apiCallsPerMinute: this.metrics.systemMetrics.apiCallsPerMinute,
                averageLatency: this.apiCallTimes.length > 0
                    ? this.apiCallTimes.reduce((sum, call) => sum + call.duration, 0) / this.apiCallTimes.length
                    : 0,
                errorRate: this.metrics.systemMetrics.errorRate
            },
            browser: {
                userAgent: navigator.userAgent,
                language: navigator.language,
                platform: navigator.platform,
                cookiesEnabled: navigator.cookieEnabled,
                localStorageAvailable: this.isLocalStorageAvailable(),
                indexedDBAvailable: this.isIndexedDBAvailable()
            }
        };
    }

    /**
     * Subscribe to real-time metric updates
     */
    subscribe(listener: (metrics: PerformanceMetrics) => void): () => void {
        this.listeners.push(listener);

        // Return unsubscribe function
        return () => {
            const index = this.listeners.indexOf(listener);
            if (index > -1) {
                this.listeners.splice(index, 1);
            }
        };
    }

    /**
     * Notify all listeners of metric updates
     */
    private notifyListeners(): void {
        const metrics = this.getMetrics();
        this.listeners.forEach(listener => {
            try {
                listener(metrics);
            } catch (error) {
                console.error('Error in performance monitor listener:', error);
            }
        });
    }

    /**
     * Update daily statistics
     */
    private updateDailyStats(): void {
        const today = new Date().toISOString().split('T')[0];
        let todayStats = this.statistics.dailyStats.find(stat => stat.date === today);

        if (!todayStats) {
            todayStats = {
                date: today,
                tasksExecuted: 0,
                agentsUsed: 0,
                workflowsRun: 0,
                averageResponseTime: 0,
                errorCount: 0
            };
            this.statistics.dailyStats.push(todayStats);
        }

        // Update today's stats
        todayStats.tasksExecuted = this.metrics.taskMetrics.totalExecuted;
        todayStats.agentsUsed = this.metrics.agentMetrics.totalAgents;
        todayStats.workflowsRun = this.statistics.totalStats.totalWorkflowsExecuted;
        todayStats.averageResponseTime = this.metrics.taskMetrics.averageExecutionTime;

        // Keep only last 30 days
        if (this.statistics.dailyStats.length > 30) {
            this.statistics.dailyStats.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            this.statistics.dailyStats = this.statistics.dailyStats.slice(0, 30);
        }
    }

    /**
     * Check if localStorage is available
     */
    private isLocalStorageAvailable(): boolean {
        try {
            const test = '__localStorage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Check if IndexedDB is available
     */
    private isIndexedDBAvailable(): boolean {
        return 'indexedDB' in window;
    }

    /**
     * Save statistics to localStorage
     */
    private saveStatistics(): void {
        try {
            this.updateDailyStats();
            localStorage.setItem('performance_statistics', JSON.stringify(this.statistics));
        } catch (error) {
            console.error('Failed to save performance statistics:', error);
        }
    }

    /**
     * Load historical data from localStorage
     */
    private loadHistoricalData(): void {
        try {
            const saved = localStorage.getItem('performance_statistics');
            if (saved) {
                const parsed = JSON.parse(saved);

                // Merge with current statistics
                this.statistics = {
                    ...this.statistics,
                    ...parsed,
                    totalStats: {
                        ...this.statistics.totalStats,
                        ...parsed.totalStats,
                        firstUsageDate: new Date(parsed.totalStats?.firstUsageDate || new Date()),
                        lastActiveDate: new Date(parsed.totalStats?.lastActiveDate || new Date())
                    }
                };
            }
        } catch (error) {
            console.error('Failed to load historical performance data:', error);
        }
    }

    /**
     * Reset all statistics (for testing or cleanup)
     */
    resetStatistics(): void {
        this.initializeStatistics();
        this.taskExecutionRecords = [];
        this.apiCallTimes = [];
        localStorage.removeItem('performance_statistics');
    }

    /**
     * Export performance data
     */
    exportData(): string {
        return JSON.stringify({
            metrics: this.metrics,
            statistics: this.statistics,
            exportDate: new Date().toISOString()
        }, null, 2);
    }

    /**
     * Cleanup resources
     */
    destroy(): void {
        this.stopMonitoring();
        this.listeners = [];
        this.saveStatistics();
    }
}