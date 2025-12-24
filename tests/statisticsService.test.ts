/**
 * StatisticsService Tests
 * Tests for type-safe groupBy functionality
 */

import { StatisticsService } from '../src/services/statisticsService';
import { AgentManager } from '../src/services/agentManager';
import { TaskQueueEngine } from '../src/services/taskQueue';
import { WorkflowEngine } from '../src/services/workflowEngine';

// Mock the dependencies
jest.mock('../src/services/agentManager');
jest.mock('../src/services/taskQueue');
jest.mock('../src/services/workflowEngine');

describe('StatisticsService', () => {
    let statisticsService: StatisticsService;
    let mockAgentManager: jest.Mocked<AgentManager>;
    let mockTaskQueue: jest.Mocked<TaskQueueEngine>;
    let mockWorkflowEngine: jest.Mocked<WorkflowEngine>;

    beforeEach(() => {
        mockAgentManager = new AgentManager() as jest.Mocked<AgentManager>;
        mockTaskQueue = new TaskQueueEngine() as jest.Mocked<TaskQueueEngine>;
        mockWorkflowEngine = new WorkflowEngine() as jest.Mocked<WorkflowEngine>;

        // Mock the methods that are called in the constructor
        mockAgentManager.getAllAgents = jest.fn().mockReturnValue([]);
        mockTaskQueue.getTasks = jest.fn().mockReturnValue([]);
        mockTaskQueue.getQueueStats = jest.fn().mockReturnValue({
            pending: 0,
            running: 0,
            completed: 0,
            failed: 0
        });
        mockWorkflowEngine.getWorkflows = jest.fn().mockReturnValue([]);

        statisticsService = new StatisticsService(mockAgentManager, mockTaskQueue, mockWorkflowEngine);
    });

    afterEach(() => {
        statisticsService.destroy();
    });

    describe('groupBy', () => {
        it('should group items by string property and return string keys', () => {
            const testData = [
                { id: '1', type: 'task1', priority: 1 },
                { id: '2', type: 'task2', priority: 2 },
                { id: '3', type: 'task1', priority: 3 }
            ];

            const result = statisticsService.groupBy(testData, 'type');

            expect(result).toEqual([
                { type: 'task1', count: 2 },
                { type: 'task2', count: 1 }
            ]);

            // Verify that the type property is a string
            result.forEach(item => {
                expect(typeof item.type).toBe('string');
                expect(typeof item.count).toBe('number');
            });
        });

        it('should convert numeric properties to strings', () => {
            const testData = [
                { id: '1', priority: 1 },
                { id: '2', priority: 2 },
                { id: '3', priority: 1 }
            ];

            const result = statisticsService.groupBy(testData, 'priority');

            expect(result).toEqual([
                { priority: '1', count: 2 },
                { priority: '2', count: 1 }
            ]);

            // Verify that the priority property is converted to string
            result.forEach(item => {
                expect(typeof item.priority).toBe('string');
                expect(typeof item.count).toBe('number');
            });
        });

        it('should handle empty arrays', () => {
            const testData: Array<{ type: string }> = [];

            const result = statisticsService.groupBy(testData, 'type');

            expect(result).toEqual([]);
        });

        it('should handle boolean properties by converting to strings', () => {
            const testData = [
                { id: '1', active: true },
                { id: '2', active: false },
                { id: '3', active: true }
            ];

            const result = statisticsService.groupBy(testData, 'active');

            expect(result).toEqual([
                { active: 'true', count: 2 },
                { active: 'false', count: 1 }
            ]);

            // Verify that the active property is converted to string
            result.forEach(item => {
                expect(typeof item.active).toBe('string');
                expect(typeof item.count).toBe('number');
            });
        });
    });
});