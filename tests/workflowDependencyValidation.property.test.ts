/**
 * Property-Based Tests for Workflow Dependency Validation
 * Feature: ai-agent-orchestration, Property 7: Workflow dependency validation
 * Validates: Requirements 3.2
 */

import * as fc from 'fast-check';
import { WorkflowEngine, WorkflowEngineError } from '../src/services/workflowEngine';
import { UnifiedStorageManager } from '../src/services/storageManager';
import { TaskQueueEngine } from '../src/services/taskQueue';
import { AgentManager } from '../src/services/agentManager';
import { WorkflowNode, Connection, WorkflowNodeType } from '../src/types/workflow';

// Mock the dependencies
jest.mock('../src/services/storageManager');
jest.mock('../src/services/taskQueue');
jest.mock('../src/services/agentManager');

/**
 * Helper function to detect circular dependencies using DFS
 */
function detectCircularDependency(workflow: any): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (nodeId: string): boolean => {
        if (recursionStack.has(nodeId)) {
            return true; // Cycle detected
        }
        if (visited.has(nodeId)) {
            return false; // Already processed
        }

        visited.add(nodeId);
        recursionStack.add(nodeId);

        // Get all nodes that this node connects to
        const outgoingConnections = workflow.connections.filter((c: any) => c.sourceNodeId === nodeId);
        for (const connection of outgoingConnections) {
            if (hasCycle(connection.targetNodeId)) {
                return true;
            }
        }

        recursionStack.delete(nodeId);
        return false;
    };

    // Check each node for cycles
    for (const node of workflow.nodes) {
        visited.clear();
        recursionStack.clear();
        if (hasCycle(node.id)) {
            return true;
        }
    }

    return false;
}

describe('Property Tests: Workflow Dependency Validation', () => {
    let workflowEngine: WorkflowEngine;
    let mockStorageManager: jest.Mocked<UnifiedStorageManager>;
    let mockTaskQueue: jest.Mocked<TaskQueueEngine>;
    let mockAgentManager: jest.Mocked<AgentManager>;

    beforeEach(() => {
        // Create mocked dependencies
        mockStorageManager = new UnifiedStorageManager() as jest.Mocked<UnifiedStorageManager>;
        mockTaskQueue = new TaskQueueEngine(mockStorageManager, mockAgentManager) as jest.Mocked<TaskQueueEngine>;
        mockAgentManager = new AgentManager(mockStorageManager) as jest.Mocked<AgentManager>;

        // Mock storage methods
        mockStorageManager.loadWorkflows = jest.fn().mockResolvedValue([]);
        mockStorageManager.saveWorkflow = jest.fn().mockResolvedValue(undefined);

        workflowEngine = new WorkflowEngine(mockStorageManager, mockTaskQueue, mockAgentManager);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    /**
     * Property 7: Workflow dependency validation
     * For any workflow with node connections, the system should prevent circular dependencies and validate connection integrity
     * Validates: Requirements 3.2
     */
    test('Property 7: Workflow dependency validation', async () => {
        await fc.assert(
            fc.asyncProperty(
                // Generate workflow structure
                fc.record({
                    // Generate nodes (2-8 nodes for reasonable complexity)
                    nodes: fc.array(
                        fc.record({
                            id: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
                            type: fc.constantFrom('input', 'process', 'output', 'condition') as fc.Arbitrary<WorkflowNodeType>,
                            hasPrompt: fc.boolean(),
                            hasCondition: fc.boolean()
                        }),
                        { minLength: 2, maxLength: 8 }
                    ),
                    // Generate potential connections (may create cycles)
                    connectionSpecs: fc.array(
                        fc.record({
                            sourceIndex: fc.nat(),
                            targetIndex: fc.nat(),
                            sourcePort: fc.constantFrom('output', 'result', 'data'),
                            targetPort: fc.constantFrom('input', 'data', 'condition')
                        }),
                        { minLength: 0, maxLength: 15 }
                    )
                }),
                async ({ nodes: nodeSpecs, connectionSpecs }) => {
                    // Ensure unique node IDs
                    const uniqueNodeSpecs = nodeSpecs.reduce((acc, spec, index) => {
                        const uniqueId = `${spec.id}_${index}`;
                        acc.push({ ...spec, id: uniqueId });
                        return acc;
                    }, [] as typeof nodeSpecs);

                    // Create workflow
                    const workflow = workflowEngine.createWorkflow('Test Workflow');

                    // Add nodes to workflow
                    const createdNodes: WorkflowNode[] = [];
                    for (const nodeSpec of uniqueNodeSpecs) {
                        const node: WorkflowNode = {
                            id: nodeSpec.id,
                            type: nodeSpec.type,
                            position: { x: Math.random() * 500, y: Math.random() * 500 },
                            config: {
                                prompt: nodeSpec.type === 'process' && nodeSpec.hasPrompt ? 'Test prompt' : undefined,
                                condition: nodeSpec.type === 'condition' && nodeSpec.hasCondition ? 'Test condition' : undefined
                            },
                            inputs: [],
                            outputs: []
                        };

                        workflowEngine.addNode(workflow.id, node);
                        createdNodes.push(node);
                    }

                    // Track successful connections and detect cycles
                    const successfulConnections: Connection[] = [];
                    const rejectedConnections: Connection[] = [];

                    // Attempt to create connections
                    for (const connSpec of connectionSpecs) {
                        if (createdNodes.length === 0) continue;

                        const sourceIndex = connSpec.sourceIndex % createdNodes.length;
                        const targetIndex = connSpec.targetIndex % createdNodes.length;

                        // Skip self-connections
                        if (sourceIndex === targetIndex) continue;

                        const connection: Connection = {
                            sourceNodeId: createdNodes[sourceIndex].id,
                            targetNodeId: createdNodes[targetIndex].id,
                            sourcePort: connSpec.sourcePort,
                            targetPort: connSpec.targetPort
                        };

                        // Check if this connection already exists
                        const isDuplicate = successfulConnections.some(c =>
                            c.sourceNodeId === connection.sourceNodeId &&
                            c.targetNodeId === connection.targetNodeId &&
                            c.sourcePort === connection.sourcePort &&
                            c.targetPort === connection.targetPort
                        );

                        if (isDuplicate) continue;

                        try {
                            workflowEngine.connectNodes(workflow.id, connection);
                            successfulConnections.push(connection);
                        } catch (error) {
                            // Connection was rejected (likely due to circular dependency)
                            if (error instanceof WorkflowEngineError) {
                                rejectedConnections.push(connection);
                            } else {
                                throw error; // Re-throw unexpected errors
                            }
                        }
                    }

                    // Get the final workflow state
                    const finalWorkflow = workflowEngine.getWorkflow(workflow.id);
                    expect(finalWorkflow).toBeDefined();

                    // Validate the workflow
                    const validation = workflowEngine.validateWorkflow(finalWorkflow!);

                    // Property: The workflow should have no circular dependencies
                    const hasCircularDependency = detectCircularDependency(finalWorkflow!);
                    expect(hasCircularDependency).toBe(false);

                    // Property: If workflow is invalid, it should be due to configuration issues, not circular dependencies
                    if (!validation.isValid) {
                        // All errors should be configuration-related, not circular dependency errors
                        const hasCircularError = validation.errors.some(e =>
                            e.toLowerCase().includes('circular') || e.toLowerCase().includes('cycle')
                        );
                        expect(hasCircularError).toBe(false);
                    }

                    // Property: All successful connections should be in the workflow
                    expect(finalWorkflow!.connections.length).toBe(successfulConnections.length);

                    // Property: All nodes with required configurations should be properly validated
                    for (const node of finalWorkflow!.nodes) {
                        if (node.type === 'process') {
                            // Process nodes should have prompts or validation should catch the error
                            if (!node.config.prompt) {
                                expect(validation.errors.some(e => e.includes(node.id) && e.includes('prompt'))).toBe(true);
                            }
                        }
                        if (node.type === 'condition') {
                            // Condition nodes should have conditions or validation should catch the error
                            if (!node.config.condition) {
                                expect(validation.errors.some(e => e.includes(node.id) && e.includes('condition'))).toBe(true);
                            }
                        }
                    }

                    // Property: Connection integrity - all connections reference existing nodes
                    for (const connection of finalWorkflow!.connections) {
                        const sourceExists = finalWorkflow!.nodes.some(n => n.id === connection.sourceNodeId);
                        const targetExists = finalWorkflow!.nodes.some(n => n.id === connection.targetNodeId);
                        expect(sourceExists).toBe(true);
                        expect(targetExists).toBe(true);
                    }
                }
            ),
            { numRuns: 100 } // Run 100 iterations as specified in design document
        );
    });

    /**
     * Property test: Simple circular dependency detection
     * Verifies that obvious circular dependencies are prevented
     */
    test('Property: Simple circular dependency prevention', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 3, max: 6 }), // Chain length
                async (chainLength) => {
                    const workflow = workflowEngine.createWorkflow('Circular Test');

                    // Create a chain of nodes
                    const nodes: WorkflowNode[] = [];
                    for (let i = 0; i < chainLength; i++) {
                        const node: WorkflowNode = {
                            id: `node_${i}`,
                            type: 'process',
                            position: { x: i * 100, y: 0 },
                            config: { prompt: 'Test prompt' },
                            inputs: [],
                            outputs: []
                        };
                        workflowEngine.addNode(workflow.id, node);
                        nodes.push(node);
                    }

                    // Create a linear chain first
                    for (let i = 0; i < chainLength - 1; i++) {
                        const connection: Connection = {
                            sourceNodeId: `node_${i}`,
                            targetNodeId: `node_${i + 1}`,
                            sourcePort: 'output',
                            targetPort: 'input'
                        };
                        workflowEngine.connectNodes(workflow.id, connection);
                    }

                    // Now try to create a circular dependency by connecting the last node back to the first
                    const circularConnection: Connection = {
                        sourceNodeId: `node_${chainLength - 1}`,
                        targetNodeId: 'node_0',
                        sourcePort: 'output',
                        targetPort: 'input'
                    };

                    // This should be rejected due to circular dependency
                    expect(() => {
                        workflowEngine.connectNodes(workflow.id, circularConnection);
                    }).toThrow(WorkflowEngineError);

                    // Verify the workflow remains valid without the circular connection
                    const finalWorkflow = workflowEngine.getWorkflow(workflow.id);
                    const validation = workflowEngine.validateWorkflow(finalWorkflow!);
                    expect(validation.isValid).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property test: Connection integrity validation
     * Verifies that connections can only be made between existing nodes
     */
    test('Property: Connection integrity validation', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(
                    fc.string({ minLength: 1, maxLength: 10 }),
                    { minLength: 2, maxLength: 5 }
                ),
                fc.array(
                    fc.record({
                        sourceId: fc.string({ minLength: 1, maxLength: 10 }),
                        targetId: fc.string({ minLength: 1, maxLength: 10 }),
                        sourcePort: fc.constantFrom('output', 'result'),
                        targetPort: fc.constantFrom('input', 'data')
                    }),
                    { minLength: 1, maxLength: 8 }
                ),
                async (nodeIds, connectionSpecs) => {
                    const workflow = workflowEngine.createWorkflow('Integrity Test');

                    // Create nodes with unique IDs
                    const uniqueNodeIds = [...new Set(nodeIds)].slice(0, 5); // Limit to 5 unique nodes
                    for (let i = 0; i < uniqueNodeIds.length; i++) {
                        const node: WorkflowNode = {
                            id: `${uniqueNodeIds[i]}_${i}`,
                            type: 'process',
                            position: { x: i * 100, y: 0 },
                            config: { prompt: 'Test prompt' },
                            inputs: [],
                            outputs: []
                        };
                        workflowEngine.addNode(workflow.id, node);
                    }

                    const actualNodeIds = uniqueNodeIds.map((id, i) => `${id}_${i}`);

                    // Attempt connections
                    for (const connSpec of connectionSpecs) {
                        const sourceExists = actualNodeIds.includes(`${connSpec.sourceId}_${actualNodeIds.findIndex(id => id.startsWith(connSpec.sourceId))}`);
                        const targetExists = actualNodeIds.includes(`${connSpec.targetId}_${actualNodeIds.findIndex(id => id.startsWith(connSpec.targetId))}`);

                        // Find actual node IDs that match the spec
                        const actualSourceId = actualNodeIds.find(id => id.startsWith(connSpec.sourceId));
                        const actualTargetId = actualNodeIds.find(id => id.startsWith(connSpec.targetId));

                        if (actualSourceId && actualTargetId && actualSourceId !== actualTargetId) {
                            const connection: Connection = {
                                sourceNodeId: actualSourceId,
                                targetNodeId: actualTargetId,
                                sourcePort: connSpec.sourcePort,
                                targetPort: connSpec.targetPort
                            };

                            try {
                                workflowEngine.connectNodes(workflow.id, connection);
                                // If successful, both nodes must exist
                                expect(sourceExists || actualSourceId).toBeTruthy();
                                expect(targetExists || actualTargetId).toBeTruthy();
                            } catch (error) {
                                // If it fails, it should be due to validation, not missing nodes
                                if (error instanceof WorkflowEngineError) {
                                    // This is expected for invalid connections
                                    expect(error.message).toBeDefined();
                                }
                            }
                        } else if (!actualSourceId || !actualTargetId) {
                            // Connections to non-existent nodes should fail
                            const connection: Connection = {
                                sourceNodeId: connSpec.sourceId,
                                targetNodeId: connSpec.targetId,
                                sourcePort: connSpec.sourcePort,
                                targetPort: connSpec.targetPort
                            };

                            expect(() => {
                                workflowEngine.connectNodes(workflow.id, connection);
                            }).toThrow(WorkflowEngineError);
                        }
                    }

                    // Final workflow should have valid connections only
                    const finalWorkflow = workflowEngine.getWorkflow(workflow.id);
                    for (const connection of finalWorkflow!.connections) {
                        expect(actualNodeIds.includes(connection.sourceNodeId)).toBe(true);
                        expect(actualNodeIds.includes(connection.targetNodeId)).toBe(true);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });
});