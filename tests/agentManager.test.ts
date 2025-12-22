/**
 * Agent Manager Tests
 */

import { AgentManager, AgentManagerError } from '../src/services/agentManager';
import { UnifiedStorageManager } from '../src/services/storageManager';
import type { Agent, AgentConfig } from '../src/types';

// Mock the storage manager
jest.mock('../src/services/storageManager');

describe('AgentManager', () => {
    let agentManager: AgentManager;
    let mockStorageManager: jest.Mocked<UnifiedStorageManager>;

    beforeEach(() => {
        // Create mock storage manager
        mockStorageManager = {
            initialize: jest.fn(),
            saveAgents: jest.fn(),
            loadAgents: jest.fn(),
            saveWorkflows: jest.fn(),
            loadWorkflows: jest.fn(),
            saveSettings: jest.fn(),
            loadSettings: jest.fn(),
            exportConfiguration: jest.fn(),
            importConfiguration: jest.fn(),
            saveTask: jest.fn(),
            getTask: jest.fn(),
            getTasks: jest.fn(),
            saveLog: jest.fn(),
            getLogs: jest.fn(),
            getStorageQuota: jest.fn(),
            getStorageStats: jest.fn(),
            clearAll: jest.fn()
        } as any;

        // Mock successful storage operations
        mockStorageManager.loadAgents.mockResolvedValue([]);
        mockStorageManager.saveAgents.mockResolvedValue(undefined);

        agentManager = new AgentManager(mockStorageManager, 5); // Set capacity to 5 for testing
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Agent Creation', () => {
        test('should create agent with unique ID', async () => {
            const config: Partial<AgentConfig> = {
                maxTokens: 1000,
                temperature: 0.7,
                model: 'test-model'
            };

            const agent = await agentManager.createAgent(config);

            expect(agent.id).toBeDefined();
            expect(agent.id).toMatch(/^agent_[a-z0-9]+_[a-z0-9]+$/);
            expect(agent.status).toBe('idle');
            expect(agent.config).toEqual({
                maxTokens: 1000,
                temperature: 0.7,
                model: 'test-model'
            });
            expect(mockStorageManager.saveAgents).toHaveBeenCalledWith([agent]);
        });

        test('should create agent with default values', async () => {
            const agent = await agentManager.createAgent({});

            expect(agent.name).toMatch(/^Agent-[a-zA-Z0-9_]+$/);
            expect(agent.role).toBe('general');
            expect(agent.promptTemplate).toBe('You are a helpful AI assistant.');
            expect(agent.config.maxTokens).toBe(1000);
            expect(agent.config.temperature).toBe(0.7);
            expect(agent.config.model).toBe('xiaomi/mimo-v2-flash:free');
            expect(agent.stats).toEqual({
                tasksCompleted: 0,
                averageResponseTime: 0,
                errorCount: 0
            });
        });

        test('should create agent with custom values', async () => {
            const config = {
                name: 'Custom Agent',
                role: 'specialist',
                promptTemplate: 'You are a specialist.',
                maxTokens: 2000,
                temperature: 0.5,
                model: 'custom-model'
            };

            const agent = await agentManager.createAgent(config);

            expect(agent.name).toBe('Custom Agent');
            expect(agent.role).toBe('specialist');
            expect(agent.promptTemplate).toBe('You are a specialist.');
            expect(agent.config.maxTokens).toBe(2000);
            expect(agent.config.temperature).toBe(0.5);
            expect(agent.config.model).toBe('custom-model');
        });

        test('should enforce capacity limits', async () => {
            // Create 5 agents (at capacity)
            for (let i = 0; i < 5; i++) {
                await agentManager.createAgent({});
            }

            // Try to create 6th agent
            await expect(agentManager.createAgent({}))
                .rejects
                .toThrow(AgentManagerError);
        });

        test('should generate unique IDs for multiple agents', async () => {
            const agent1 = await agentManager.createAgent({});
            const agent2 = await agentManager.createAgent({});
            const agent3 = await agentManager.createAgent({});

            expect(agent1.id).not.toBe(agent2.id);
            expect(agent2.id).not.toBe(agent3.id);
            expect(agent1.id).not.toBe(agent3.id);
        });
    });

    describe('Agent Deletion', () => {
        test('should delete existing agent', async () => {
            const agent = await agentManager.createAgent({});

            await agentManager.deleteAgent(agent.id);

            expect(agentManager.getAgent(agent.id)).toBeUndefined();
            expect(mockStorageManager.saveAgents).toHaveBeenCalledWith([]);
        });

        test('should throw error when deleting non-existent agent', async () => {
            await expect(agentManager.deleteAgent('non-existent'))
                .rejects
                .toThrow(AgentManagerError);
        });

        test('should clean up running tasks when deleting agent', async () => {
            const agent = await agentManager.createAgent({});
            const mockTask = { id: 'task-1', type: 'simple' as const, priority: 1, prompt: 'test' };

            // Assign task to agent
            await agentManager.assignTask(agent.id, mockTask as any);
            expect(agent.status).toBe('busy');

            // Delete agent
            await agentManager.deleteAgent(agent.id);

            // Agent should be removed
            expect(agentManager.getAgent(agent.id)).toBeUndefined();
        });
    });

    describe('Agent Status Management', () => {
        test('should update agent status', async () => {
            const agent = await agentManager.createAgent({});

            agentManager.updateAgentStatus(agent.id, 'busy');

            const updatedAgent = agentManager.getAgent(agent.id);
            expect(updatedAgent?.status).toBe('busy');
        });

        test('should throw error when updating non-existent agent status', () => {
            expect(() => agentManager.updateAgentStatus('non-existent', 'busy'))
                .toThrow(AgentManagerError);
        });

        test('should clear running task when agent becomes idle', async () => {
            const agent = await agentManager.createAgent({});
            const mockTask = { id: 'task-1', type: 'simple' as const, priority: 1, prompt: 'test' };

            // Assign task and make busy
            await agentManager.assignTask(agent.id, mockTask as any);
            expect(agent.status).toBe('busy');

            // Make idle
            agentManager.updateAgentStatus(agent.id, 'idle');
            expect(agent.status).toBe('idle');
        });
    });

    describe('Agent Pool Management', () => {
        test('should get available agents', async () => {
            const agent1 = await agentManager.createAgent({});
            const agent2 = await agentManager.createAgent({});
            const agent3 = await agentManager.createAgent({});

            // Make one agent busy
            agentManager.updateAgentStatus(agent2.id, 'busy');

            const availableAgents = agentManager.getAvailableAgents();

            expect(availableAgents).toHaveLength(2);
            expect(availableAgents.map(a => a.id)).toContain(agent1.id);
            expect(availableAgents.map(a => a.id)).toContain(agent3.id);
            expect(availableAgents.map(a => a.id)).not.toContain(agent2.id);
        });

        test('should get all agents', async () => {
            const agent1 = await agentManager.createAgent({});
            const agent2 = await agentManager.createAgent({});

            const allAgents = agentManager.getAllAgents();

            expect(allAgents).toHaveLength(2);
            expect(allAgents.map(a => a.id)).toContain(agent1.id);
            expect(allAgents.map(a => a.id)).toContain(agent2.id);
        });

        test('should get capacity information', async () => {
            await agentManager.createAgent({});
            await agentManager.createAgent({});

            const capacityInfo = agentManager.getCapacityInfo();

            expect(capacityInfo.current).toBe(2);
            expect(capacityInfo.maximum).toBe(5);
            expect(capacityInfo.available).toBe(3);
        });
    });

    describe('Task Assignment', () => {
        test('should assign task to idle agent', async () => {
            const agent = await agentManager.createAgent({});
            const mockTask = { id: 'task-1', type: 'simple' as const, priority: 1, prompt: 'test' };

            await agentManager.assignTask(agent.id, mockTask as any);

            expect(agent.status).toBe('busy');
        });

        test('should throw error when assigning task to non-existent agent', async () => {
            const mockTask = { id: 'task-1', type: 'simple' as const, priority: 1, prompt: 'test' };

            await expect(agentManager.assignTask('non-existent', mockTask as any))
                .rejects
                .toThrow(AgentManagerError);
        });

        test('should throw error when assigning task to busy agent', async () => {
            const agent = await agentManager.createAgent({});
            const mockTask = { id: 'task-1', type: 'simple' as const, priority: 1, prompt: 'test' };

            // Make agent busy
            agentManager.updateAgentStatus(agent.id, 'busy');

            await expect(agentManager.assignTask(agent.id, mockTask as any))
                .rejects
                .toThrow(AgentManagerError);
        });
    });

    describe('Agent Statistics', () => {
        test('should update agent statistics', async () => {
            const agent = await agentManager.createAgent({});

            agentManager.updateAgentStats(agent.id, {
                tasksCompleted: 5,
                averageResponseTime: 1500,
                errorCount: 1
            });

            const updatedAgent = agentManager.getAgent(agent.id);
            expect(updatedAgent?.stats).toEqual({
                tasksCompleted: 5,
                averageResponseTime: 1500,
                errorCount: 1
            });
        });

        test('should update partial statistics', async () => {
            const agent = await agentManager.createAgent({});

            agentManager.updateAgentStats(agent.id, {
                tasksCompleted: 3
            });

            const updatedAgent = agentManager.getAgent(agent.id);
            expect(updatedAgent?.stats.tasksCompleted).toBe(3);
            expect(updatedAgent?.stats.averageResponseTime).toBe(0);
            expect(updatedAgent?.stats.errorCount).toBe(0);
        });

        test('should throw error when updating stats for non-existent agent', () => {
            expect(() => agentManager.updateAgentStats('non-existent', { tasksCompleted: 1 }))
                .toThrow(AgentManagerError);
        });
    });

    describe('Storage Integration', () => {
        test('should load agents from storage on initialization', async () => {
            const storedAgents: Agent[] = [{
                id: 'stored-agent-1',
                name: 'Stored Agent',
                role: 'assistant',
                promptTemplate: 'You are stored.',
                status: 'idle',
                config: { maxTokens: 1000, temperature: 0.7, model: 'test-model' },
                stats: { tasksCompleted: 5, averageResponseTime: 1000, errorCount: 0 }
            }];

            mockStorageManager.loadAgents.mockResolvedValue(storedAgents);

            const newManager = new AgentManager(mockStorageManager);

            // Wait for async loading
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(newManager.getAgent('stored-agent-1')).toBeDefined();
            expect(newManager.getAllAgents()).toHaveLength(1);
        });

        test('should handle storage errors gracefully', async () => {
            mockStorageManager.loadAgents.mockRejectedValue(new Error('Storage error'));

            // Should not throw, just continue with empty pool
            const newManager = new AgentManager(mockStorageManager);

            expect(newManager.getAllAgents()).toHaveLength(0);
        });
    });
});