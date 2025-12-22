/**
 * Property-Based Tests for Agent Uniqueness and Pool Management
 * Feature: ai-agent-orchestration, Property 1: Agent uniqueness and pool management
 * Validates: Requirements 1.1
 */

import * as fc from 'fast-check';
import { AgentManager, AgentManagerError } from '../src/services/agentManager';
import { UnifiedStorageManager } from '../src/services/storageManager';
import type { Agent, AgentConfig } from '../src/types';

// Mock the storage manager
jest.mock('../src/services/storageManager');

describe('Property Tests: Agent Uniqueness and Pool Management', () => {
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

    /**
     * Property 1: Agent uniqueness and pool management
     * For any number of agents created, each agent should have a unique ID and be properly added to the agent pool
     * Validates: Requirements 1.1
     */
    test('Property 1: Agent uniqueness and pool management', async () => {
        await fc.assert(
            fc.asyncProperty(
                // Generate a reasonable number of agents to create (1-20)
                fc.integer({ min: 1, max: 20 }),
                // Generate agent configurations
                fc.array(
                    fc.record({
                        name: fc.option(fc.string({ minLength: 1, maxLength: 50 })),
                        role: fc.option(fc.string({ minLength: 1, maxLength: 30 })),
                        promptTemplate: fc.option(fc.string({ minLength: 1, maxLength: 200 })),
                        maxTokens: fc.option(fc.integer({ min: 100, max: 4000 })),
                        temperature: fc.option(fc.float({ min: 0, max: 2 })),
                        model: fc.option(fc.string({ minLength: 1, maxLength: 50 }))
                    }),
                    { minLength: 1, maxLength: 20 }
                ),
                async (maxCapacity: number, agentConfigs: Array<Partial<AgentConfig> & { name?: string; role?: string; promptTemplate?: string }>) => {
                    // Create agent manager with specified capacity
                    const agentManager = new AgentManager(mockStorageManager, maxCapacity);

                    // Wait for async initialization to complete
                    await new Promise(resolve => setTimeout(resolve, 0));

                    const createdAgents: Agent[] = [];
                    const agentIds = new Set<string>();

                    // Try to create agents up to capacity
                    const agentsToCreate = Math.min(agentConfigs.length, maxCapacity);

                    for (let i = 0; i < agentsToCreate; i++) {
                        const config = agentConfigs[i];
                        const agent = await agentManager.createAgent(config);

                        // Verify agent has unique ID
                        expect(agent.id).toBeDefined();
                        expect(typeof agent.id).toBe('string');
                        expect(agent.id.length).toBeGreaterThan(0);

                        // Verify ID uniqueness
                        expect(agentIds.has(agent.id)).toBe(false);
                        agentIds.add(agent.id);

                        // Verify agent is properly added to pool
                        const retrievedAgent = agentManager.getAgent(agent.id);
                        expect(retrievedAgent).toBeDefined();
                        expect(retrievedAgent?.id).toBe(agent.id);

                        createdAgents.push(agent);
                    }

                    // Verify all agents are in the pool
                    const allAgents = agentManager.getAllAgents();
                    expect(allAgents.length).toBe(agentsToCreate);

                    // Verify each created agent is in the pool
                    for (const createdAgent of createdAgents) {
                        const foundAgent = allAgents.find(a => a.id === createdAgent.id);
                        expect(foundAgent).toBeDefined();
                        expect(foundAgent?.id).toBe(createdAgent.id);
                    }

                    // Verify capacity enforcement - if we try to create more agents than capacity allows
                    if (agentConfigs.length > maxCapacity) {
                        // Should throw error when exceeding capacity
                        await expect(agentManager.createAgent(agentConfigs[maxCapacity]))
                            .rejects
                            .toThrow(AgentManagerError);

                        // Pool size should remain at capacity
                        expect(agentManager.getAllAgents().length).toBe(maxCapacity);
                    }

                    // Verify capacity info is accurate
                    const capacityInfo = agentManager.getCapacityInfo();
                    expect(capacityInfo.current).toBe(agentsToCreate);
                    expect(capacityInfo.maximum).toBe(maxCapacity);
                    expect(capacityInfo.available).toBe(maxCapacity - agentsToCreate);
                }
            ),
            { numRuns: 100 } // Run 100 iterations as specified in design document
        );
    });

    /**
     * Additional property test: Agent ID format consistency
     * Verifies that all generated agent IDs follow the expected format
     */
    test('Property: Agent ID format consistency', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 1, max: 10 }),
                async (numAgents: number) => {
                    const agentManager = new AgentManager(mockStorageManager, 20);

                    // Wait for async initialization to complete
                    await new Promise(resolve => setTimeout(resolve, 0));

                    for (let i = 0; i < numAgents; i++) {
                        const agent = await agentManager.createAgent({});

                        // Verify ID follows expected format: agent_<timestamp>_<random>
                        expect(agent.id).toMatch(/^agent_[a-z0-9]+_[a-z0-9]+$/);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property test: Pool management with deletions
     * Verifies that agent pool correctly manages additions and deletions
     */
    test('Property: Pool management with deletions maintains consistency', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 2, max: 10 }),
                fc.array(fc.boolean(), { minLength: 2, maxLength: 10 }),
                async (initialAgents: number, deletionPattern: boolean[]) => {
                    const agentManager = new AgentManager(mockStorageManager, 20);

                    // Wait for async initialization to complete
                    await new Promise(resolve => setTimeout(resolve, 0));

                    // Create initial agents
                    const agents: Agent[] = [];
                    for (let i = 0; i < initialAgents; i++) {
                        const agent = await agentManager.createAgent({});
                        agents.push(agent);
                    }

                    expect(agentManager.getAllAgents().length).toBe(initialAgents);

                    // Apply deletion pattern
                    const agentsToDelete = agents.slice(0, Math.min(deletionPattern.length, agents.length));
                    let deletedCount = 0;

                    for (let i = 0; i < agentsToDelete.length; i++) {
                        if (deletionPattern[i]) {
                            await agentManager.deleteAgent(agentsToDelete[i].id);
                            deletedCount++;

                            // Verify agent is removed from pool
                            expect(agentManager.getAgent(agentsToDelete[i].id)).toBeUndefined();
                        }
                    }

                    // Verify final pool size
                    const finalAgents = agentManager.getAllAgents();
                    expect(finalAgents.length).toBe(initialAgents - deletedCount);

                    // Verify remaining agents are still accessible
                    for (const agent of finalAgents) {
                        expect(agentManager.getAgent(agent.id)).toBeDefined();
                    }
                }
            ),
            { numRuns: 100 }
        );
    });
});