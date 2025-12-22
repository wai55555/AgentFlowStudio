/**
 * Property-based test for export data completeness
 * **Feature: ai-agent-orchestration, Property 12: Export data completeness**
 * **Validates: Requirements 5.5**
 * 
 * Property: For any configuration export, the generated JSON should contain all agents, workflows, and system settings
 */

import * as fc from 'fast-check';
import { ConfigurationManager } from '../src/services/configurationManager';
import { LocalStorageManager } from '../src/services/localStorage';
import type { Agent, Workflow, SystemSettings, /* UsageStatistics */ } from '../src/types';

// Mock storage manager that only uses LocalStorage
class MockStorageManager {
    private localStorageManager: LocalStorageManager;

    constructor() {
        this.localStorageManager = new LocalStorageManager();
    }

    async initialize(): Promise<void> {
        // No-op for mock
    }

    async saveAgents(agents: Agent[]): Promise<void> {
        await this.localStorageManager.saveAgents(agents);
    }

    async loadAgents(): Promise<Agent[]> {
        return this.localStorageManager.loadAgents();
    }

    async saveWorkflows(workflows: Workflow[]): Promise<void> {
        await this.localStorageManager.saveWorkflows(workflows);
    }

    async loadWorkflows(): Promise<Workflow[]> {
        return this.localStorageManager.loadWorkflows();
    }

    async saveSettings(settings: SystemSettings): Promise<void> {
        await this.localStorageManager.saveSettings(settings);
    }

    async loadSettings(): Promise<SystemSettings> {
        return this.localStorageManager.loadSettings();
    }
}

// Generators for property-based testing
const agentConfigArb = fc.record({
    maxTokens: fc.integer({ min: 1, max: 4000 }),
    temperature: fc.float({ min: 0, max: 2, noNaN: true }),
    model: fc.constant('xiaomi/mimo-v2-flash:free')
});

const agentStatsArb = fc.record({
    tasksCompleted: fc.nat(),
    averageResponseTime: fc.nat(),
    errorCount: fc.nat()
});

const agentArb = fc.record({
    id: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
    name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
    role: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
    promptTemplate: fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
    status: fc.constantFrom('idle', 'busy', 'error'),
    config: agentConfigArb,
    stats: agentStatsArb
});

const positionArb = fc.record({
    x: fc.integer({ min: 0, max: 1000 }),
    y: fc.integer({ min: 0, max: 1000 })
});

const nodeConfigArb = fc.record({
    prompt: fc.option(fc.string({ maxLength: 500 })),
    condition: fc.option(fc.string({ maxLength: 200 })),
    agentRole: fc.option(fc.string({ maxLength: 100 }))
});

const connectionArb = fc.record({
    sourceNodeId: fc.string({ minLength: 1, maxLength: 50 }),
    targetNodeId: fc.string({ minLength: 1, maxLength: 50 }),
    sourcePort: fc.string({ minLength: 1, maxLength: 20 }),
    targetPort: fc.string({ minLength: 1, maxLength: 20 })
});

const workflowNodeArb = fc.record({
    id: fc.string({ minLength: 1, maxLength: 50 }),
    type: fc.constantFrom('input', 'process', 'output', 'condition'),
    position: positionArb,
    config: nodeConfigArb,
    inputs: fc.array(connectionArb, { maxLength: 5 }),
    outputs: fc.array(connectionArb, { maxLength: 5 })
});

const workflowArb = fc.record({
    id: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
    name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
    nodes: fc.array(workflowNodeArb, { maxLength: 10 }),
    connections: fc.array(connectionArb, { maxLength: 20 }),
    status: fc.constantFrom('draft', 'running', 'completed', 'failed')
});

const systemSettingsArb = fc.record({
    maxAgents: fc.integer({ min: 1, max: 100 }),
    defaultModel: fc.constant('xiaomi/mimo-v2-flash:free'),
    apiTimeout: fc.integer({ min: 1000, max: 120000 }),
    autoSaveInterval: fc.integer({ min: 10000, max: 300000 }),
    theme: fc.constantFrom('light', 'dark')
});

const usageStatsArb = fc.record({
    totalTasksExecuted: fc.nat(),
    totalAgentsCreated: fc.nat(),
    totalWorkflowsRun: fc.nat(),
    averageTaskDuration: fc.nat(),
    lastActiveDate: fc.date()
});

describe('Property 12: Export data completeness', () => {
    let configManager: ConfigurationManager;
    let storageManager: MockStorageManager;

    beforeEach(async () => {
        localStorage.clear();
        storageManager = new MockStorageManager();
        await storageManager.initialize();
        configManager = new ConfigurationManager(storageManager as any);
    });

    afterEach(() => {
        localStorage.clear();
    });

    test('should include all agents, workflows, and system settings in export', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(agentArb, { maxLength: 10 }),
                fc.array(workflowArb, { maxLength: 5 }),
                systemSettingsArb,
                usageStatsArb,
                async (agents, workflows, settings, usageStats) => {
                    // Save all data to storage
                    await storageManager.saveAgents(agents);
                    await storageManager.saveWorkflows(workflows);
                    await storageManager.saveSettings(settings);

                    // Save usage stats directly to localStorage
                    const localStorage = (storageManager as any).localStorageManager;
                    await localStorage.saveUsageStats(usageStats);

                    // Export configuration
                    const exportedJson = await configManager.exportConfiguration();
                    const exportedData = JSON.parse(exportedJson);

                    // Verify all agents are included
                    expect(exportedData.agents).toBeDefined();
                    expect(Array.isArray(exportedData.agents)).toBe(true);
                    expect(exportedData.agents).toHaveLength(agents.length);

                    // Verify agent data completeness
                    agents.forEach((originalAgent, index) => {
                        const exportedAgent = exportedData.agents[index];
                        expect(exportedAgent.id).toBe(originalAgent.id);
                        expect(exportedAgent.name).toBe(originalAgent.name);
                        expect(exportedAgent.role).toBe(originalAgent.role);
                        expect(exportedAgent.promptTemplate).toBe(originalAgent.promptTemplate);
                        expect(exportedAgent.status).toBe(originalAgent.status);
                        expect(exportedAgent.config).toEqual(originalAgent.config);
                        expect(exportedAgent.stats).toEqual(originalAgent.stats);
                    });

                    // Verify all workflows are included
                    expect(exportedData.workflows).toBeDefined();
                    expect(Array.isArray(exportedData.workflows)).toBe(true);
                    expect(exportedData.workflows).toHaveLength(workflows.length);

                    // Verify workflow data completeness
                    workflows.forEach((originalWorkflow, index) => {
                        const exportedWorkflow = exportedData.workflows[index];
                        expect(exportedWorkflow.id).toBe(originalWorkflow.id);
                        expect(exportedWorkflow.name).toBe(originalWorkflow.name);
                        expect(exportedWorkflow.nodes).toEqual(originalWorkflow.nodes);
                        expect(exportedWorkflow.connections).toEqual(originalWorkflow.connections);
                        expect(exportedWorkflow.status).toBe(originalWorkflow.status);
                    });

                    // Verify system settings are included
                    expect(exportedData.settings).toBeDefined();
                    expect(exportedData.settings.maxAgents).toBe(settings.maxAgents);
                    expect(exportedData.settings.defaultModel).toBe(settings.defaultModel);
                    expect(exportedData.settings.apiTimeout).toBe(settings.apiTimeout);
                    expect(exportedData.settings.autoSaveInterval).toBe(settings.autoSaveInterval);
                    expect(exportedData.settings.theme).toBe(settings.theme);

                    // Verify usage statistics are included
                    expect(exportedData.usageStats).toBeDefined();
                    expect(exportedData.usageStats.totalTasksExecuted).toBe(usageStats.totalTasksExecuted);
                    expect(exportedData.usageStats.totalAgentsCreated).toBe(usageStats.totalAgentsCreated);
                    expect(exportedData.usageStats.totalWorkflowsRun).toBe(usageStats.totalWorkflowsRun);
                    expect(exportedData.usageStats.averageTaskDuration).toBe(usageStats.averageTaskDuration);

                    // Verify metadata is included
                    expect(exportedData.version).toBeDefined();
                    expect(exportedData.exportedAt).toBeDefined();
                    expect(exportedData.checksum).toBeDefined();

                    // Verify the exported JSON is valid and parseable
                    expect(() => JSON.parse(exportedJson)).not.toThrow();
                }
            ),
            { numRuns: 100 }
        );
    });

    test('should export empty collections when no data exists', async () => {
        // Test with empty data
        const exportedJson = await configManager.exportConfiguration();
        const exportedData = JSON.parse(exportedJson);

        // Should still include all required sections, even if empty
        expect(exportedData.agents).toBeDefined();
        expect(Array.isArray(exportedData.agents)).toBe(true);
        expect(exportedData.agents).toHaveLength(0);

        expect(exportedData.workflows).toBeDefined();
        expect(Array.isArray(exportedData.workflows)).toBe(true);
        expect(exportedData.workflows).toHaveLength(0);

        expect(exportedData.settings).toBeDefined();
        expect(exportedData.usageStats).toBeDefined();
        expect(exportedData.version).toBeDefined();
        expect(exportedData.exportedAt).toBeDefined();
    });

    test('should maintain data integrity across export-import cycle', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(agentArb, { minLength: 1, maxLength: 5 }),
                fc.array(workflowArb, { minLength: 1, maxLength: 3 }),
                systemSettingsArb,
                async (agents, workflows, settings) => {
                    // Save original data
                    await storageManager.saveAgents(agents);
                    await storageManager.saveWorkflows(workflows);
                    await storageManager.saveSettings(settings);

                    // Export and then import
                    const exportedJson = await configManager.exportConfiguration();

                    // Clear storage
                    localStorage.clear();

                    // Import the exported data
                    await configManager.importConfiguration(exportedJson);

                    // Verify data was restored completely
                    const restoredAgents = await storageManager.loadAgents();
                    const restoredWorkflows = await storageManager.loadWorkflows();
                    const restoredSettings = await storageManager.loadSettings();

                    expect(restoredAgents).toEqual(agents);
                    expect(restoredWorkflows).toEqual(workflows);
                    expect(restoredSettings).toEqual(settings);
                }
            ),
            { numRuns: 50 }
        );
    });
});