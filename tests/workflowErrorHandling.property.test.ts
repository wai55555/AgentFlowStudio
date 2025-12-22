/**
 * Property-Based Tests for Workflow Error Handling
 * Feature: ai-agent-orchestration, Property 9: Workflow error handling
 * Validates: Requirements 3.5
 */

import * as fc from 'fast-check';
import { WorkflowEngine, WorkflowEngineError } from '../src/services/workflowEngine';
import { UnifiedStorageManager } from '../src/services/storageManager';
import { TaskQueueEngine } from '../src/services/taskQueue';
import { AgentManager } from '../src/services/agentManager';
import { WorkflowNode, Connection, WorkflowNodeType } from '../src/types/workflow';
import { Task } from '../src/types/task';

// Mock the dependencies
jest.mock('../src/services/storageManager');
jest.mock('../src/services/taskQueue');
jest.mock('../src/services/agentManager');

/**
 * Helper function to create a workflow with potential failure points
 */
function createWorkflowWithFailurePoints(
    nodeCount: number,
    failureNodeIndex: number,
    failureType: 'missing_prompt' | 'missing_condition' | 'task_failure' | 'invalid_config'
): { nodes: WorkflowNode[], connections: Connection[], expectedFailureNodeId: string } {
    const nodes: WorkflowNode[] = [];
    const connections: Connection[] = [];

    // Create nodes
    for (let i = 0; i < nodeCount; i++) {
        const nodeType: WorkflowNodeType = i === 0 ? 'input' :
            i === nodeCount - 1 ? 'output' :
                i % 3 === 1 ? 'process' : 'condition';

        let config: any = {};

        // Introduce failure at specific node
        if (i === failureNodeIndex) {
            switch (failureType) {
                case 'missing_prompt':
                    if (nodeType === 'process') {
                        config = {}; // Missing prompt for process node
                    } else {
                        config = { prompt: 'Valid prompt' };
                    }
                    break;
                case 'missing_condition':
                    if (nodeType === 'condition') {
                        config = {}; // Missing condition for condition node
                    } else {
                        config = { condition: 'Valid condition' };
                    }
                    break;
                case 'task_failure':
                    config = {
                        prompt: nodeType === 'process' ? 'FAIL_TASK' : undefined,
                        condition: nodeType === 'condition' ? 'true' : undefined
                    };
                    break;
                case 'invalid_config':
                    config = { invalidProperty: 'invalid' };
                    break;
                default:
                    config = {
                        prompt: nodeType === 'process' ? 'Valid prompt' : undefined,
                        condition: nodeType === 'condition' ? 'true' : undefined
                    };
            }
        } else {
            // Valid configuration for other nodes
            config = {
                prompt: nodeType === 'process' ? 'Valid prompt' : undefined,
                condition: nodeType === 'condition' ? 'true' : undefined
            };
        }

        const node: WorkflowNode = {
            id: `node_${i}`,
            type: nodeType,
            position: { x: i * 100, y: 0 },
            config,
            inputs: [],
            outputs: []
        };
        nodes.push(node);
    }

    // Create linear connections
    for (let i = 0; i < nodeCount - 1; i++) {
        const connection: Connection = {
            sourceNodeId: `node_${i}`,
            targetNodeId: `node_${i + 1}`,
            sourcePort: 'output',
            targetPort: 'input'
        };
        connections.push(connection);
    }

    return {
        nodes,
        connections,
        expectedFailureNodeId: `node_${failureNodeIndex}`
    };
}

describe('Property Tests: Workflow Error Handling', () => {
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

        // Mock task queue methods
        mockTaskQueue.enqueue = jest.fn();
        mockTaskQueue.generateTaskId = jest.fn().mockReturnValue('mock-task-id');

        // Mock task queue to simulate task failures
        mockTaskQueue.getTask = jest.fn().mockImplementation((taskId: string) => {
            const mockTask: Task = {
                id: taskId,
                type: 'simple',
                priority: 5,
                prompt: 'Mock prompt',
                dependencies: [],
                status: 'failed',
                error: 'Simulated task execution failure',
                createdAt: new Date(),
                retryCount: 0
            };
            return mockTask;
        });

        // Mock agent manager methods
        mockAgentManager.getAvailableAgents = jest.fn().mockReturnValue([]);

        workflowEngine = new WorkflowEngine(mockStorageManager, mockTaskQueue, mockAgentManager);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    /**
     * Property 9: Workflow error handling
     * For any workflow execution failure, the system should halt execution and report the exact failure point
     * Validates: Requirements 3.5
     */
    test('Property 9: Workflow error handling', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    nodeCount: fc.integer({ min: 3, max: 8 }),
                    failureNodeIndex: fc.integer({ min: 1, max: 6 }), // Don't fail on input node (index 0)
                    failureType: fc.constantFrom('missing_prompt', 'missing_condition', 'task_failure', 'invalid_config')
                }),
                async ({ nodeCount, failureNodeIndex, failureType }) => {
                    // Ensure failure node index is within bounds
                    const actualFailureIndex = failureNodeIndex % (nodeCount - 1) + 1; // Skip input node

                    const { nodes, connections, expectedFailureNodeId } = createWorkflowWithFailurePoints(
                        nodeCount,
                        actualFailureIndex,
                        failureType
                    );

                    // Create workflow
                    const workflow = workflowEngine.createWorkflow('Error Handling Test');

                    // Add nodes
                    for (const node of nodes) {
                        workflowEngine.addNode(workflow.id, node);
                    }

                    // Add connections - handle validation errors during connection
                    let connectionError: WorkflowEngineError | null = null;
                    try {
                        for (const connection of connections) {
                            workflowEngine.connectNodes(workflow.id, connection);
                        }
                    } catch (error) {
                        if (error instanceof WorkflowEngineError) {
                            connectionError = error;
                        } else {
                            throw error;
                        }
                    }

                    const finalWorkflow = workflowEngine.getWorkflow(workflow.id);
                    expect(finalWorkflow).toBeDefined();

                    // Test different failure scenarios
                    if (failureType === 'missing_prompt' || failureType === 'missing_condition') {
                        // These should be caught during validation or connection
                        if (connectionError) {
                            // Property: Connection errors should identify the specific failing node
                            expect(connectionError.message).toContain(expectedFailureNodeId);
                            expect(connectionError.code).toBe('INVALID_CONNECTION');
                        } else {
                            // If connection succeeded, validation should catch the error
                            const validation = workflowEngine.validateWorkflow(finalWorkflow!);

                            if (!validation.isValid) {
                                // Property: Validation errors should identify the specific failing node
                                const hasExpectedError = validation.errors.some(error =>
                                    error.includes(expectedFailureNodeId) &&
                                    (error.includes('prompt') || error.includes('condition'))
                                );
                                expect(hasExpectedError).toBe(true);

                                // Property: Invalid workflows should not be executable
                                await expect(workflowEngine.executeWorkflow(workflow.id)).rejects.toThrow(WorkflowEngineError);
                            }
                        }
                    } else if (failureType === 'task_failure') {
                        // This should be caught during execution (if connections succeeded)
                        if (!connectionError) {
                            const validation = workflowEngine.validateWorkflow(finalWorkflow!);

                            if (validation.isValid) {
                                // Property: Execution failures should halt workflow and report failure point
                                await expect(workflowEngine.executeWorkflow(workflow.id)).rejects.toThrow(WorkflowEngineError);

                                // Property: Workflow status should be set to 'failed' after execution failure
                                const failedWorkflow = workflowEngine.getWorkflow(workflow.id);
                                expect(failedWorkflow?.status).toBe('failed');
                            }
                        }
                    }

                    // Property: After any failure, workflow should be in a consistent state
                    const consistentWorkflow = workflowEngine.getWorkflow(workflow.id);
                    expect(consistentWorkflow).toBeDefined();
                    expect(consistentWorkflow!.nodes.length).toBe(nodeCount);

                    // Connection count depends on whether connections succeeded
                    if (connectionError) {
                        // If connection failed, no connections should be added
                        expect(consistentWorkflow!.connections.length).toBe(0);
                    } else {
                        // If connections succeeded, should have expected number
                        expect(consistentWorkflow!.connections.length).toBe(nodeCount - 1);
                    }

                    // Property: Error handling should not corrupt workflow data
                    expect(consistentWorkflow!.id).toBe(workflow.id);
                    expect(consistentWorkflow!.name).toBe('Error Handling Test');
                    expect(consistentWorkflow!.nodes.every(n => n.id && n.type)).toBe(true);
                    expect(consistentWorkflow!.connections.every(c =>
                        c.sourceNodeId && c.targetNodeId && c.sourcePort && c.targetPort
                    )).toBe(true);
                }
            ),
            { numRuns: 100 } // Run 100 iterations as specified in design document
        );
    });

    /**
     * Property test: Validation error reporting
     * Verifies that validation errors provide specific information about failure points
     */
    test('Property: Validation error reporting specificity', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    nodeCount: fc.integer({ min: 2, max: 6 }),
                    processNodesWithoutPrompts: fc.array(fc.integer({ min: 0, max: 5 }), { maxLength: 3 }),
                    conditionNodesWithoutConditions: fc.array(fc.integer({ min: 0, max: 5 }), { maxLength: 3 })
                }),
                async ({ nodeCount, processNodesWithoutPrompts, conditionNodesWithoutConditions }) => {
                    const workflow = workflowEngine.createWorkflow('Validation Error Test');

                    // Create nodes with intentional configuration errors
                    const nodes: WorkflowNode[] = [];
                    const expectedErrors: string[] = [];

                    for (let i = 0; i < nodeCount; i++) {
                        const nodeType: WorkflowNodeType = i === 0 ? 'input' :
                            i === nodeCount - 1 ? 'output' :
                                i % 2 === 1 ? 'process' : 'condition';

                        let config: any = {};

                        if (nodeType === 'process') {
                            const shouldMissPrompt = processNodesWithoutPrompts.includes(i);
                            if (shouldMissPrompt) {
                                config = {}; // Missing prompt
                                expectedErrors.push(`node_${i}`);
                            } else {
                                config = { prompt: 'Valid prompt' };
                            }
                        } else if (nodeType === 'condition') {
                            const shouldMissCondition = conditionNodesWithoutConditions.includes(i);
                            if (shouldMissCondition) {
                                config = {}; // Missing condition
                                expectedErrors.push(`node_${i}`);
                            } else {
                                config = { condition: 'true' };
                            }
                        }

                        const node: WorkflowNode = {
                            id: `node_${i}`,
                            type: nodeType,
                            position: { x: i * 100, y: 0 },
                            config,
                            inputs: [],
                            outputs: []
                        };

                        workflowEngine.addNode(workflow.id, node);
                        nodes.push(node);
                    }

                    // Add linear connections - handle validation errors during connection
                    let connectionErrors: WorkflowEngineError[] = [];
                    for (let i = 0; i < nodeCount - 1; i++) {
                        const connection: Connection = {
                            sourceNodeId: `node_${i}`,
                            targetNodeId: `node_${i + 1}`,
                            sourcePort: 'output',
                            targetPort: 'input'
                        };

                        try {
                            workflowEngine.connectNodes(workflow.id, connection);
                        } catch (error) {
                            if (error instanceof WorkflowEngineError) {
                                connectionErrors.push(error);
                            } else {
                                throw error;
                            }
                        }
                    }

                    const finalWorkflow = workflowEngine.getWorkflow(workflow.id);

                    // Check validation if connections succeeded
                    let validation: any = { isValid: true, errors: [], warnings: [] };
                    if (connectionErrors.length === 0) {
                        validation = workflowEngine.validateWorkflow(finalWorkflow!);
                    }

                    // Property: Each expected error should be reported (either in connection or validation)
                    for (const expectedErrorNodeId of expectedErrors) {
                        const hasConnectionError = connectionErrors.some(error =>
                            error.message.includes(expectedErrorNodeId)
                        );
                        const hasValidationError = validation.errors.some((error: string) =>
                            error.includes(expectedErrorNodeId)
                        );

                        expect(hasConnectionError || hasValidationError).toBe(true);
                    }

                    // Property: Should have errors if there are configuration issues
                    if (expectedErrors.length > 0) {
                        expect(connectionErrors.length > 0 || !validation.isValid).toBe(true);
                    }

                    // Property: Error messages should be descriptive
                    const allErrors = [
                        ...connectionErrors.map(e => e.message),
                        ...validation.errors
                    ];

                    for (const error of allErrors) {
                        expect(error.length).toBeGreaterThan(10); // Should be descriptive
                        expect(error).toMatch(/node_\d+/); // Should contain node ID
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property test: Execution failure recovery
     * Verifies that execution failures leave the workflow in a recoverable state
     */
    test('Property: Execution failure recovery', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    nodeCount: fc.integer({ min: 3, max: 6 }),
                    workflowName: fc.string({ minLength: 1, maxLength: 20 })
                }),
                async ({ nodeCount, workflowName }) => {
                    const workflow = workflowEngine.createWorkflow(workflowName);

                    // Create valid workflow structure
                    const nodes: WorkflowNode[] = [];
                    for (let i = 0; i < nodeCount; i++) {
                        const nodeType: WorkflowNodeType = i === 0 ? 'input' :
                            i === nodeCount - 1 ? 'output' : 'process';

                        const node: WorkflowNode = {
                            id: `node_${i}`,
                            type: nodeType,
                            position: { x: i * 100, y: 0 },
                            config: {
                                prompt: nodeType === 'process' ? 'Valid prompt' : undefined
                            },
                            inputs: [],
                            outputs: []
                        };

                        workflowEngine.addNode(workflow.id, node);
                        nodes.push(node);
                    }

                    // Add connections
                    for (let i = 0; i < nodeCount - 1; i++) {
                        const connection: Connection = {
                            sourceNodeId: `node_${i}`,
                            targetNodeId: `node_${i + 1}`,
                            sourcePort: 'output',
                            targetPort: 'input'
                        };
                        workflowEngine.connectNodes(workflow.id, connection);
                    }

                    const finalWorkflow = workflowEngine.getWorkflow(workflow.id);
                    const validation = workflowEngine.validateWorkflow(finalWorkflow!);

                    // Property: Valid workflows should be structurally sound
                    if (validation.isValid) {
                        expect(finalWorkflow?.nodes.length).toBe(nodeCount);
                        expect(finalWorkflow?.connections.length).toBe(nodeCount - 1);
                        expect(finalWorkflow?.status).toBe('draft');

                        // Property: Workflow should be recoverable (can be validated again)
                        const recoveryValidation = workflowEngine.validateWorkflow(finalWorkflow!);
                        expect(recoveryValidation.isValid).toBe(true);

                        // Property: Valid workflow can be deleted cleanly
                        const deleteResult = workflowEngine.deleteWorkflow(workflow.id);
                        expect(deleteResult).toBe(true);
                        expect(workflowEngine.getWorkflow(workflow.id)).toBeUndefined();
                    } else {
                        // Property: Invalid workflows should still maintain structural integrity
                        expect(finalWorkflow?.nodes.length).toBe(nodeCount);
                        expect(finalWorkflow?.id).toBe(workflow.id);
                        expect(finalWorkflow?.name).toBe(workflowName);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property test: Error message consistency
     * Verifies that error messages are consistent and informative
     */
    test('Property: Error message consistency', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    errorScenario: fc.constantFrom(
                        'nonexistent_workflow',
                        'duplicate_node',
                        'invalid_connection',
                        'missing_source_node',
                        'missing_target_node'
                    ),
                    workflowName: fc.string({ minLength: 1, maxLength: 50 }),
                    nodeId: fc.string({ minLength: 1, maxLength: 20 })
                }),
                async ({ errorScenario, workflowName, nodeId }) => {
                    let thrownError: WorkflowEngineError | null = null;

                    try {
                        switch (errorScenario) {
                            case 'nonexistent_workflow':
                                const node: WorkflowNode = {
                                    id: nodeId,
                                    type: 'input',
                                    position: { x: 0, y: 0 },
                                    config: {},
                                    inputs: [],
                                    outputs: []
                                };
                                workflowEngine.addNode('nonexistent-workflow-id', node);
                                break;

                            case 'duplicate_node':
                                const workflow = workflowEngine.createWorkflow(workflowName);
                                const duplicateNode: WorkflowNode = {
                                    id: nodeId,
                                    type: 'input',
                                    position: { x: 0, y: 0 },
                                    config: {},
                                    inputs: [],
                                    outputs: []
                                };
                                workflowEngine.addNode(workflow.id, duplicateNode);
                                workflowEngine.addNode(workflow.id, duplicateNode); // Duplicate
                                break;

                            case 'invalid_connection':
                                const workflow2 = workflowEngine.createWorkflow(workflowName);
                                const node1: WorkflowNode = {
                                    id: 'node1',
                                    type: 'input',
                                    position: { x: 0, y: 0 },
                                    config: {},
                                    inputs: [],
                                    outputs: []
                                };
                                const node2: WorkflowNode = {
                                    id: 'node2',
                                    type: 'output',
                                    position: { x: 100, y: 0 },
                                    config: {},
                                    inputs: [],
                                    outputs: []
                                };
                                workflowEngine.addNode(workflow2.id, node1);
                                workflowEngine.addNode(workflow2.id, node2);

                                const connection: Connection = {
                                    sourceNodeId: 'node1',
                                    targetNodeId: 'node2',
                                    sourcePort: 'output',
                                    targetPort: 'input'
                                };
                                workflowEngine.connectNodes(workflow2.id, connection);
                                workflowEngine.connectNodes(workflow2.id, connection); // Duplicate connection
                                break;

                            case 'missing_source_node':
                                const workflow3 = workflowEngine.createWorkflow(workflowName);
                                const targetNode: WorkflowNode = {
                                    id: 'target',
                                    type: 'output',
                                    position: { x: 100, y: 0 },
                                    config: {},
                                    inputs: [],
                                    outputs: []
                                };
                                workflowEngine.addNode(workflow3.id, targetNode);

                                const invalidConnection: Connection = {
                                    sourceNodeId: 'nonexistent-source',
                                    targetNodeId: 'target',
                                    sourcePort: 'output',
                                    targetPort: 'input'
                                };
                                workflowEngine.connectNodes(workflow3.id, invalidConnection);
                                break;

                            case 'missing_target_node':
                                const workflow4 = workflowEngine.createWorkflow(workflowName);
                                const sourceNode: WorkflowNode = {
                                    id: 'source',
                                    type: 'input',
                                    position: { x: 0, y: 0 },
                                    config: {},
                                    inputs: [],
                                    outputs: []
                                };
                                workflowEngine.addNode(workflow4.id, sourceNode);

                                const invalidConnection2: Connection = {
                                    sourceNodeId: 'source',
                                    targetNodeId: 'nonexistent-target',
                                    sourcePort: 'output',
                                    targetPort: 'input'
                                };
                                workflowEngine.connectNodes(workflow4.id, invalidConnection2);
                                break;
                        }
                    } catch (error) {
                        if (error instanceof WorkflowEngineError) {
                            thrownError = error;
                        } else {
                            throw error; // Re-throw unexpected errors
                        }
                    }

                    // Property: Expected error scenarios should throw WorkflowEngineError
                    expect(thrownError).toBeInstanceOf(WorkflowEngineError);

                    if (thrownError) {
                        // Property: Error messages should be informative
                        expect(thrownError.message.length).toBeGreaterThan(5);

                        // Property: Error should have appropriate error code
                        expect(thrownError.code).toBeDefined();
                        expect(typeof thrownError.code).toBe('string');

                        // Property: Error codes should match the scenario
                        switch (errorScenario) {
                            case 'nonexistent_workflow':
                                expect(thrownError.code).toBe('WORKFLOW_NOT_FOUND');
                                break;
                            case 'duplicate_node':
                                expect(thrownError.code).toBe('DUPLICATE_NODE_ID');
                                break;
                            case 'invalid_connection':
                                expect(thrownError.code).toBe('DUPLICATE_CONNECTION');
                                break;
                            case 'missing_source_node':
                            case 'missing_target_node':
                                expect(thrownError.code).toBe('NODE_NOT_FOUND');
                                break;
                        }

                        // Property: Error name should be consistent
                        expect(thrownError.name).toBe('WorkflowEngineError');
                    }
                }
            ),
            { numRuns: 100 }
        );
    });
});