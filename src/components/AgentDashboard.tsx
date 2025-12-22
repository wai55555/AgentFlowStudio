import React, { useState } from 'react';
import { Agent, AgentConfig, AgentStatus } from '../types/agent';
import AgentCard from './AgentCard';
import AgentCreationModal from './AgentCreationModal';
import './AgentDashboard.css';

interface AgentDashboardProps {
    agents: Agent[];
    onAgentsUpdate: (agents: Agent[]) => void;
    selectedAgent?: string;
    onCreateAgent: (config: Partial<import('../types/agent').AgentConfig> & { name?: string; role?: string; promptTemplate?: string }) => Promise<Agent>;
    onUpdateAgent: (agent: Agent) => Promise<void>;
    onDeleteAgent: (agentId: string) => Promise<void>;
}

const AgentDashboard: React.FC<AgentDashboardProps> = ({
    agents,
    onAgentsUpdate,
    selectedAgent,
    onCreateAgent,
    onUpdateAgent,
    onDeleteAgent
}) => {
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [filterStatus, setFilterStatus] = useState<AgentStatus | 'all'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const filteredAgents = agents.filter(agent => {
        const matchesStatus = filterStatus === 'all' || agent.status === filterStatus;
        const matchesSearch = agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            agent.role.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesStatus && matchesSearch;
    });

    const handleCreateAgent = async (config: AgentConfig & { name: string; role: string; promptTemplate: string }) => {
        try {
            setIsCreating(true);
            await onCreateAgent(config);
            setShowCreateModal(false);
        } catch (error) {
            console.error('Failed to create agent:', error);
            // Error handling is managed by the context
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeleteAgent = async (agentId: string) => {
        if (confirm('Are you sure you want to delete this agent? This action cannot be undone.')) {
            try {
                await onDeleteAgent(agentId);
            } catch (error) {
                console.error('Failed to delete agent:', error);
                // Error handling is managed by the context
            }
        }
    };

    const handleUpdateAgent = async (updatedAgent: Agent) => {
        try {
            await onUpdateAgent(updatedAgent);
        } catch (error) {
            console.error('Failed to update agent:', error);
            // Error handling is managed by the context
        }
    };

    const getStatusCounts = () => {
        return {
            total: agents.length,
            idle: agents.filter(a => a.status === 'idle').length,
            busy: agents.filter(a => a.status === 'busy').length,
            error: agents.filter(a => a.status === 'error').length
        };
    };

    const statusCounts = getStatusCounts();

    return (
        <div className="agent-dashboard">
            <div className="agent-dashboard-header">
                <div className="header-left">
                    <h2>Agent Management</h2>
                    <div className="agent-stats">
                        <div className="stat-item">
                            <span className="stat-value">{statusCounts.total}</span>
                            <span className="stat-label">Total</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-value idle">{statusCounts.idle}</span>
                            <span className="stat-label">Idle</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-value busy">{statusCounts.busy}</span>
                            <span className="stat-label">Busy</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-value error">{statusCounts.error}</span>
                            <span className="stat-label">Error</span>
                        </div>
                    </div>
                </div>
                <button
                    className="create-agent-btn"
                    onClick={() => setShowCreateModal(true)}
                    disabled={isCreating}
                >
                    <span>+</span>
                    {isCreating ? 'Creating...' : 'Create Agent'}
                </button>
            </div>

            <div className="agent-controls">
                <div className="search-box">
                    <input
                        type="text"
                        placeholder="Search agents by name or role..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                    />
                </div>
                <div className="filter-controls">
                    <label>Filter by status:</label>
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as AgentStatus | 'all')}
                        className="status-filter"
                    >
                        <option value="all">All</option>
                        <option value="idle">Idle</option>
                        <option value="busy">Busy</option>
                        <option value="error">Error</option>
                    </select>
                </div>
            </div>

            <div className="agents-grid">
                {filteredAgents.length === 0 ? (
                    <div className="no-agents">
                        {agents.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-icon">🤖</div>
                                <h3>No agents created yet</h3>
                                <p>Create your first AI agent to get started with task automation.</p>
                                <button
                                    className="create-first-agent-btn"
                                    onClick={() => setShowCreateModal(true)}
                                    disabled={isCreating}
                                >
                                    {isCreating ? 'Creating...' : 'Create First Agent'}
                                </button>
                            </div>
                        ) : (
                            <div className="no-results">
                                <p>No agents match your current filters.</p>
                            </div>
                        )}
                    </div>
                ) : (
                    filteredAgents.map(agent => (
                        <AgentCard
                            key={agent.id}
                            agent={agent}
                            isSelected={agent.id === selectedAgent}
                            onUpdate={handleUpdateAgent}
                            onDelete={handleDeleteAgent}
                        />
                    ))
                )}
            </div>

            {showCreateModal && (
                <AgentCreationModal
                    onClose={() => setShowCreateModal(false)}
                    onCreate={handleCreateAgent}
                    isCreating={isCreating}
                />
            )}
        </div>
    );
};

export default AgentDashboard;