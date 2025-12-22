/**
 * Core Workflow interfaces for the AI Agent Orchestration Platform
 */

export type WorkflowNodeType = 'input' | 'process' | 'output' | 'condition';
export type WorkflowStatus = 'draft' | 'running' | 'completed' | 'failed';

export interface Position {
    x: number;
    y: number;
}

export interface NodeConfig {
    prompt?: string;
    condition?: string;
    agentRole?: string;
}

export interface Connection {
    sourceNodeId: string;
    targetNodeId: string;
    sourcePort: string;
    targetPort: string;
}

export interface WorkflowNode {
    id: string;
    type: WorkflowNodeType;
    position: Position;
    config: NodeConfig;
    inputs: Connection[];
    outputs: Connection[];
}

export interface Workflow {
    id: string;
    name: string;
    nodes: WorkflowNode[];
    connections: Connection[];
    status: WorkflowStatus;
}

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

export interface WorkflowEngine {
    createWorkflow(name: string): Workflow;
    addNode(workflowId: string, node: WorkflowNode): void;
    connectNodes(workflowId: string, connection: Connection): void;
    executeWorkflow(workflowId: string): Promise<void>;
    validateWorkflow(workflow: Workflow): ValidationResult;
}