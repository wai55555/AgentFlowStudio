import React, { useState } from 'react';
import { Agent, AgentStatus } from '../types/agent';
import './AgentCard.css';

interface AgentCardProps {
    agent: Agent;
    isSelected: boolean;
    onUpdate: (agent: Agent) => void;
    onDelete: (agentId: string) => void;
}

const AgentCard: React.FC<AgentCardProps> = ({
    agent,
    isSelected,
    onUpdate,
    onDelete
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({
        name: agent.name,
        role: agent.role,
        promptTemplate: agent.promptTemplate,
        maxTokens: agent.config.maxTokens,
        temperature: agent.config.temperature,
        model: agent.config.model
    });

    const getStatusColor = (status: AgentStatus) => {
        switch (status) {
            case 'idle': return '#27ae60';
            case 'busy': return '#f39c12';
            case 'error': return '#e74c3c';
            default: return '#95a5a6';
        }
    };

    const getStatusIcon = (status: AgentStatus) => {
        switch (status) {
            case 'idle': return '✅';
            case 'busy': return '⚡';
            case 'error': return '❌';
            default: return '❓';
        }
    };

    const handleSaveEdit = () => {
        const updatedAgent: Agent = {
            ...agent,
            name: editForm.name,
            role: editForm.role,
            promptTemplate: editForm.promptTemplate,
            config: {
                maxTokens: editForm.maxTokens,
                temperature: editForm.temperature,
                model: editForm.model
            }
        };
        onUpdate(updatedAgent);
        setIsEditing(false);
    };

    const handleCancelEdit = () => {
        setEditForm({
            name: agent.name,
            role: agent.role,
            promptTemplate: agent.promptTemplate,
            maxTokens: agent.config.maxTokens,
            temperature: agent.config.temperature,
            model: agent.config.model
        });
        setIsEditing(false);
    };

    const formatResponseTime = (ms: number) => {
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(1)}s`;
    };

    return (
        <div className={`agent-card ${isSelected ? 'selected' : ''}`}>
            <div className="agent-card-header">
                <div className="agent-info">
                    {isEditing ? (
                        <input
                            type="text"
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            className="edit-input agent-name-input"
                        />
                    ) : (
                        <h3 className="agent-name">{agent.name}</h3>
                    )}
                    {isEditing ? (
                        <input
                            type="text"
                            value={editForm.role}
                            onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                            className="edit-input agent-role-input"
                        />
                    ) : (
                        <p className="agent-role">{agent.role}</p>
                    )}
                </div>
                <div className="agent-status">
                    <span
                        className="status-indicator"
                        style={{ backgroundColor: getStatusColor(agent.status) }}
                    >
                        {getStatusIcon(agent.status)}
                    </span>
                    <span className="status-text">{agent.status}</span>
                </div>
            </div>

            <div className="agent-stats-summary">
                <div className="stat">
                    <span className="stat-value">{agent.stats.tasksCompleted}</span>
                    <span className="stat-label">Tasks</span>
                </div>
                <div className="stat">
                    <span className="stat-value">
                        {formatResponseTime(agent.stats.averageResponseTime)}
                    </span>
                    <span className="stat-label">Avg Time</span>
                </div>
                <div className="stat">
                    <span className="stat-value error">{agent.stats.errorCount}</span>
                    <span className="stat-label">Errors</span>
                </div>
            </div>

            {isExpanded && (
                <div className="agent-details">
                    <div className="detail-section">
                        <h4>Configuration</h4>
                        <div className="config-grid">
                            <div className="config-item">
                                <label>Model:</label>
                                {isEditing ? (
                                    <select
                                        value={editForm.model}
                                        onChange={(e) => setEditForm({ ...editForm, model: e.target.value })}
                                        className="edit-select"
                                    >
                                        <option value="xiaomi/mimo-v2-flash:free">Xiaomi Mimo V2 Flash (Free)</option>
                                        <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                                        <option value="gpt-4">GPT-4</option>
                                    </select>
                                ) : (
                                    <span>{agent.config.model}</span>
                                )}
                            </div>
                            <div className="config-item">
                                <label>Max Tokens:</label>
                                {isEditing ? (
                                    <input
                                        type="number"
                                        value={editForm.maxTokens}
                                        onChange={(e) => setEditForm({ ...editForm, maxTokens: parseInt(e.target.value) })}
                                        className="edit-input"
                                        min="1"
                                        max="4000"
                                    />
                                ) : (
                                    <span>{agent.config.maxTokens}</span>
                                )}
                            </div>
                            <div className="config-item">
                                <label>Temperature:</label>
                                {isEditing ? (
                                    <input
                                        type="number"
                                        value={editForm.temperature}
                                        onChange={(e) => setEditForm({ ...editForm, temperature: parseFloat(e.target.value) })}
                                        className="edit-input"
                                        min="0"
                                        max="2"
                                        step="0.1"
                                    />
                                ) : (
                                    <span>{agent.config.temperature}</span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="detail-section">
                        <h4>Prompt Template</h4>
                        {isEditing ? (
                            <textarea
                                value={editForm.promptTemplate}
                                onChange={(e) => setEditForm({ ...editForm, promptTemplate: e.target.value })}
                                className="edit-textarea"
                                rows={4}
                            />
                        ) : (
                            <div className="prompt-template">
                                {agent.promptTemplate || 'No prompt template set'}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="agent-actions">
                <button
                    className="action-btn expand-btn"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    {isExpanded ? '▲' : '▼'}
                </button>

                {isEditing ? (
                    <>
                        <button
                            className="action-btn save-btn"
                            onClick={handleSaveEdit}
                        >
                            ✓
                        </button>
                        <button
                            className="action-btn cancel-btn"
                            onClick={handleCancelEdit}
                        >
                            ✕
                        </button>
                    </>
                ) : (
                    <>
                        <button
                            className="action-btn edit-btn"
                            onClick={() => setIsEditing(true)}
                        >
                            ✏️
                        </button>
                        <button
                            className="action-btn delete-btn"
                            onClick={() => onDelete(agent.id)}
                        >
                            🗑️
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default AgentCard;