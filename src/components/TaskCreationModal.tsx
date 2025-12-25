import React, { useState } from 'react';
import { Task, TaskType } from '../types/task';
import { Agent } from '../types/agent';
import './TaskCreationModal.css';

interface TaskCreationModalProps {
    onClose: () => void;
    onCreate: (task: Omit<Task, 'id' | 'createdAt' | 'status' | 'retryCount'>) => Promise<void>;
    agents: Agent[];
    isCreating?: boolean;
}

const TaskCreationModal: React.FC<TaskCreationModalProps> = ({ onClose, onCreate, agents, /* isCreating = false */ }) => {
    const [formData, setFormData] = useState({
        type: 'simple' as TaskType,
        priority: 5,
        prompt: '',
        dependencies: [] as string[]
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        if (!formData.prompt.trim()) {
            newErrors.prompt = 'Task prompt is required';
        }

        if (formData.priority < 1 || formData.priority > 10) {
            newErrors.priority = 'Priority must be between 1 and 10';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (validateForm()) {
            onCreate(formData);
        }
    };

    const handleInputChange = (field: string, value: string | number | string[]) => {
        setFormData(prev => ({ ...prev, [field]: value }));

        // Clear error for this field when user starts typing
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: '' }));
        }
    };

    const presetTasks = [
        {
            name: 'Data Analysis',
            prompt: 'Analyze the provided dataset and identify key trends, patterns, and insights. Provide a summary with actionable recommendations.',
            priority: 6,
            type: 'simple' as TaskType
        },
        {
            name: 'Content Generation',
            prompt: 'Create engaging content for the specified topic. Include relevant examples, maintain consistent tone, and optimize for readability.',
            priority: 4,
            type: 'simple' as TaskType
        },
        {
            name: 'Code Review',
            prompt: 'Review the provided code for best practices, potential bugs, security issues, and performance optimizations. Provide detailed feedback.',
            priority: 7,
            type: 'simple' as TaskType
        },
        {
            name: 'Research Summary',
            prompt: 'Research the given topic and provide a comprehensive summary with key findings, sources, and implications.',
            priority: 5,
            type: 'simple' as TaskType
        }
    ];

    const applyPreset = (preset: typeof presetTasks[0]) => {
        setFormData(prev => ({
            ...prev,
            prompt: preset.prompt,
            priority: preset.priority,
            type: preset.type
        }));
        setErrors({});
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

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Create New Task</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div className="modal-body">
                    <div className="presets-section">
                        <h3>Quick Start Templates</h3>
                        <div className="presets-grid">
                            {presetTasks.map((preset, index) => (
                                <button
                                    key={index}
                                    className="preset-btn"
                                    onClick={() => applyPreset(preset)}
                                >
                                    <strong>{preset.name}</strong>
                                    <span>Priority: {preset.priority}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="task-form">
                        <div className="form-group">
                            <label htmlFor="type">Task Type</label>
                            <select
                                id="type"
                                value={formData.type}
                                onChange={(e) => handleInputChange('type', e.target.value as TaskType)}
                            >
                                <option value="simple">Simple Task</option>
                                <option value="workflow">Workflow Task</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label htmlFor="prompt">Task Prompt *</label>
                            <textarea
                                id="prompt"
                                value={formData.prompt}
                                onChange={(e) => handleInputChange('prompt', e.target.value)}
                                className={errors.prompt ? 'error' : ''}
                                placeholder="Describe what you want the AI agent to do..."
                                rows={4}
                            />
                            {errors.prompt && <span className="error-text">{errors.prompt}</span>}
                        </div>

                        <div className="form-group">
                            <label htmlFor="priority">
                                Priority ({formData.priority} - {getPriorityLabel(formData.priority)})
                                <span className="help-text">
                                    Higher priority tasks are executed first
                                </span>
                            </label>
                            <div className="priority-container">
                                <input
                                    id="priority"
                                    type="range"
                                    value={formData.priority}
                                    onChange={(e) => handleInputChange('priority', parseInt(e.target.value))}
                                    min="1"
                                    max="10"
                                    className="priority-slider"
                                />
                                <div className="priority-labels">
                                    <span>Low</span>
                                    <span>Medium</span>
                                    <span>High</span>
                                    <span>Critical</span>
                                </div>
                                <div
                                    className="priority-indicator"
                                    style={{ backgroundColor: getPriorityColor(formData.priority) }}
                                >
                                    {formData.priority}
                                </div>
                            </div>
                            {errors.priority && <span className="error-text">{errors.priority}</span>}
                        </div>

                        {agents.length > 0 && (
                            <div className="agent-status-info">
                                <h4>Available Agents</h4>
                                <div className="agents-summary">
                                    <div className="agent-count">
                                        <span className="count idle">
                                            {agents.filter(a => a.status === 'idle').length}
                                        </span>
                                        <span className="label">Idle</span>
                                    </div>
                                    <div className="agent-count">
                                        <span className="count busy">
                                            {agents.filter(a => a.status === 'busy').length}
                                        </span>
                                        <span className="label">Busy</span>
                                    </div>
                                    <div className="agent-count">
                                        <span className="count error">
                                            {agents.filter(a => a.status === 'error').length}
                                        </span>
                                        <span className="label">Error</span>
                                    </div>
                                </div>
                                {agents.filter(a => a.status === 'idle').length === 0 && (
                                    <div className="no-agents-warning">
                                        ⚠️ No idle agents available. Task will be queued until an agent becomes available.
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="form-actions">
                            <button type="button" className="cancel-btn" onClick={onClose}>
                                Cancel
                            </button>
                            <button type="submit" className="create-btn">
                                Create Task
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default TaskCreationModal;