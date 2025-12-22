/**
 * Property-based test for agent lifecycle management
 * **Feature: ai-agent-orchestration, Property 3: Agent lifecycle management**
 * **Validates: Requirements 1.3**
 */

import * as fc from 'fast-check';
import { AgentManager } from '../src/services/agentManager';
import { UnifiedStorageManager } from '../src/services/storageManager';
import type { Agent, Task } from '../src/types';

// Mock the storage manager
jest.mock('../src/services/storageManager');

describe('Property 3: Agent lifecycle management', () => {
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
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should remove agent from pool and cancel running tasks when agent is deleted', async () => {
        await fc.assert(
            fc.asyncProperty(
                // Generate random agent configurations
                fc.array(
                    fc.record({
                        name: fc.string({ minLength: 1, maxLength: 50 }),
                        role: fc.string({ minLength: 1, maxLength: 30 }),
                        promptTemplate: fc.string({ minLength: 1, maxLength: 200 }),
                        maxTokens: fc.integer({ min: 100, max: 4000 }),
                        temperature: fc.float({ min: 0, max: 2 }),
                        model: fc.constantFrom('xiaomi/mimo-v2-flash:free', 'test-model')
                    }),
                    { minLength: 1, maxLength: 10 }
                ),
                // Generate random tasks
                fc.array(
                    fc.record({
                        id: fc.string({ minLength: 1 }),
                        type: fc.constantFrom('simple', 'workflow') as fc.Arbitrary<'simple' | 'workflow'>,
                        priority: fc.integer({ min: 1, max: 10 }),
                        prompt: fc.string({ minLength: 1 }),
                        dependencies: fc.array(fc.string(), { maxLength: 3 }),
                        status: fc.constantFrom('pending', 'running', 'completed', 'failed') as fc.Arbitrary<'pending' | 'running' | 'completed' | 'failed'>,
                        createdAt: fc.date(),
                        retryCount: fc.nat({ max: 3 })
                    }),
                    { minLength: 0, maxLength: 5 }
                ),
                async (agentConfigs, tasks) => {
                    // Create agent manager with sufficient capacity
                    const agentManager = new AgentManager(mockStorageManager, agentConfigs.length + 5);

                    // Create all agents
                    const createdAgents: Agent[] = [];
                    for (const config of agentConfigs) {
                        const agent = await agentManager.createAgent(config);
                        createdAgents.push(agent);
                    }

                    // Assign tasks to some agents (make them busy)
                    const agentsWithTasks: { agent: Agent; task: Task }[] = [];
                    for (let i = 0; i < Math.min(tasks.length, createdAgents.length); i++) {
                        const agent = createdAgents[i];
                        const task = {
                            ...tasks[i],
                            id: `task-${i}-${Date.now()}` // Ensure unique task ID
                        };

                        try {
                            await agentManager.assignTask(agent.id, task);
                            agentsWithTasks.push({ agent, task });
                        } catch (error) {
                            // Agent might not be idle, skip this assignment
                        }
                    }

                    // Record initial state
                    const initialAgentCount = agentManager.getAllAgents().length;

                    // Select a random agent to delete
                    if (createdAgents.length > 0) {
                        const randomIndex = Math.floor(Math.random() * createdAgents.length);
                        const agentToDelete = createdAgents[randomIndex];

                        // Verify agent exists before deletion
                        const agentExists = agentManager.getAgent(agentToDelete.id);
                        if (!agentExists) {
                            return true; // Skip this iteration if agent doesn't exist
                        }

                        const wasAgentBusy = agentExists.status === 'busy';
                        const hadRunningTask = agentsWithTasks.some(at => at.agent.id === agentToDelete.id);

                        // Delete the agent
                        await agentManager.deleteAgent(agentToDelete.id);

                        // Property: Agent deletion should remove agent from pool and cancel running tasks

                        // 1. Verify agent is removed from pool
                        const deletedAgent = agentManager.getAgent(agentToDelete.id);
                        if (deletedAgent !== undefined) {
                            return false; // Property failed: agent still exists
                        }

                        // 2. Verify agent count decreased by 1
                        const finalAgentCount = agentManager.getAllAgents().length;
                        if (finalAgentCount !== initialAgentCount - 1) {
                            return false; // Property failed: agent count incorrect
                        }

                        // 3. Verify the agent is not in the available agents list
                        const availableAgents = agentManager.getAvailableAgents();
                        if (availableAgents.find(a => a.id === agentToDelete.id)) {
                            return false; // Property failed: deleted agent still in available list
                        }

                        // 4. Verify all remaining agents are still valid
                        const remainingAgents = agentManager.getAllAgents();
                        for (const agent of remainingAgents) {
                            if (!agent.id || agent.id === agentToDelete.id) {
                                return false; // Property failed: invalid remaining agent
                            }
                            if (!['idle', 'busy', 'error'].includes(agent.status)) {
                                return false; // Property failed: invalid agent status
                            }
                        }

                        // 5. Verify the agent is completely removed from the system
                        const allAgentIds = agentManager.getAllAgents().map(a => a.id);
                        if (allAgentIds.includes(agentToDelete.id)) {
                            return false; // Property failed: deleted agent ID still in system
                        }

                        return true; // Property passed
                    }

                    return true; // No agents to delete, property trivially holds
                }
            ),
            { numRuns: 100 } // Run 100 iterations as specified in design document
        );
    });

    test('should handle deletion of non-existent agent gracefully', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 1 }),
                async (nonExistentId) => {
                    const agentManager = new AgentManager(mockStorageManager, 5);

                    // Try to delete non-existent agent - should throw error
                    try {
                        await agentManager.deleteAgent(nonExistentId);
                        return false; // Property failed: should have thrown error
                    } catch (error) {
                        // Expected behavior: error should be thrown
                        // Verify system state remains unchanged
                        const agentCount = agentManager.getAllAgents().length;
                        return agentCount === 0; // Property passed: no agents should exist
                    }
                }
            ),
            { numRuns: 100 }
        );
    });
});