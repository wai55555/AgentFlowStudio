/**
 * Property-based test for agent availability tracking
 * **Feature: ai-agent-orchestration, Property 4: Agent availability tracking**
 * **Validates: Requirements 1.5**
 */

import * as fc from 'fast-check';
import { AgentManager } from '../src/services/agentManager';
import { UnifiedStorageManager } from '../src/services/storageManager';
import type { Agent, AgentStatus } from '../src/types';

// Mock the storage manager
jest.mock('../src/services/storageManager');

describe('Property 4: Agent availability tracking', () => {
    let mockStorageManager: jest.Mocked<UnifiedStorageManager>;

    beforeEach(() => {
        // Create mock storage manager with fresh storage for each test
        mockStorageManager = {
            initialize: jest.fn(),
            saveAgents: jest.fn().mockResolvedValue(undefined),
            loadAgents: jest.fn().mockResolvedValue([]),
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
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should mark agents as available when they become idle', async () => {
        await fc.assert(
            fc.asyncProperty(
                // Generate random agent configurations
                fc.array(
                    fc.record({
                        name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
                        role: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
                        promptTemplate: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
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

                    // Wait for async initialization to complete
                    await new Promise(resolve => setTimeout(resolve, 1));

                    // Create all agents
                    const createdAgents: Agent[] = [];
                    for (const config of agentConfigs) {
                        const agent = await agentManager.createAgent(config);
                        createdAgents.push(agent);
                    }

                    // Verify all newly created agents are idle and available
                    for (const agent of createdAgents) {
                        if (agent.status !== 'idle') {
                            return false; // Property failed: new agent should be idle
                        }
                    }

                    const initialAvailableAgents = agentManager.getAvailableAgents();
                    if (initialAvailableAgents.length !== createdAgents.length) {
                        return false; // Property failed: all idle agents should be available
                    }

                    // Assign tasks to some agents (make them busy)
                    const busyAgents: Agent[] = [];
                    for (let i = 0; i < Math.min(tasks.length, createdAgents.length); i++) {
                        const agent = createdAgents[i];
                        const task = {
                            ...tasks[i],
                            id: `task-${i}-${Date.now()}-${Math.random()}` // Ensure unique task ID
                        };

                        try {
                            await agentManager.assignTask(agent.id, task);
                            busyAgents.push(agent);
                        } catch (error) {
                            // Agent might not be idle, skip this assignment
                        }
                    }

                    // Verify busy agents are not in available list
                    const availableAfterAssignment = agentManager.getAvailableAgents();
                    for (const busyAgent of busyAgents) {
                        if (availableAfterAssignment.find(a => a.id === busyAgent.id)) {
                            return false; // Property failed: busy agent should not be available
                        }
                    }

                    // Now make all agents idle and verify they become available
                    for (const agent of createdAgents) {
                        // Update agent status to idle
                        agentManager.updateAgentStatus(agent.id, 'idle');

                        // Property: When an agent becomes idle, it should be marked as available
                        const updatedAgent = agentManager.getAgent(agent.id);
                        if (!updatedAgent || updatedAgent.status !== 'idle') {
                            return false; // Property failed: agent should be idle
                        }

                        // Verify the agent appears in available agents list
                        const currentAvailableAgents = agentManager.getAvailableAgents();
                        if (!currentAvailableAgents.find(a => a.id === agent.id)) {
                            return false; // Property failed: idle agent should be available
                        }
                    }

                    // Final verification: all agents should be available since all are idle
                    const finalAvailableAgents = agentManager.getAvailableAgents();
                    if (finalAvailableAgents.length !== createdAgents.length) {
                        return false; // Property failed: all idle agents should be available
                    }

                    // Verify each created agent is in the available list
                    for (const agent of createdAgents) {
                        if (!finalAvailableAgents.find(a => a.id === agent.id)) {
                            return false; // Property failed: idle agent missing from available list
                        }
                    }

                    return true; // Property passed
                }
            ),
            { numRuns: 100 } // Run 100 iterations as specified in design document
        );
    });

    test('should maintain availability consistency across status transitions', async () => {
        await fc.assert(
            fc.asyncProperty(
                // Generate random number of agents
                fc.integer({ min: 1, max: 5 }),
                // Generate random status transitions
                fc.array(
                    fc.constantFrom('idle', 'busy', 'error') as fc.Arbitrary<AgentStatus>,
                    { minLength: 1, maxLength: 10 }
                ),
                async (numAgents, statusTransitions) => {
                    const agentManager = new AgentManager(mockStorageManager, numAgents + 2);

                    // Wait for async initialization to complete
                    await new Promise(resolve => setTimeout(resolve, 1));

                    // Create agents
                    const agents: Agent[] = [];
                    for (let i = 0; i < numAgents; i++) {
                        const agent = await agentManager.createAgent({
                            name: `Agent-${i}`,
                            role: 'test',
                            promptTemplate: 'test prompt'
                        });
                        agents.push(agent);
                    }

                    // Apply status transitions and verify availability consistency
                    for (const status of statusTransitions) {
                        // Pick a random agent
                        const randomAgent = agents[Math.floor(Math.random() * agents.length)];

                        // Verify agent still exists before updating status
                        const existingAgent = agentManager.getAgent(randomAgent.id);
                        if (!existingAgent) {
                            continue; // Skip if agent doesn't exist
                        }

                        // Update status
                        agentManager.updateAgentStatus(randomAgent.id, status);

                        // Property: Availability should be consistent with status
                        const availableAgents = agentManager.getAvailableAgents();
                        const allAgents = agentManager.getAllAgents();

                        // Count idle agents
                        const idleAgentCount = allAgents.filter(a => a.status === 'idle').length;

                        // Available agents should equal idle agents
                        if (availableAgents.length !== idleAgentCount) {
                            return false; // Property failed: available count != idle count
                        }

                        // All available agents should have idle status
                        for (const availableAgent of availableAgents) {
                            if (availableAgent.status !== 'idle') {
                                return false; // Property failed: available agent not idle
                            }
                        }

                        // All idle agents should be in available list
                        for (const agent of allAgents) {
                            if (agent.status === 'idle') {
                                if (!availableAgents.find(a => a.id === agent.id)) {
                                    return false; // Property failed: idle agent not available
                                }
                            }
                        }

                        // No non-idle agents should be in available list
                        for (const agent of allAgents) {
                            if (agent.status !== 'idle') {
                                if (availableAgents.find(a => a.id === agent.id)) {
                                    return false; // Property failed: non-idle agent is available
                                }
                            }
                        }
                    }

                    return true; // Property passed
                }
            ),
            { numRuns: 100 }
        );
    });

    test('should handle edge cases in availability tracking', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 0, max: 3 }), // Number of agents (including 0)
                async (numAgents) => {
                    const agentManager = new AgentManager(mockStorageManager, Math.max(numAgents, 1));

                    // Wait for async initialization to complete
                    await new Promise(resolve => setTimeout(resolve, 1));

                    // Create agents
                    const agents: Agent[] = [];
                    for (let i = 0; i < numAgents; i++) {
                        const agent = await agentManager.createAgent({
                            name: `Agent-${i}`,
                            role: 'test',
                            promptTemplate: 'test prompt'
                        });
                        agents.push(agent);
                    }

                    // Property: Empty system should have no available agents
                    if (numAgents === 0) {
                        const availableAgents = agentManager.getAvailableAgents();
                        return availableAgents.length === 0;
                    }

                    // Property: System with only idle agents should have all agents available
                    const availableAgents = agentManager.getAvailableAgents();
                    if (availableAgents.length !== numAgents) {
                        return false; // Property failed: not all idle agents are available
                    }

                    // Make all agents busy
                    for (const agent of agents) {
                        agentManager.updateAgentStatus(agent.id, 'busy');
                    }

                    // Property: System with only busy agents should have no available agents
                    const availableAfterBusy = agentManager.getAvailableAgents();
                    if (availableAfterBusy.length !== 0) {
                        return false; // Property failed: busy agents should not be available
                    }

                    // Make all agents error state
                    for (const agent of agents) {
                        agentManager.updateAgentStatus(agent.id, 'error');
                    }

                    // Property: System with only error agents should have no available agents
                    const availableAfterError = agentManager.getAvailableAgents();
                    if (availableAfterError.length !== 0) {
                        return false; // Property failed: error agents should not be available
                    }

                    return true; // Property passed
                }
            ),
            { numRuns: 100 }
        );
    });
});