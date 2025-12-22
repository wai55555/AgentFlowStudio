/**
 * Workflow Engine Service
 * Manages workflow creation, validation, execution, and data flow
 */

import {
    Workflow,
    WorkflowNode,
    Connection,
    ValidationResult,
    WorkflowEngine as IWorkflowEngine,
    WorkflowStatus
} from '../types/workflow';
import { Task } from '../types/task';
import { UnifiedStorageManager } from './storageManager';
import { TaskQueueEngine } from './taskQueue';
import { AgentManager } from './agentManager';

export class WorkflowEngineError extends Error {
    constructor(message: string, public code?: string) {
        super(message);
        this.name = 'WorkflowEngineError';
    }
}

interface ExecutionContext {
    workflowId: string;
    nodeResults: Map<string, any>;
    executionOrder: string[];
    currentNodeIndex: number;
    errors: string[];
}

export class WorkflowEngine implements IWorkflowEngine {
    private workflows: Map<string, Workflow> = new Map();
    private storageManager: UnifiedStorageManager;
    private taskQueue: TaskQueueEngine;
    private agentManager: AgentManager;
    private executionContexts: Map<string, ExecutionContext> = new Map();

    constructor(
        storageManager: UnifiedStorageManager,
        taskQueue: TaskQueueEngine,
        agentManager: AgentManager
    ) {
        this.storageManager = storageManager;
        this.taskQueue = taskQueue;
        this.agentManager = agentManager;
        this.loadWorkflowsFromStorage();
    }

    /**
     * Creates a new workflow with unique ID
     */
    createWorkflow(name: string): Workflow {
        const id = this.generateUniqueId();

        const workflow: Workflow = {
            id,
            name,
            nodes: [],
            connections: [],
            status: 'draft'
        };

        this.workflows.set(id, workflow);
        this.saveWorkflowToStorage(workflow);

        return workflow;
    }

    /**
     * Adds a node to an existing workflow
     */
    addNode(workflowId: string, node: WorkflowNode): void {
        const workflow = this.workflows.get(workflowId);
        if (!workflow) {
            throw new WorkflowEngineError(`Workflow with ID ${workflowId} not found`, 'WORKFLOW_NOT_FOUND');
        }

        // Check if node ID already exists
        if (workflow.nodes.some(n => n.id === node.id)) {
            throw new WorkflowEngineError(`Node with ID ${node.id} already exists in workflow`, 'DUPLICATE_NODE_ID');
        }

        workflow.nodes.push(node);
        this.saveWorkflowToStorage(workflow);
    }

    /**
     * Connects two nodes in a workflow with validation
     */
    connectNodes(workflowId: string, connection: Connection): void {
        const workflow = this.workflows.get(workflowId);
        if (!workflow) {
            throw new WorkflowEngineError(`Workflow with ID ${workflowId} not found`, 'WORKFLOW_NOT_FOUND');
        }

        // Validate that both nodes exist
        const sourceNode = workflow.nodes.find(n => n.id === connection.sourceNodeId);
        const targetNode = workflow.nodes.find(n => n.id === connection.targetNodeId);

        if (!sourceNode) {
            throw new WorkflowEngineError(`Source node ${connection.sourceNodeId} not found`, 'NODE_NOT_FOUND');
        }
        if (!targetNode) {
            throw new WorkflowEngineError(`Target node ${connection.targetNodeId} not found`, 'NODE_NOT_FOUND');
        }

        // Check for duplicate connections
        const existingConnection = workflow.connections.find(c =>
            c.sourceNodeId === connection.sourceNodeId &&
            c.targetNodeId === connection.targetNodeId &&
            c.sourcePort === connection.sourcePort &&
            c.targetPort === connection.targetPort
        );

        if (existingConnection) {
            throw new WorkflowEngineError('Connection already exists', 'DUPLICATE_CONNECTION');
        }

        // Add connection to workflow
        workflow.connections.push(connection);

        // Update node connection references
        sourceNode.outputs.push(connection);
        targetNode.inputs.push(connection);

        // Validate workflow after adding connection
        const validation = this.validateWorkflow(workflow);
        if (!validation.isValid) {
            // Rollback the connection
            workflow.connections.pop();
            sourceNode.outputs.pop();
            targetNode.inputs.pop();

            throw new WorkflowEngineError(
                `Invalid connection: ${validation.errors.join(', ')}`,
                'INVALID_CONNECTION'
            );
        }

        this.saveWorkflowToStorage(workflow);
    }

    /**
     * Validates a workflow for circular dependencies and structural integrity
     */
    validateWorkflow(workflow: Workflow): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Check for circular dependencies using DFS
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
            const outgoingConnections = workflow.connections.filter(c => c.sourceNodeId === nodeId);
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
                errors.push(`Circular dependency detected involving node ${node.id}`);
                break; // One cycle detection is enough
            }
        }

        // Validate node configurations
        for (const node of workflow.nodes) {
            if (node.type === 'process' && !node.config.prompt) {
                errors.push(`Process node ${node.id} requires a prompt configuration`);
            }
            if (node.type === 'condition' && !node.config.condition) {
                errors.push(`Condition node ${node.id} requires a condition configuration`);
            }
        }

        // Check for orphaned nodes (nodes with no connections)
        if (workflow.nodes.length > 1) {
            for (const node of workflow.nodes) {
                const hasIncoming = workflow.connections.some(c => c.targetNodeId === node.id);
                const hasOutgoing = workflow.connections.some(c => c.sourceNodeId === node.id);

                if (!hasIncoming && !hasOutgoing && node.type !== 'input') {
                    warnings.push(`Node ${node.id} has no connections`);
                }
            }
        }

        // Validate that there's at least one input node for execution
        const inputNodes = workflow.nodes.filter(n => n.type === 'input');
        if (workflow.nodes.length > 0 && inputNodes.length === 0) {
            warnings.push('Workflow has no input nodes');
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Executes a workflow by processing nodes in dependency order
     */
    async executeWorkflow(workflowId: string): Promise<void> {
        const workflow = this.workflows.get(workflowId);
        if (!workflow) {
            throw new WorkflowEngineError(`Workflow with ID ${workflowId} not found`, 'WORKFLOW_NOT_FOUND');
        }

        // Validate workflow before execution
        const validation = this.validateWorkflow(workflow);
        if (!validation.isValid) {
            throw new WorkflowEngineError(
                `Cannot execute invalid workflow: ${validation.errors.join(', ')}`,
                'INVALID_WORKFLOW'
            );
        }

        // Update workflow status
        workflow.status = 'running';
        this.saveWorkflowToStorage(workflow);

        try {
            // Calculate execution order using topological sort
            const executionOrder = this.calculateExecutionOrder(workflow);

            // Create execution context
            const context: ExecutionContext = {
                workflowId,
                nodeResults: new Map(),
                executionOrder,
                currentNodeIndex: 0,
                errors: []
            };

            this.executionContexts.set(workflowId, context);

            // Execute nodes in order
            await this.executeNodesInOrder(workflow, context);

            // Mark workflow as completed
            workflow.status = 'completed';
            this.executionContexts.delete(workflowId);

        } catch (error) {
            // Mark workflow as failed and report error
            workflow.status = 'failed';
            this.executionContexts.delete(workflowId);

            const errorMessage = error instanceof Error ? error.message : 'Unknown execution error';
            throw new WorkflowEngineError(
                `Workflow execution failed: ${errorMessage}`,
                'EXECUTION_FAILED'
            );
        } finally {
            this.saveWorkflowToStorage(workflow);
        }
    }

    /**
     * Gets all workflows
     */
    getWorkflows(): Workflow[] {
        return Array.from(this.workflows.values());
    }

    /**
     * Gets a specific workflow by ID
     */
    getWorkflow(workflowId: string): Workflow | undefined {
        return this.workflows.get(workflowId);
    }

    /**
     * Deletes a workflow
     */
    deleteWorkflow(workflowId: string): boolean {
        const workflow = this.workflows.get(workflowId);
        if (!workflow) {
            return false;
        }

        // Stop execution if running
        if (workflow.status === 'running') {
            this.executionContexts.delete(workflowId);
        }

        this.workflows.delete(workflowId);
        this.removeWorkflowFromStorage(workflowId);
        return true;
    }

    /**
     * Calculates the execution order using topological sort
     */
    private calculateExecutionOrder(workflow: Workflow): string[] {
        const inDegree = new Map<string, number>();
        const adjList = new Map<string, string[]>();

        // Initialize in-degree and adjacency list
        for (const node of workflow.nodes) {
            inDegree.set(node.id, 0);
            adjList.set(node.id, []);
        }

        // Build adjacency list and calculate in-degrees
        for (const connection of workflow.connections) {
            const sourceId = connection.sourceNodeId;
            const targetId = connection.targetNodeId;

            adjList.get(sourceId)?.push(targetId);
            inDegree.set(targetId, (inDegree.get(targetId) || 0) + 1);
        }

        // Topological sort using Kahn's algorithm
        const queue: string[] = [];
        const result: string[] = [];

        // Add all nodes with in-degree 0 to queue
        for (const [nodeId, degree] of inDegree) {
            if (degree === 0) {
                queue.push(nodeId);
            }
        }

        while (queue.length > 0) {
            const currentNode = queue.shift()!;
            result.push(currentNode);

            // Process all neighbors
            const neighbors = adjList.get(currentNode) || [];
            for (const neighbor of neighbors) {
                const newDegree = (inDegree.get(neighbor) || 0) - 1;
                inDegree.set(neighbor, newDegree);

                if (newDegree === 0) {
                    queue.push(neighbor);
                }
            }
        }

        // Check if all nodes were processed (no cycles)
        if (result.length !== workflow.nodes.length) {
            throw new WorkflowEngineError('Circular dependency detected in workflow', 'CIRCULAR_DEPENDENCY');
        }

        return result;
    }

    /**
     * Executes nodes in the calculated order
     */
    private async executeNodesInOrder(workflow: Workflow, context: ExecutionContext): Promise<void> {
        for (let i = 0; i < context.executionOrder.length; i++) {
            context.currentNodeIndex = i;
            const nodeId = context.executionOrder[i];
            const node = workflow.nodes.find(n => n.id === nodeId);

            if (!node) {
                throw new WorkflowEngineError(`Node ${nodeId} not found during execution`, 'NODE_NOT_FOUND');
            }

            try {
                const result = await this.executeNode(node, context);
                context.nodeResults.set(nodeId, result);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown node execution error';
                context.errors.push(`Node ${nodeId}: ${errorMessage}`);
                throw new WorkflowEngineError(
                    `Node execution failed at ${nodeId}: ${errorMessage}`,
                    'NODE_EXECUTION_FAILED'
                );
            }
        }
    }

    /**
     * Executes a single node based on its type
     */
    private async executeNode(node: WorkflowNode, context: ExecutionContext): Promise<any> {
        switch (node.type) {
            case 'input':
                return this.executeInputNode(node, context);

            case 'process':
                return this.executeProcessNode(node, context);

            case 'condition':
                return this.executeConditionNode(node, context);

            case 'output':
                return this.executeOutputNode(node, context);

            default:
                throw new WorkflowEngineError(`Unknown node type: ${node.type}`, 'UNKNOWN_NODE_TYPE');
        }
    }

    /**
     * Executes an input node
     */
    private async executeInputNode(node: WorkflowNode, context: ExecutionContext): Promise<any> {
        // Input nodes typically provide initial data
        // For now, return a simple input value
        return {
            type: 'input',
            nodeId: node.id,
            data: node.config.prompt || 'Initial input data'
        };
    }

    /**
     * Executes a process node using an available agent
     */
    private async executeProcessNode(node: WorkflowNode, context: ExecutionContext): Promise<any> {
        if (!node.config.prompt) {
            throw new WorkflowEngineError(`Process node ${node.id} has no prompt configured`, 'MISSING_PROMPT');
        }

        // Collect input data from connected nodes
        const inputData = this.collectInputData(node, context);

        // Create a task for this node
        const task: Task = {
            id: this.taskQueue.generateTaskId(),
            type: 'simple',
            priority: 5, // Default priority
            prompt: this.buildPromptWithInputData(node.config.prompt, inputData),
            dependencies: [],
            status: 'pending',
            createdAt: new Date(),
            retryCount: 0
        };

        // Add task to queue and wait for completion
        this.taskQueue.enqueue(task);

        // Wait for task completion (simplified - in real implementation, this would be event-driven)
        return new Promise((resolve, reject) => {
            const checkCompletion = () => {
                const updatedTask = this.taskQueue.getTask(task.id);
                if (!updatedTask) {
                    reject(new Error('Task was removed from queue'));
                    return;
                }

                if (updatedTask.status === 'completed') {
                    resolve({
                        type: 'process',
                        nodeId: node.id,
                        data: updatedTask.result,
                        inputData
                    });
                } else if (updatedTask.status === 'failed') {
                    reject(new Error(updatedTask.error || 'Task execution failed'));
                } else {
                    // Check again in 1 second
                    setTimeout(checkCompletion, 1000);
                }
            };

            checkCompletion();
        });
    }

    /**
     * Executes a condition node
     */
    private async executeConditionNode(node: WorkflowNode, context: ExecutionContext): Promise<any> {
        if (!node.config.condition) {
            throw new WorkflowEngineError(`Condition node ${node.id} has no condition configured`, 'MISSING_CONDITION');
        }

        // Collect input data from connected nodes
        const inputData = this.collectInputData(node, context);

        // Evaluate condition (simplified - in real implementation, this would be more sophisticated)
        const conditionResult = this.evaluateCondition(node.config.condition, inputData);

        return {
            type: 'condition',
            nodeId: node.id,
            data: conditionResult,
            inputData
        };
    }

    /**
     * Executes an output node
     */
    private async executeOutputNode(node: WorkflowNode, context: ExecutionContext): Promise<any> {
        // Collect input data from connected nodes
        const inputData = this.collectInputData(node, context);

        return {
            type: 'output',
            nodeId: node.id,
            data: inputData,
            finalResult: true
        };
    }

    /**
     * Collects input data from nodes connected to the current node
     */
    private collectInputData(node: WorkflowNode, context: ExecutionContext): any[] {
        const inputData: any[] = [];

        for (const connection of node.inputs) {
            const sourceResult = context.nodeResults.get(connection.sourceNodeId);
            if (sourceResult) {
                inputData.push(sourceResult);
            }
        }

        return inputData;
    }

    /**
     * Builds a prompt with input data incorporated
     */
    private buildPromptWithInputData(prompt: string, inputData: any[]): string {
        if (inputData.length === 0) {
            return prompt;
        }

        const dataString = inputData
            .map(data => typeof data === 'object' ? JSON.stringify(data) : String(data))
            .join('\n\n');

        return `${prompt}\n\nInput Data:\n${dataString}`;
    }

    /**
     * Evaluates a condition (simplified implementation)
     */
    private evaluateCondition(condition: string, inputData: any[]): boolean {
        // This is a very simplified condition evaluation
        // In a real implementation, this would be much more sophisticated
        try {
            // For now, just check if condition contains "true" or if there's input data
            return condition.toLowerCase().includes('true') || inputData.length > 0;
        } catch (error) {
            return false;
        }
    }

    /**
     * Generates a unique workflow ID
     */
    private generateUniqueId(): string {
        const timestamp = Date.now().toString(36);
        const randomPart = Math.random().toString(36).substring(2, 8);
        const id = `workflow_${timestamp}_${randomPart}`;

        if (this.workflows.has(id)) {
            return this.generateUniqueId();
        }

        return id;
    }

    /**
     * Loads workflows from storage
     */
    private async loadWorkflowsFromStorage(): Promise<void> {
        try {
            const storedWorkflows = await this.storageManager.loadWorkflows();
            if (storedWorkflows && Array.isArray(storedWorkflows)) {
                this.workflows.clear();
                storedWorkflows.forEach(workflow => {
                    if (workflow.id && workflow.name) {
                        this.workflows.set(workflow.id, workflow);
                    }
                });
            }
        } catch (error) {
            console.error('Failed to load workflows from storage:', error);
        }
    }

    /**
     * Saves a workflow to storage
     */
    private async saveWorkflowToStorage(workflow: Workflow): Promise<void> {
        try {
            await this.storageManager.saveWorkflow(workflow);
        } catch (error) {
            console.error('Failed to save workflow to storage:', error);
            throw new WorkflowEngineError('Failed to persist workflow data', 'STORAGE_ERROR');
        }
    }

    /**
     * Removes a workflow from storage
     */
    private async removeWorkflowFromStorage(workflowId: string): Promise<void> {
        try {
            // Note: This would need to be implemented in the storage manager
            console.log(`Workflow ${workflowId} should be removed from storage`);
        } catch (error) {
            console.error('Failed to remove workflow from storage:', error);
        }
    }
}