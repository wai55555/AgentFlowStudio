import React, { useState, useEffect } from 'react';
import { Agent } from '../types/agent';
import { Task } from '../types/task';
import { Workflow } from '../types/workflow';
import { AppState } from '../types/storage';
import { StatisticsService, RealTimeStats, DetailedStatistics } from '../services/statisticsService';
import './SystemMonitor.css';

interface SystemMonitorProps {
    systemStatus: AppState['systemStatus'];
    agents: Agent[];
    tasks: Task[];
    workflows: Workflow[];
    statisticsService?: StatisticsService;
}

const SystemMonitor: React.FC<SystemMonitorProps> = ({
    systemStatus,
    agents,
    tasks,
    workflows,
    statisticsService
}) => {
    const [realTimeStats, setRealTimeStats] = useState<RealTimeStats | null>(null);
    const [detailedStats, setDetailedStats] = useState<DetailedStatistics | null>(null);
    const [showDetailedView, setShowDetailedView] = useState(false);
    // const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!statisticsService) return;

        // Subscribe to real-time updates
        const unsubscribe = statisticsService.subscribe((stats: RealTimeStats) => {
            setRealTimeStats(stats);
        });

        // Load detailed statistics initially
        setDetailedStats(statisticsService.getDetailedStatistics());

        // Refresh detailed statistics every 30 seconds
        const interval = setInterval(() => {
            setDetailedStats(statisticsService.getDetailedStatistics());
        }, 30000);

        // setRefreshInterval(interval);

        return () => {
            unsubscribe();
            if (interval) clearInterval(interval);
        };
    }, [statisticsService]);

    // Fallback to basic calculations if no statistics service
    const stats = realTimeStats || {
        currentState: {
            totalAgents: agents.length,
            activeAgents: agents.filter(a => a.status === 'busy').length,
            idleAgents: agents.filter(a => a.status === 'idle').length,
            errorAgents: agents.filter(a => a.status === 'error').length,
            totalTasks: tasks.length,
            pendingTasks: tasks.filter(t => t.status === 'pending').length,
            runningTasks: tasks.filter(t => t.status === 'running').length,
            completedTasks: tasks.filter(t => t.status === 'completed').length,
            failedTasks: tasks.filter(t => t.status === 'failed').length,
            totalWorkflows: workflows.length,
            runningWorkflows: workflows.filter(w => w.status === 'running').length,
            queueLength: systemStatus.queueLength
        },
        performance: {
            tasksPerMinute: 0,
            averageTaskDuration: 0,
            agentUtilization: agents.length > 0 ? (agents.filter(a => a.status === 'busy').length / agents.length) * 100 : 0,
            successRate: tasks.length > 0 ? (tasks.filter(t => t.status === 'completed').length / tasks.length) * 100 : 0,
            errorRate: tasks.length > 0 ? (tasks.filter(t => t.status === 'failed').length / tasks.length) * 100 : 0,
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
            tasksTrend: 'stable' as const,
            performanceTrend: 'stable' as const,
            errorTrend: 'stable' as const,
            utilizationTrend: 'stable' as const
        },
        lastUpdated: new Date()
    };
    const getAgentStatusBreakdown = () => {
        return {
            idle: stats.currentState.idleAgents,
            busy: stats.currentState.activeAgents,
            error: stats.currentState.errorAgents
        };
    };

    const getTaskStatusBreakdown = () => {
        return {
            pending: stats.currentState.pendingTasks,
            running: stats.currentState.runningTasks,
            completed: stats.currentState.completedTasks,
            failed: stats.currentState.failedTasks
        };
    };

    const getWorkflowStatusBreakdown = () => {
        return {
            draft: workflows.filter(w => w.status === 'draft').length,
            running: stats.currentState.runningWorkflows,
            completed: workflows.filter(w => w.status === 'completed').length,
            failed: workflows.filter(w => w.status === 'failed').length
        };
    };

    const getTopPerformingAgents = () => {
        if (detailedStats?.agentStats.topPerformers) {
            return detailedStats.agentStats.topPerformers.slice(0, 5);
        }
        return [...agents]
            .sort((a, b) => b.stats.tasksCompleted - a.stats.tasksCompleted)
            .slice(0, 5);
    };

    const getRecentTasks = () => {
        if (detailedStats?.taskStats.recentTasks) {
            return detailedStats.taskStats.recentTasks.slice(0, 5);
        }
        return [...tasks]
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 5);
    };

    const formatUptime = (uptime: number) => {
        if (uptime === 0) return '0s';

        const seconds = Math.floor(uptime / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ${hours % 24}h`;
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
        switch (trend) {
            case 'up': return '↗️';
            case 'down': return '↘️';
            default: return '➡️';
        }
    };

    const getTrendColor = (trend: 'up' | 'down' | 'stable', isGoodWhenUp: boolean = true) => {
        if (trend === 'stable') return '#95a5a6';
        const isGood = isGoodWhenUp ? trend === 'up' : trend === 'down';
        return isGood ? '#27ae60' : '#e74c3c';
    };

    const agentBreakdown = getAgentStatusBreakdown();
    const taskBreakdown = getTaskStatusBreakdown();
    const workflowBreakdown = getWorkflowStatusBreakdown();
    const topAgents = getTopPerformingAgents();
    const recentTasks = getRecentTasks();

    const formatTimestamp = (date: Date) => {
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    };

    return (
        <div className="system-monitor">
            <div className="monitor-header">
                <h2>System Dashboard</h2>
                <div className="monitor-controls">
                    <div className="last-updated">
                        Last updated: {stats.lastUpdated.toLocaleTimeString()}
                    </div>
                    <button
                        className={`view-toggle ${showDetailedView ? 'active' : ''}`}
                        onClick={() => setShowDetailedView(!showDetailedView)}
                    >
                        {showDetailedView ? 'Simple View' : 'Detailed View'}
                    </button>
                </div>
            </div>

            {/* Real-time Performance Indicators */}
            <div className="performance-indicators">
                <div className="indicator">
                    <span className="indicator-label">Tasks/min</span>
                    <span className="indicator-value">
                        {stats.performance.tasksPerMinute.toFixed(1)}
                        <span
                            className="trend-icon"
                            style={{ color: getTrendColor(stats.trends.tasksTrend) }}
                        >
                            {getTrendIcon(stats.trends.tasksTrend)}
                        </span>
                    </span>
                </div>
                <div className="indicator">
                    <span className="indicator-label">Utilization</span>
                    <span className="indicator-value">
                        {stats.performance.agentUtilization.toFixed(1)}%
                        <span
                            className="trend-icon"
                            style={{ color: getTrendColor(stats.trends.utilizationTrend) }}
                        >
                            {getTrendIcon(stats.trends.utilizationTrend)}
                        </span>
                    </span>
                </div>
                <div className="indicator">
                    <span className="indicator-label">Success Rate</span>
                    <span className="indicator-value">
                        {stats.performance.successRate.toFixed(1)}%
                        <span
                            className="trend-icon"
                            style={{ color: getTrendColor(stats.trends.performanceTrend) }}
                        >
                            {getTrendIcon(stats.trends.performanceTrend)}
                        </span>
                    </span>
                </div>
                <div className="indicator">
                    <span className="indicator-label">Uptime</span>
                    <span className="indicator-value">
                        {formatUptime(stats.performance.systemUptime)}
                    </span>
                </div>
            </div>

            {/* Overview Cards */}
            <div className="overview-cards">
                <div className="overview-card agents">
                    <div className="card-icon">🤖</div>
                    <div className="card-content">
                        <h3>Agents</h3>
                        <div className="card-value">{stats.currentState.totalAgents}</div>
                        <div className="card-breakdown">
                            <span className="breakdown-item idle">
                                {agentBreakdown.idle} Idle
                            </span>
                            <span className="breakdown-item busy">
                                {agentBreakdown.busy} Busy
                            </span>
                            {agentBreakdown.error > 0 && (
                                <span className="breakdown-item error">
                                    {agentBreakdown.error} Error
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="overview-card tasks">
                    <div className="card-icon">📋</div>
                    <div className="card-content">
                        <h3>Tasks</h3>
                        <div className="card-value">{stats.currentState.totalTasks}</div>
                        <div className="card-breakdown">
                            <span className="breakdown-item pending">
                                {taskBreakdown.pending} Pending
                            </span>
                            <span className="breakdown-item running">
                                {taskBreakdown.running} Running
                            </span>
                            <span className="breakdown-item completed">
                                {taskBreakdown.completed} Done
                            </span>
                        </div>
                    </div>
                </div>

                <div className="overview-card workflows">
                    <div className="card-icon">🔄</div>
                    <div className="card-content">
                        <h3>Workflows</h3>
                        <div className="card-value">{stats.currentState.totalWorkflows}</div>
                        <div className="card-breakdown">
                            <span className="breakdown-item draft">
                                {workflowBreakdown.draft} Draft
                            </span>
                            <span className="breakdown-item running">
                                {workflowBreakdown.running} Running
                            </span>
                            <span className="breakdown-item completed">
                                {workflowBreakdown.completed} Done
                            </span>
                        </div>
                    </div>
                </div>

                <div className="overview-card resources">
                    <div className="card-icon">💾</div>
                    <div className="card-content">
                        <h3>Resources</h3>
                        <div className="card-value">{stats.resources.storagePercentage.toFixed(1)}%</div>
                        <div className="card-breakdown">
                            <span className="breakdown-item">
                                {formatBytes(stats.resources.storageUsage)} used
                            </span>
                            <span className="breakdown-item">
                                {stats.resources.apiCallsPerMinute} API/min
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {showDetailedView && detailedStats && (
                <div className="detailed-view">
                    {/* Resource Usage Details */}
                    <div className="detail-panel resource-details">
                        <h3>Resource Usage</h3>
                        <div className="resource-metrics">
                            <div className="resource-item">
                                <span className="resource-label">Storage</span>
                                <div className="resource-bar">
                                    <div
                                        className="resource-fill"
                                        style={{
                                            width: `${stats.resources.storagePercentage}%`,
                                            backgroundColor: stats.resources.storagePercentage > 80 ? '#e74c3c' : '#3498db'
                                        }}
                                    />
                                </div>
                                <span className="resource-value">
                                    {formatBytes(stats.resources.storageUsage)} / {formatBytes(stats.resources.storageQuota)}
                                </span>
                            </div>
                            {stats.resources.memoryUsage > 0 && (
                                <div className="resource-item">
                                    <span className="resource-label">Memory</span>
                                    <div className="resource-bar">
                                        <div
                                            className="resource-fill"
                                            style={{
                                                width: '0%', // Memory percentage not available in browsers
                                                backgroundColor: '#27ae60'
                                            }}
                                        />
                                    </div>
                                    <span className="resource-value">
                                        {formatBytes(stats.resources.memoryUsage)}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Performance Metrics */}
                    <div className="detail-panel performance-details">
                        <h3>Performance Metrics</h3>
                        <div className="performance-grid">
                            <div className="metric-item">
                                <span className="metric-label">Avg Task Duration</span>
                                <span className="metric-value">
                                    {stats.performance.averageTaskDuration > 0
                                        ? `${(stats.performance.averageTaskDuration / 1000).toFixed(2)}s`
                                        : 'N/A'
                                    }
                                </span>
                            </div>
                            <div className="metric-item">
                                <span className="metric-label">Error Rate</span>
                                <span className="metric-value" style={{
                                    color: stats.performance.errorRate > 10 ? '#e74c3c' : '#27ae60'
                                }}>
                                    {stats.performance.errorRate.toFixed(1)}%
                                </span>
                            </div>
                            <div className="metric-item">
                                <span className="metric-label">Queue Length</span>
                                <span className="metric-value">
                                    {stats.currentState.queueLength}
                                </span>
                            </div>
                            <div className="metric-item">
                                <span className="metric-label">API Calls/min</span>
                                <span className="metric-value">
                                    {stats.resources.apiCallsPerMinute}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Details Section */}
            <div className="details-section">
                {/* Top Performing Agents */}
                <div className="detail-panel">
                    <h3>Top Performing Agents</h3>
                    {topAgents.length > 0 ? (
                        <div className="agent-list">
                            {topAgents.map(agent => (
                                <div key={agent.id} className="agent-item">
                                    <div className="agent-info">
                                        <span className="agent-name">{agent.name}</span>
                                        <span className="agent-role">
                                            {'role' in agent ? agent.role : 'Unknown'}
                                            {detailedStats && 'successRate' in agent && (
                                                <span className="success-rate">
                                                    • {agent.successRate.toFixed(1)}% success
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                    <div className="agent-metrics">
                                        <span className="metric">
                                            {'stats' in agent ? agent.stats.tasksCompleted : agent.tasksCompleted} tasks
                                        </span>
                                        <span className="metric">
                                            {'stats' in agent
                                                ? (agent.stats.averageResponseTime < 1000
                                                    ? `${agent.stats.averageResponseTime}ms`
                                                    : `${(agent.stats.averageResponseTime / 1000).toFixed(1)}s`)
                                                : (agent.averageResponseTime < 1000
                                                    ? `${agent.averageResponseTime}ms`
                                                    : `${(agent.averageResponseTime / 1000).toFixed(1)}s`)
                                            }
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="empty-panel">
                            <p>No agents created yet</p>
                        </div>
                    )}
                </div>

                {/* Recent Tasks */}
                <div className="detail-panel">
                    <h3>Recent Tasks</h3>
                    {recentTasks.length > 0 ? (
                        <div className="task-list">
                            {recentTasks.map(task => (
                                <div key={task.id} className="task-item">
                                    <div className="task-info">
                                        <span className={`task-status ${task.status}`}>
                                            {task.status}
                                        </span>
                                        <span className="task-prompt">
                                            {'prompt' in task ? task.prompt.substring(0, 60) : 'No description'}
                                            {'prompt' in task && task.prompt.length > 60 ? '...' : ''}
                                        </span>
                                        {'completedAt' in task && 'startedAt' in task && task.completedAt && task.startedAt && (
                                            <span className="task-duration">
                                                Duration: {((task.completedAt.getTime() - task.startedAt.getTime()) / 1000).toFixed(2)}s
                                            </span>
                                        )}
                                    </div>
                                    <div className="task-meta">
                                        <span className="task-time">
                                            {formatTimestamp(task.createdAt)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="empty-panel">
                            <p>No tasks created yet</p>
                        </div>
                    )}
                </div>
            </div>

            {/* System Health */}
            <div className="system-health">
                <h3>System Health</h3>
                <div className="health-indicators">
                    <div className="health-item">
                        <span className="health-label">Agent Utilization</span>
                        <div className="health-bar">
                            <div
                                className="health-fill"
                                style={{
                                    width: `${stats.performance.agentUtilization}%`,
                                    backgroundColor: '#3498db'
                                }}
                            />
                        </div>
                        <span className="health-value">
                            {stats.performance.agentUtilization.toFixed(0)}%
                        </span>
                    </div>

                    <div className="health-item">
                        <span className="health-label">Task Success Rate</span>
                        <div className="health-bar">
                            <div
                                className="health-fill"
                                style={{
                                    width: `${stats.performance.successRate}%`,
                                    backgroundColor: '#27ae60'
                                }}
                            />
                        </div>
                        <span className="health-value">
                            {stats.performance.successRate.toFixed(0)}%
                        </span>
                    </div>

                    <div className="health-item">
                        <span className="health-label">Error Rate</span>
                        <div className="health-bar">
                            <div
                                className="health-fill"
                                style={{
                                    width: `${stats.performance.errorRate}%`,
                                    backgroundColor: '#e74c3c'
                                }}
                            />
                        </div>
                        <span className="health-value">
                            {stats.performance.errorRate.toFixed(0)}%
                        </span>
                    </div>

                    <div className="health-item">
                        <span className="health-label">Storage Usage</span>
                        <div className="health-bar">
                            <div
                                className="health-fill"
                                style={{
                                    width: `${stats.resources.storagePercentage}%`,
                                    backgroundColor: stats.resources.storagePercentage > 80 ? '#e74c3c' : '#f39c12'
                                }}
                            />
                        </div>
                        <span className="health-value">
                            {stats.resources.storagePercentage.toFixed(0)}%
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SystemMonitor;