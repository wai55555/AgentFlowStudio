import React, { useState } from 'react';
import { Task, TaskStatus } from '../types/task';
import { Agent } from '../types/agent';
import './TaskCard.css';

interface TaskCardProps {
    task: Task;
    agents: Agent[];
    onUpdate: (task: Task) => void;
    onDelete: (taskId: string) => void;
    onRetry: (taskId: string) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({
    task,
    agents,
    onUpdate,
    onDelete,
    onRetry
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const getStatusColor = (status: TaskStatus) => {
        switch (status) {
            case 'pending': return '#f39c12';
            case 'running': return '#3498db';
            case 'completed': return '#27ae60';
            case 'failed': return '#e74c3c';
            default: return '#95a5a6';
        }
    };

    const getStatusIcon = (status: TaskStatus) => {
        switch (status) {
            case 'pending': return '⏳';
            case 'running': return '⚡';
            case 'completed': return '✅';
            case 'failed': return '❌';
            default: return '❓';
        }
    };

    const getPriorityLabel = (priority: number) => {
        if (priority >= 8) return 'Critical';
        if (priority >= 6) return 'High';
        if (priority >= 4) return 'Medium';
        if (priority >= 2) return 'Low';
        return 'Minimal';
    };

    const getPriorityColor = (priority: number) => {
        if (priority >= 8) return '#e74c3c';
        if (priority >= 6) return '#f39c12';
        if (priority >= 4) return '#3498db';
        if (priority >= 2) return '#27ae60';
        return '#95a5a6';
    };

    const formatDuration = (start?: Date, end?: Date) => {
        if (!start) return 'Not started';
        if (!end) return 'In progress';

        const duration = end.getTime() - start.getTime();
        const seconds = Math.floor(duration / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    };

    const formatTimestamp = (date: Date) => {
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    };

    const getAssignedAgent = () => {
        // In a real implementation, this would track which agent is assigned to the task
        return agents.find(agent => agent.status === 'busy');
    };

    const assignedAgent = getAssignedAgent();

    return (
        <div className={`task-card ${task.status}`}>
            <div className="task-card-header">
                <div className="task-info">
                    <div className="task-id-status">
                        <span className="task-id">#{task.id.slice(-8)}</span>
                        <div className="task-status">
                            <span
                                className="status-indicator"
                                style={{ backgroundColor: getStatusColor(task.status) }}
                            >
                                {getStatusIcon(task.status)}
                            </span>
                            <span className="status-text">{task.status}</span>
                        </div>
                    </div>
                    <div className="task-priority">
                        <span
                            className="priority-badge"
                            style={{ backgroundColor: getPriorityColor(task.priority) }}
                        >
                            {getPriorityLabel(task.priority)}
                        </span>
                        <span className="priority-value">P{task.priority}</span>
                    </div>
                </div>
                <div className="task-actions">
                    {task.status === 'failed' && (
                        <button
                            className="action-btn retry-btn"
                            onClick={() => onRetry(task.id)}
                            title="Retry task"
                        >
                            🔄
                        </button>
                    )}
                    <button
                        className="action-btn expand-btn"
                        onClick={() => setIsExpanded(!isExpanded)}
                        title={isExpanded ? 'Collapse' : 'Expand'}
                    >
                        {isExpanded ? '▲' : '▼'}
                    </button>
                    <button
                        className="action-btn delete-btn"
                        onClick={() => onDelete(task.id)}
                        title="Delete task"
                    >
                        🗑️
                    </button>
                </div>
            </div>

            <div className="task-prompt">
                <p>{task.prompt}</p>
            </div>

            <div className="task-meta">
                <div className="meta-item">
                    <span className="meta-label">Created:</span>
                    <span className="meta-value">{formatTimestamp(task.createdAt)}</span>
                </div>
                <div className="meta-item">
                    <span className="meta-label">Type:</span>
                    <span className="meta-value">{task.type}</span>
                </div>
                {task.retryCount > 0 && (
                    <div className="meta-item">
                        <span className="meta-label">Retries:</span>
                        <span className="meta-value">{task.retryCount}</span>
                    </div>
                )}
                {assignedAgent && (
                    <div className="meta-item">
                        <span className="meta-label">Agent:</span>
                        <span className="meta-value">{assignedAgent.name}</span>
                    </div>
                )}
            </div>

            {isExpanded && (
                <div className="task-details">
                    <div className="detail-section">
                        <h4>Timing</h4>
                        <div className="timing-info">
                            <div className="timing-item">
                                <span className="timing-label">Duration:</span>
                                <span className="timing-value">
                                    {formatDuration(task.startedAt, task.completedAt)}
                                </span>
                            </div>
                            {task.startedAt && (
                                <div className="timing-item">
                                    <span className="timing-label">Started:</span>
                                    <span className="timing-value">
                                        {formatTimestamp(task.startedAt)}
                                    </span>
                                </div>
                            )}
                            {task.completedAt && (
                                <div className="timing-item">
                                    <span className="timing-label">Completed:</span>
                                    <span className="timing-value">
                                        {formatTimestamp(task.completedAt)}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {task.dependencies.length > 0 && (
                        <div className="detail-section">
                            <h4>Dependencies</h4>
                            <div className="dependencies">
                                {task.dependencies.map(dep => (
                                    <span key={dep} className="dependency-tag">
                                        #{dep.slice(-8)}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {task.result && (
                        <div className="detail-section">
                            <h4>Result</h4>
                            <div className="task-result">
                                {task.result}
                            </div>
                        </div>
                    )}

                    {task.error && (
                        <div className="detail-section">
                            <h4>Error</h4>
                            <div className="task-error">
                                {task.error}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default TaskCard;