import React, { useState, useEffect } from 'react';
import { Task, TaskStatus } from '../types/task';
import { Agent } from '../types/agent';
import TaskCard from './TaskCard';
import TaskCreationModal from './TaskCreationModal';
import './TaskMonitor.css';

interface TaskMonitorProps {
    tasks: Task[];
    agents: Agent[];
    onTasksUpdate: (tasks: Task[]) => void;
    onCreateTask: (taskData: Omit<Task, 'id' | 'createdAt' | 'retryCount'>) => Promise<Task>;
    onUpdateTask: (task: Task) => Promise<void>;
    onDeleteTask: (taskId: string) => Promise<void>;
}

const TaskMonitor: React.FC<TaskMonitorProps> = ({
    tasks,
    agents,
    onTasksUpdate,
    onCreateTask,
    onUpdateTask,
    onDeleteTask
}) => {
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all');
    const [sortBy, setSortBy] = useState<'priority' | 'created' | 'status'>('priority');
    const [searchTerm, setSearchTerm] = useState('');
    const [autoRefresh, setAutoRefresh] = useState(true);

    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        if (!autoRefresh) return;

        const interval = setInterval(() => {
            // Simulate real-time updates
            // In a real implementation, this would fetch from the task queue
        }, 2000);

        return () => clearInterval(interval);
    }, [autoRefresh]);

    const getStatusCounts = () => {
        return {
            total: tasks.length,
            pending: tasks.filter(t => t.status === 'pending').length,
            running: tasks.filter(t => t.status === 'running').length,
            completed: tasks.filter(t => t.status === 'completed').length,
            failed: tasks.filter(t => t.status === 'failed').length
        };
    };

    const filteredAndSortedTasks = tasks
        .filter(task => {
            const matchesStatus = filterStatus === 'all' || task.status === filterStatus;
            const matchesSearch = task.prompt.toLowerCase().includes(searchTerm.toLowerCase()) ||
                task.id.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesStatus && matchesSearch;
        })
        .sort((a, b) => {
            switch (sortBy) {
                case 'priority':
                    return b.priority - a.priority;
                case 'created':
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                case 'status':
                    return a.status.localeCompare(b.status);
                default:
                    return 0;
            }
        });

    const handleCreateTask = async (taskData: Omit<Task, 'id' | 'createdAt' | 'status' | 'retryCount'>) => {
        try {
            setIsCreating(true);
            await onCreateTask({
                ...taskData,
                status: 'pending'
            });
            setShowCreateModal(false);
        } catch (error) {
            console.error('Failed to create task:', error);
            // Error handling is managed by the context
        } finally {
            setIsCreating(false);
        }
    };

    const handleUpdateTask = async (updatedTask: Task) => {
        try {
            await onUpdateTask(updatedTask);
        } catch (error) {
            console.error('Failed to update task:', error);
            // Error handling is managed by the context
        }
    };

    const handleDeleteTask = async (taskId: string) => {
        if (confirm('Are you sure you want to delete this task?')) {
            try {
                await onDeleteTask(taskId);
            } catch (error) {
                console.error('Failed to delete task:', error);
                // Error handling is managed by the context
            }
        }
    };

    const handleRetryTask = (taskId: string) => {
        const task = tasks.find(t => t.id === taskId);
        if (task && task.status === 'failed') {
            const updatedTask = {
                ...task,
                status: 'pending' as TaskStatus,
                retryCount: task.retryCount + 1,
                error: undefined
            };
            handleUpdateTask(updatedTask);
        }
    };

    const handleClearCompleted = () => {
        if (confirm('Are you sure you want to clear all completed tasks?')) {
            onTasksUpdate(tasks.filter(task => task.status !== 'completed'));
        }
    };

    const statusCounts = getStatusCounts();

    return (
        <div className="task-monitor">
            <div className="task-monitor-header">
                <div className="header-left">
                    <h2>Task Queue Monitor</h2>
                    <div className="task-stats">
                        <div className="stat-item">
                            <span className="stat-value">{statusCounts.total}</span>
                            <span className="stat-label">Total</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-value pending">{statusCounts.pending}</span>
                            <span className="stat-label">Pending</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-value running">{statusCounts.running}</span>
                            <span className="stat-label">Running</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-value completed">{statusCounts.completed}</span>
                            <span className="stat-label">Completed</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-value failed">{statusCounts.failed}</span>
                            <span className="stat-label">Failed</span>
                        </div>
                    </div>
                </div>
                <div className="header-actions">
                    <button
                        className="create-task-btn"
                        onClick={() => setShowCreateModal(true)}
                        disabled={isCreating}
                    >
                        <span>+</span>
                        {isCreating ? 'Creating...' : 'Add Task'}
                    </button>
                    <button
                        className="clear-completed-btn"
                        onClick={handleClearCompleted}
                        disabled={statusCounts.completed === 0}
                    >
                        Clear Completed
                    </button>
                </div>
            </div>

            <div className="task-controls">
                <div className="search-box">
                    <input
                        type="text"
                        placeholder="Search tasks by prompt or ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                    />
                </div>

                <div className="filter-controls">
                    <div className="control-group">
                        <label>Status:</label>
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value as TaskStatus | 'all')}
                            className="status-filter"
                        >
                            <option value="all">All</option>
                            <option value="pending">Pending</option>
                            <option value="running">Running</option>
                            <option value="completed">Completed</option>
                            <option value="failed">Failed</option>
                        </select>
                    </div>

                    <div className="control-group">
                        <label>Sort by:</label>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as 'priority' | 'created' | 'status')}
                            className="sort-select"
                        >
                            <option value="priority">Priority</option>
                            <option value="created">Created Date</option>
                            <option value="status">Status</option>
                        </select>
                    </div>

                    <div className="control-group">
                        <label className="auto-refresh-label">
                            <input
                                type="checkbox"
                                checked={autoRefresh}
                                onChange={(e) => setAutoRefresh(e.target.checked)}
                            />
                            Auto Refresh
                        </label>
                    </div>
                </div>
            </div>

            <div className="tasks-list">
                {filteredAndSortedTasks.length === 0 ? (
                    <div className="no-tasks">
                        {tasks.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-icon">📋</div>
                                <h3>No tasks in queue</h3>
                                <p>Create your first task to start automating work with AI agents.</p>
                                <button
                                    className="create-first-task-btn"
                                    onClick={() => setShowCreateModal(true)}
                                    disabled={isCreating}
                                >
                                    {isCreating ? 'Creating...' : 'Create First Task'}
                                </button>
                            </div>
                        ) : (
                            <div className="no-results">
                                <p>No tasks match your current filters.</p>
                            </div>
                        )}
                    </div>
                ) : (
                    filteredAndSortedTasks.map(task => (
                        <TaskCard
                            key={task.id}
                            task={task}
                            agents={agents}
                            onUpdate={handleUpdateTask}
                            onDelete={handleDeleteTask}
                            onRetry={handleRetryTask}
                        />
                    ))
                )}
            </div>

            {showCreateModal && (
                <TaskCreationModal
                    onClose={() => setShowCreateModal(false)}
                    onCreate={handleCreateTask}
                    agents={agents}
                    isCreating={isCreating}
                />
            )}
        </div>
    );
};

export default TaskMonitor;