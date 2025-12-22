/**
 * Basic tests to verify TypeScript interfaces are properly defined
 */

import type {
    Agent,
    Task,
    Workflow,
    AgentStatus,
    TaskStatus,
    WorkflowStatus
} from '../src/types';

describe('Type Definitions', () => {
    test('Agent interface should have required properties', () => {
        const mockAgent: Agent = {
            id: 'test-agent-1',
            name: 'Test Agent',
            role: 'assistant',
            promptTemplate: 'You are a helpful assistant',
            status: 'idle' as AgentStatus,
            config: {
                maxTokens: 1000,
                temperature: 0.7,
                model: 'xiaomi/mimo-v2-flash:free'
            },
            stats: {
                tasksCompleted: 0,
                averageResponseTime: 0,
                errorCount: 0
            }
        };

        expect(mockAgent.id).toBe('test-agent-1');
        expect(mockAgent.status).toBe('idle');
        expect(mockAgent.config.maxTokens).toBe(1000);
    });

    test('Task interface should have required properties', () => {
        const mockTask: Task = {
            id: 'test-task-1',
            type: 'simple',
            priority: 1,
            prompt: 'Test prompt',
            dependencies: [],
            status: 'pending' as TaskStatus,
            createdAt: new Date(),
            retryCount: 0
        };

        expect(mockTask.id).toBe('test-task-1');
        expect(mockTask.type).toBe('simple');
        expect(mockTask.status).toBe('pending');
    });

    test('Workflow interface should have required properties', () => {
        const mockWorkflow: Workflow = {
            id: 'test-workflow-1',
            name: 'Test Workflow',
            nodes: [],
            connections: [],
            status: 'draft' as WorkflowStatus
        };

        expect(mockWorkflow.id).toBe('test-workflow-1');
        expect(mockWorkflow.name).toBe('Test Workflow');
        expect(mockWorkflow.status).toBe('draft');
    });

    test('Status types should be properly typed', () => {
        const agentStatuses: AgentStatus[] = ['idle', 'busy', 'error'];
        const taskStatuses: TaskStatus[] = ['pending', 'running', 'completed', 'failed'];
        const workflowStatuses: WorkflowStatus[] = ['draft', 'running', 'completed', 'failed'];

        expect(agentStatuses).toHaveLength(3);
        expect(taskStatuses).toHaveLength(4);
        expect(workflowStatuses).toHaveLength(4);
    });
});