import React, { useState } from 'react';
import { Workflow, WorkflowStatus } from '../types/workflow';
import './WorkflowList.css';

interface WorkflowListProps {
    workflows: Workflow[];
    onSelect: (workflowId: string) => void;
    onUpdate: (workflow: Workflow) => void;
    onDelete: (workflowId: string) => void;
    onDuplicate: (workflowId: string) => void;
    selectedWorkflow?: string | null;
}

const WorkflowList: React.FC<WorkflowListProps> = ({
    workflows,
    onSelect,
    onUpdate,
    onDelete,
    onDuplicate,
    selectedWorkflow
}) => {
    const [filterStatus, setFilterStatus] = useState<WorkflowStatus | 'all'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [editingWorkflow, setEditingWorkflow] = useState<string | null>(null);
    const [editName, setEditName] = useState('');

    const filteredWorkflows = workflows.filter(workflow => {
        const matchesStatus = filterStatus === 'all' || workflow.status === filterStatus;
        const matchesSearch = workflow.name.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesStatus && matchesSearch;
    });

    const getStatusColor = (status: WorkflowStatus) => {
        switch (status) {
            case 'draft': return '#95a5a6';
            case 'running': return '#3498db';
            case 'completed': return '#27ae60';
            case 'failed': return '#e74c3c';
            default: return '#95a5a6';
        }
    };

    const getStatusIcon = (status: WorkflowStatus) => {
        switch (status) {
            case 'draft': return '📝';
            case 'running': return '⚡';
            case 'completed': return '✅';
            case 'failed': return '❌';
            default: return '❓';
        }
    };

    const handleStartEdit = (workflow: Workflow) => {
        setEditingWorkflow(workflow.id);
        setEditName(workflow.name);
    };

    const handleSaveEdit = (workflowId: string) => {
        const workflow = workflows.find(w => w.id === workflowId);
        if (workflow && editName.trim()) {
            onUpdate({ ...workflow, name: editName.trim() });
        }
        setEditingWorkflow(null);
        setEditName('');
    };

    const handleCancelEdit = () => {
        setEditingWorkflow(null);
        setEditName('');
    };

    // const formatDate = (date: Date) => {
    //     return new Intl.DateTimeFormat('en-US', {
    //         month: 'short',
    //         day: 'numeric',
    //         hour: '2-digit',
    //         minute: '2-digit'
    //     }).format(date);
    // };

    const getNodeTypeCount = (workflow: Workflow) => {
        const counts = {
            input: 0,
            process: 0,
            output: 0,
            condition: 0
        };

        workflow.nodes.forEach(node => {
            counts[node.type]++;
        });

        return counts;
    };

    return (
        <div className="workflow-list">
            <div className="workflow-list-controls">
                <div className="search-box">
                    <input
                        type="text"
                        placeholder="Search workflows..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                    />
                </div>
                <div className="filter-controls">
                    <label>Filter by status:</label>
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as WorkflowStatus | 'all')}
                        className="status-filter"
                    >
                        <option value="all">All</option>
                        <option value="draft">Draft</option>
                        <option value="running">Running</option>
                        <option value="completed">Completed</option>
                        <option value="failed">Failed</option>
                    </select>
                </div>
            </div>

            <div className="workflows-grid">
                {filteredWorkflows.length === 0 ? (
                    <div className="no-workflows">
                        {workflows.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-icon">🔄</div>
                                <h3>No workflows created yet</h3>
                                <p>Create your first workflow to automate complex multi-step processes.</p>
                            </div>
                        ) : (
                            <div className="no-results">
                                <p>No workflows match your current filters.</p>
                            </div>
                        )}
                    </div>
                ) : (
                    filteredWorkflows.map(workflow => {
                        const nodeCounts = getNodeTypeCount(workflow);
                        const isEditing = editingWorkflow === workflow.id;

                        return (
                            <div
                                key={workflow.id}
                                className={`workflow-card ${workflow.id === selectedWorkflow ? 'selected' : ''}`}
                            >
                                <div className="workflow-card-header">
                                    <div className="workflow-info">
                                        {isEditing ? (
                                            <div className="edit-name-container">
                                                <input
                                                    type="text"
                                                    value={editName}
                                                    onChange={(e) => setEditName(e.target.value)}
                                                    className="edit-name-input"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleSaveEdit(workflow.id);
                                                        if (e.key === 'Escape') handleCancelEdit();
                                                    }}
                                                    autoFocus
                                                />
                                                <div className="edit-actions">
                                                    <button
                                                        className="save-btn"
                                                        onClick={() => handleSaveEdit(workflow.id)}
                                                    >
                                                        ✓
                                                    </button>
                                                    <button
                                                        className="cancel-btn"
                                                        onClick={handleCancelEdit}
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <h3
                                                className="workflow-name"
                                                onClick={() => onSelect(workflow.id)}
                                            >
                                                {workflow.name}
                                            </h3>
                                        )}
                                        <div className="workflow-status">
                                            <span
                                                className="status-indicator"
                                                style={{ backgroundColor: getStatusColor(workflow.status) }}
                                            >
                                                {getStatusIcon(workflow.status)}
                                            </span>
                                            <span className="status-text">{workflow.status}</span>
                                        </div>
                                    </div>
                                    <div className="workflow-actions">
                                        {!isEditing && (
                                            <>
                                                <button
                                                    className="action-btn edit-btn"
                                                    onClick={() => handleStartEdit(workflow)}
                                                    title="Rename workflow"
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    className="action-btn duplicate-btn"
                                                    onClick={() => onDuplicate(workflow.id)}
                                                    title="Duplicate workflow"
                                                >
                                                    📋
                                                </button>
                                                <button
                                                    className="action-btn delete-btn"
                                                    onClick={() => onDelete(workflow.id)}
                                                    title="Delete workflow"
                                                >
                                                    🗑️
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="workflow-stats">
                                    <div className="stat-group">
                                        <div className="stat">
                                            <span className="stat-value">{workflow.nodes.length}</span>
                                            <span className="stat-label">Nodes</span>
                                        </div>
                                        <div className="stat">
                                            <span className="stat-value">{workflow.connections.length}</span>
                                            <span className="stat-label">Connections</span>
                                        </div>
                                    </div>

                                    {workflow.nodes.length > 0 && (
                                        <div className="node-breakdown">
                                            {nodeCounts.input > 0 && (
                                                <span className="node-type input">
                                                    📥 {nodeCounts.input}
                                                </span>
                                            )}
                                            {nodeCounts.process > 0 && (
                                                <span className="node-type process">
                                                    ⚙️ {nodeCounts.process}
                                                </span>
                                            )}
                                            {nodeCounts.condition > 0 && (
                                                <span className="node-type condition">
                                                    🔀 {nodeCounts.condition}
                                                </span>
                                            )}
                                            {nodeCounts.output > 0 && (
                                                <span className="node-type output">
                                                    📤 {nodeCounts.output}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="workflow-footer">
                                    <button
                                        className="open-workflow-btn"
                                        onClick={() => onSelect(workflow.id)}
                                    >
                                        Open Editor
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default WorkflowList;