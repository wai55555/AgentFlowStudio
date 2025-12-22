/**
 * Agent Manager Service
 * Manages the lifecycle and operations of AI agents in the platform
 */

import { Agent, AgentConfig, AgentStatus, AgentManager as IAgentManager } from '../types/agent';
import { Task } from '../types/task';
import { UnifiedStorageManager } from './storageManager';

export class AgentManagerError extends Error {
    constructor(message: string, public code?: string) {
        super(message);
        this.name = 'AgentManagerError';
    }
}

export class AgentManager implements IAgentManager {
    private agents: Map<string, Agent> = new Map();
    private storageManager: UnifiedStorageManager;
    private maxAgents: number = 10; // Default capacity limit
    private runningTasks: Map<string, string> = new Map(); // agentId -> taskId

    constructor(storageManager: UnifiedStorageManager, maxAgents?: number) {
        this.storageManager = storageManager;
        if (maxAgents !== undefined) {
            this.maxAgents = maxAgents;
        }
        this.loadAgentsFromStorage();
    }

    /**
     * Creates a new agent with unique ID generation
     */
    async createAgent(config: Partial<AgentConfig> & { name?: string; role?: string; promptTemplate?: string }): Promise<Agent> {
        // Check capacity limit
        if (this.agents.size >= this.maxAgents) {
            throw new AgentManagerError(
                `Cannot create agent: maximum capacity of ${this.maxAgents} agents reached`,
                'CAPACITY_EXCEEDED'
            );
        }

        // Generate unique ID
        const id = this.generateUniqueId();

        // Create agent with default values
        const agent: Agent = {
            id,
            name: config.name || `Agent-${id.slice(-8)}`,
            role: config.role || 'general',
            promptTemplate: config.promptTemplate || 'You are a helpful AI assistant.',
            status: 'idle',
            config: {
                maxTokens: config.maxTokens || 1000,
                temperature: config.temperature || 0.7,
                model: config.model || 'xiaomi/mimo-v2-flash:free'
            },
            stats: {
                tasksCompleted: 0,
                averageResponseTime: 0,
                errorCount: 0
            }
        };

        // Add to agent pool
        this.agents.set(id, agent);

        // Persist to storage
        await this.saveAgentsToStorage();

        return agent;
    }

    /**
     * Deletes an agent and cleans up any running tasks
     */
    async deleteAgent(agentId: string): Promise<void> {
        const agent = this.agents.get(agentId);
        if (!agent) {
            throw new AgentManagerError(`Agent with ID ${agentId} not found`, 'AGENT_NOT_FOUND');
        }

        // Cancel any running tasks for this agent
        const runningTaskId = this.runningTasks.get(agentId);
        if (runningTaskId) {
            // Mark the task as cancelled (this would typically involve task queue integration)
            this.runningTasks.delete(agentId);
        }

        // Remove from agent pool
        this.agents.delete(agentId);

        // Persist changes to storage
        await this.saveAgentsToStorage();
    }

    /**
     * Assigns a task to an agent
     */
    async assignTask(agentId: string, task: Task): Promise<void> {
        const agent = this.agents.get(agentId);
        if (!agent) {
            throw new AgentManagerError(`Agent with ID ${agentId} not found`, 'AGENT_NOT_FOUND');
        }

        if (agent.status !== 'idle') {
            throw new AgentManagerError(`Agent ${agentId} is not available for task assignment`, 'AGENT_NOT_AVAILABLE');
        }

        // Update agent status to busy
        this.updateAgentStatus(agentId, 'busy');

        // Track the running task
        this.runningTasks.set(agentId, task.id);
    }

    /**
     * Gets all available (idle) agents
     */
    getAvailableAgents(): Agent[] {
        return Array.from(this.agents.values()).filter(agent => agent.status === 'idle');
    }

    /**
     * Updates an agent's status
     */
    updateAgentStatus(agentId: string, status: AgentStatus): void {
        const agent = this.agents.get(agentId);
        if (!agent) {
            throw new AgentManagerError(`Agent with ID ${agentId} not found`, 'AGENT_NOT_FOUND');
        }

        agent.status = status;

        // If agent becomes idle, remove from running tasks
        if (status === 'idle') {
            this.runningTasks.delete(agentId);
        }

        // Persist changes (async but don't wait)
        this.saveAgentsToStorage().catch(error => {
            console.error('Failed to save agent status update:', error);
        });
    }

    /**
     * Gets all agents in the pool
     */
    getAllAgents(): Agent[] {
        return Array.from(this.agents.values());
    }

    /**
     * Gets a specific agent by ID
     */
    getAgent(agentId: string): Agent | undefined {
        return this.agents.get(agentId);
    }

    /**
     * Gets the current agent pool capacity information
     */
    getCapacityInfo(): { current: number; maximum: number; available: number } {
        return {
            current: this.agents.size,
            maximum: this.maxAgents,
            available: this.maxAgents - this.agents.size
        };
    }

    /**
     * Updates agent statistics
     */
    updateAgentStats(agentId: string, stats: Partial<Agent['stats']>): void {
        const agent = this.agents.get(agentId);
        if (!agent) {
            throw new AgentManagerError(`Agent with ID ${agentId} not found`, 'AGENT_NOT_FOUND');
        }

        // Update stats
        if (stats.tasksCompleted !== undefined) {
            agent.stats.tasksCompleted = stats.tasksCompleted;
        }
        if (stats.averageResponseTime !== undefined) {
            agent.stats.averageResponseTime = stats.averageResponseTime;
        }
        if (stats.errorCount !== undefined) {
            agent.stats.errorCount = stats.errorCount;
        }

        // Persist changes
        this.saveAgentsToStorage().catch(error => {
            console.error('Failed to save agent stats update:', error);
        });
    }

    /**
     * Generates a unique ID for agents
     */
    private generateUniqueId(): string {
        const timestamp = Date.now().toString(36);
        const randomPart = Math.random().toString(36).substring(2, 8);
        const id = `agent_${timestamp}_${randomPart}`;

        // Ensure uniqueness (very unlikely collision, but check anyway)
        if (this.agents.has(id)) {
            return this.generateUniqueId();
        }

        return id;
    }

    /**
     * Loads agents from storage on initialization
     */
    private async loadAgentsFromStorage(): Promise<void> {
        try {
            const storedAgents = await this.storageManager.loadAgents();
            if (storedAgents && Array.isArray(storedAgents)) {
                this.agents.clear();
                storedAgents.forEach(agent => {
                    // Ensure agent has proper structure
                    if (agent.id && agent.name && agent.status) {
                        this.agents.set(agent.id, agent);
                    }
                });
            }
        } catch (error) {
            console.error('Failed to load agents from storage:', error);
            // Continue with empty agent pool
        }
    }

    /**
     * Saves current agents to storage
     */
    private async saveAgentsToStorage(): Promise<void> {
        try {
            const agentsArray = Array.from(this.agents.values());
            await this.storageManager.saveAgents(agentsArray);
        } catch (error) {
            console.error('Failed to save agents to storage:', error);
            throw new AgentManagerError('Failed to persist agent data', 'STORAGE_ERROR');
        }
    }
}