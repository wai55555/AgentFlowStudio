/**
 * Core Agent interfaces for the AI Agent Orchestration Platform
 */

export type AgentStatus = 'idle' | 'busy' | 'error';

export interface AgentConfig {
    maxTokens: number;
    temperature: number;
    model: string;
}

export interface AgentStats {
    tasksCompleted: number;
    averageResponseTime: number;
    errorCount: number;
}

export interface Agent {
    id: string;
    name: string;
    role: string;
    promptTemplate: string;
    status: AgentStatus;
    config: AgentConfig;
    stats: AgentStats;
}

export interface AgentManager {
    createAgent(config: AgentConfig): Promise<Agent>;
    deleteAgent(agentId: string): Promise<void>;
    assignTask(agentId: string, task: any): Promise<void>; // Using any to avoid circular dependency
    getAvailableAgents(): Agent[];
    updateAgentStatus(agentId: string, status: AgentStatus): void;
}