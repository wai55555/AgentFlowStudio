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

export interface ConfigField {
    name: string;
    type: 'text' | 'number' | 'select' | 'textarea' | 'checkbox';
    label: string;
    required: boolean;
    defaultValue?: any;
    options?: Array<{ label: string; value: any }>;
    placeholder?: string;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
}

export interface ConfigSchema {
    nodeType: WorkflowNodeType;
    fields: ConfigField[];
    validation?: {
        rules: Array<{ field: string; rule: string; message: string }>;
    };
}

export interface ValidationError {
    field: string;
    message: string;
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

export interface ExecutionContext {
    workflowId: string;
    executionId: string;
    nodeResults: Map<string, any>;
    variables: Map<string, any>;
    executionOrder: string[];
    currentNodeIndex: number;
    startTime: Date;
    status: 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
    errors: Array<{ nodeId: string; error: string; timestamp: Date }>;
}

export interface ExecutionResult {
    executionId: string;
    workflowId: string;
    status: 'completed' | 'failed' | 'cancelled';
    results: Map<string, any>;
    errors: Array<{ nodeId: string; error: string; timestamp: Date }>;
    startTime: Date;
    endTime: Date;
    duration: number;
}

export interface WorkflowEngine {
    createWorkflow(name: string): Workflow;
    addNode(workflowId: string, node: WorkflowNode): void;
    connectNodes(workflowId: string, connection: Connection): void;
    executeWorkflow(workflowId: string): Promise<void>;
    validateWorkflow(workflow: Workflow): ValidationResult;
}