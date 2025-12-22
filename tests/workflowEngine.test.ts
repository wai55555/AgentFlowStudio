/**
 * Unit tests for WorkflowEngine
 */

import { WorkflowEngine, WorkflowEngineError } from '../src/services/workflowEngine';
import { UnifiedStorageManager } from '../src/services/storageManager';
import { TaskQueueEngine } from '../src/services/taskQueue';
import { AgentManager } from '../src/services/agentManager';
import { WorkflowNode, Connection } from '../src/types/workflow';

// Mock the storage manager
jest.mock('../src/services/storageManager');
jest.mock('../src/services/taskQueue');
jest.mock('../src/services/agentManager');

describe('WorkflowEngine', () => {
    let workflowEngine: WorkflowEngine;
    let mockStorageManager: jest.Mocked<UnifiedStorageManager>;
    let mockTaskQueue: jest.Mocked<TaskQueueEngine>;
    let mockAgentManager: jest.Mocked<AgentManager>;

    beforeEach(() => {
        mockStorageManager = new UnifiedStorageManager() as jest.Mocked<UnifiedStorageManager>;
        mockTaskQueue = new TaskQueueEngine(mockStorageManager, mockAgentManager) as jest.Mocked<TaskQueueEngine>;
        mockAgentManager = new AgentManager(mockStorageManager) as jest.Mocked<AgentManager>;

        // Mock storage methods
        mockStorageManager.loadWorkflows = jest.fn().mockResolvedValue([]);
        mockStorageManager.saveWorkflow = jest.fn().mockResolvedValue(undefined);

        workflowEngine = new WorkflowEngine(mockStorageManager, mockTaskQueue, mockAgentManager);
    });

    describe('createWorkflow', () => {
        it('should create a new workflow with unique ID', () => {
            const workflow = workflowEngine.createWorkflow('Test Workflow');

            expect(workflow.id).toBeDefined();
            expect(workflow.name).toBe('Test Workflow');
            expect(workflow.nodes).toEqual([]);
            expect(workflow.connections).toEqual([]);
            expect(workflow.status).toBe('draft');
        });

        it('should save workflow to storage', () => {
            const workflow = workflowEngine.createWorkflow('Test Workflow');

            expect(mockStorageManager.saveWorkflow).toHaveBeenCalledWith(workflow);
        });
    });

    describe('addNode', () => {
        it('should add a node to existing workflow', () => {
            const workflow = workflowEngine.createWorkflow('Test Workflow');
            const node: WorkflowNode = {
                id: 'node1',
                type: 'input',
                position: { x: 0, y: 0 },
                config: {},
                inputs: [],
                outputs: []
            };

            workflowEngine.addNode(workflow.id, node);

            const updatedWorkflow = workflowEngine.getWorkflow(workflow.id);
            expect(updatedWorkflow?.nodes).toHaveLength(1);
            expect(updatedWorkflow?.nodes[0]).toEqual(node);
        });

        it('should throw error for non-existent workflow', () => {
            const node: WorkflowNode = {
                id: 'node1',
                type: 'input',
                position: { x: 0, y: 0 },
                config: {},
                inputs: [],
                outputs: []
            };

            expect(() => {
                workflowEngine.addNode('non-existent', node);
            }).toThrow(WorkflowEngineError);
        });

        it('should throw error for duplicate node ID', () => {
            const workflow = workflowEngine.createWorkflow('Test Workflow');
            const node: WorkflowNode = {
                id: 'node1',
                type: 'input',
                position: { x: 0, y: 0 },
                config: {},
                inputs: [],
                outputs: []
            };

            workflowEngine.addNode(workflow.id, node);

            expect(() => {
                workflowEngine.addNode(workflow.id, node);
            }).toThrow(WorkflowEngineError);
        });
    });

    describe('connectNodes', () => {
        it('should connect two existing nodes', () => {
            const workflow = workflowEngine.createWorkflow('Test Workflow');

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

            workflowEngine.addNode(workflow.id, node1);
            workflowEngine.addNode(workflow.id, node2);

            const connection: Connection = {
                sourceNodeId: 'node1',
                targetNodeId: 'node2',
                sourcePort: 'output',
                targetPort: 'input'
            };

            workflowEngine.connectNodes(workflow.id, connection);

            const updatedWorkflow = workflowEngine.getWorkflow(workflow.id);
            expect(updatedWorkflow?.connections).toHaveLength(1);
            expect(updatedWorkflow?.connections[0]).toEqual(connection);
        });

        it('should throw error for non-existent source node', () => {
            const workflow = workflowEngine.createWorkflow('Test Workflow');

            const node2: WorkflowNode = {
                id: 'node2',
                type: 'output',
                position: { x: 100, y: 0 },
                config: {},
                inputs: [],
                outputs: []
            };

            workflowEngine.addNode(workflow.id, node2);

            const connection: Connection = {
                sourceNodeId: 'non-existent',
                targetNodeId: 'node2',
                sourcePort: 'output',
                targetPort: 'input'
            };

            expect(() => {
                workflowEngine.connectNodes(workflow.id, connection);
            }).toThrow(WorkflowEngineError);
        });
    });

    describe('validateWorkflow', () => {
        it('should validate workflow without circular dependencies', () => {
            const workflow = workflowEngine.createWorkflow('Test Workflow');

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

            workflowEngine.addNode(workflow.id, node1);
            workflowEngine.addNode(workflow.id, node2);

            const connection: Connection = {
                sourceNodeId: 'node1',
                targetNodeId: 'node2',
                sourcePort: 'output',
                targetPort: 'input'
            };

            workflowEngine.connectNodes(workflow.id, connection);

            const updatedWorkflow = workflowEngine.getWorkflow(workflow.id)!;
            const validation = workflowEngine.validateWorkflow(updatedWorkflow);

            expect(validation.isValid).toBe(true);
            expect(validation.errors).toHaveLength(0);
        });

        it('should detect missing prompt in process node', () => {
            const workflow = workflowEngine.createWorkflow('Test Workflow');

            const processNode: WorkflowNode = {
                id: 'process1',
                type: 'process',
                position: { x: 0, y: 0 },
                config: {}, // Missing prompt
                inputs: [],
                outputs: []
            };

            workflowEngine.addNode(workflow.id, processNode);

            const updatedWorkflow = workflowEngine.getWorkflow(workflow.id)!;
            const validation = workflowEngine.validateWorkflow(updatedWorkflow);

            expect(validation.isValid).toBe(false);
            expect(validation.errors).toContain('Process node process1 requires a prompt configuration');
        });

        it('should detect missing condition in condition node', () => {
            const workflow = workflowEngine.createWorkflow('Test Workflow');

            const conditionNode: WorkflowNode = {
                id: 'condition1',
                type: 'condition',
                position: { x: 0, y: 0 },
                config: {}, // Missing condition
                inputs: [],
                outputs: []
            };

            workflowEngine.addNode(workflow.id, conditionNode);

            const updatedWorkflow = workflowEngine.getWorkflow(workflow.id)!;
            const validation = workflowEngine.validateWorkflow(updatedWorkflow);

            expect(validation.isValid).toBe(false);
            expect(validation.errors).toContain('Condition node condition1 requires a condition configuration');
        });
    });

    describe('deleteWorkflow', () => {
        it('should delete existing workflow', () => {
            const workflow = workflowEngine.createWorkflow('Test Workflow');

            const result = workflowEngine.deleteWorkflow(workflow.id);

            expect(result).toBe(true);
            expect(workflowEngine.getWorkflow(workflow.id)).toBeUndefined();
        });

        it('should return false for non-existent workflow', () => {
            const result = workflowEngine.deleteWorkflow('non-existent');

            expect(result).toBe(false);
        });
    });

    describe('getWorkflows', () => {
        it('should return all workflows', () => {
            const workflow1 = workflowEngine.createWorkflow('Workflow 1');
            const workflow2 = workflowEngine.createWorkflow('Workflow 2');

            const workflows = workflowEngine.getWorkflows();

            expect(workflows).toHaveLength(2);
            expect(workflows.map(w => w.id)).toContain(workflow1.id);
            expect(workflows.map(w => w.id)).toContain(workflow2.id);
        });
    });
});