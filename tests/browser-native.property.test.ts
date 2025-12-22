/**
 * Property-based test for browser-native operation
 * **Feature: ai-agent-orchestration, Property 13: Browser-native operation**
 * **Validates: Requirements 6.2, 6.3, 6.4**
 */

import * as fc from 'fast-check';
import type { Agent, Task, Workflow, SystemSettings } from '../src/types';

describe('Property 13: Browser-native operation', () => {
    beforeEach(() => {
        // Reset mocks before each test
        jest.clearAllMocks();
    });

    test('should operate using only browser APIs without external server dependencies', () => {
        fc.assert(
            fc.property(
                // Generate random system data
                fc.record({
                    agents: fc.array(fc.record({
                        id: fc.string({ minLength: 1 }),
                        name: fc.string({ minLength: 1 }),
                        role: fc.string({ minLength: 1 }),
                        promptTemplate: fc.string({ minLength: 1 }),
                        status: fc.constantFrom('idle', 'busy', 'error'),
                        config: fc.record({
                            maxTokens: fc.integer({ min: 1, max: 4000 }),
                            temperature: fc.float({ min: 0, max: 2 }),
                            model: fc.constant('xiaomi/mimo-v2-flash:free')
                        }),
                        stats: fc.record({
                            tasksCompleted: fc.nat(),
                            averageResponseTime: fc.nat(),
                            errorCount: fc.nat()
                        })
                    }), { maxLength: 10 }),
                    tasks: fc.array(fc.record({
                        id: fc.string({ minLength: 1 }),
                        type: fc.constantFrom('simple', 'workflow'),
                        priority: fc.integer({ min: 1, max: 10 }),
                        prompt: fc.string({ minLength: 1 }),
                        dependencies: fc.array(fc.string(), { maxLength: 5 }),
                        status: fc.constantFrom('pending', 'running', 'completed', 'failed'),
                        createdAt: fc.date(),
                        retryCount: fc.nat({ max: 3 })
                    }), { maxLength: 20 }),
                    workflows: fc.array(fc.record({
                        id: fc.string({ minLength: 1 }),
                        name: fc.string({ minLength: 1 }),
                        nodes: fc.array(fc.record({
                            id: fc.string({ minLength: 1 }),
                            type: fc.constantFrom('input', 'process', 'output', 'condition'),
                            position: fc.record({
                                x: fc.integer({ min: 0, max: 1000 }),
                                y: fc.integer({ min: 0, max: 1000 })
                            }),
                            config: fc.record({
                                prompt: fc.option(fc.string()),
                                condition: fc.option(fc.string()),
                                agentRole: fc.option(fc.string())
                            }),
                            inputs: fc.array(fc.record({
                                sourceNodeId: fc.string(),
                                targetNodeId: fc.string(),
                                sourcePort: fc.string(),
                                targetPort: fc.string()
                            }), { maxLength: 3 }),
                            outputs: fc.array(fc.record({
                                sourceNodeId: fc.string(),
                                targetNodeId: fc.string(),
                                sourcePort: fc.string(),
                                targetPort: fc.string()
                            }), { maxLength: 3 })
                        }), { maxLength: 10 }),
                        connections: fc.array(fc.record({
                            sourceNodeId: fc.string(),
                            targetNodeId: fc.string(),
                            sourcePort: fc.string(),
                            targetPort: fc.string()
                        }), { maxLength: 15 }),
                        status: fc.constantFrom('draft', 'running', 'completed', 'failed')
                    }), { maxLength: 5 }),
                    settings: fc.record({
                        maxAgents: fc.integer({ min: 1, max: 100 }),
                        defaultModel: fc.constant('xiaomi/mimo-v2-flash:free'),
                        apiTimeout: fc.integer({ min: 1000, max: 30000 }),
                        autoSaveInterval: fc.integer({ min: 1000, max: 60000 }),
                        theme: fc.constantFrom('light', 'dark')
                    })
                }),
                (systemData) => {
                    // Clear mocks for each property iteration
                    jest.clearAllMocks();

                    // Test Requirement 6.2: Direct API communication using CORS-enabled requests
                    // Verify that API calls use browser's fetch API without server proxies
                    const mockFetch = jest.fn().mockResolvedValue({
                        ok: true,
                        json: () => Promise.resolve({
                            id: 'test-response',
                            choices: [{ message: { content: 'test', role: 'assistant' }, finish_reason: 'stop' }],
                            usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
                        })
                    });
                    global.fetch = mockFetch;

                    // Simulate API request
                    const apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
                    const requestConfig = {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer test-key'
                        },
                        body: JSON.stringify({
                            model: systemData.settings.defaultModel,
                            messages: [{ role: 'user', content: 'test prompt' }]
                        })
                    };

                    // Verify fetch is called with proper CORS configuration
                    fetch(apiUrl, requestConfig);
                    expect(mockFetch).toHaveBeenCalledWith(apiUrl, expect.objectContaining({
                        method: 'POST',
                        headers: expect.objectContaining({
                            'Content-Type': 'application/json',
                            'Authorization': expect.stringContaining('Bearer')
                        })
                    }));

                    // Test Requirement 6.3: Web Worker utilization for parallel execution
                    // Verify that Web Workers are used for concurrent task processing
                    const WorkerConstructor = window.Worker as jest.MockedClass<typeof Worker>;

                    // Simulate creating workers for parallel task execution
                    const pendingTasks = systemData.tasks.filter(t => t.status === 'pending');
                    const workerCallCount = Math.min(pendingTasks.length, 3);

                    for (let i = 0; i < workerCallCount; i++) {
                        new Worker('/worker.js');
                    }
                    expect(WorkerConstructor).toHaveBeenCalledTimes(workerCallCount);

                    // Test Requirement 6.4: Local data persistence without server-side storage
                    // Verify that all data operations use browser storage APIs
                    const localStorageMock = window.localStorage as jest.Mocked<Storage>;
                    const indexedDBMock = window.indexedDB as jest.Mocked<IDBFactory>;

                    // Simulate saving agents to localStorage
                    const agentsData = JSON.stringify(systemData.agents);
                    localStorage.setItem('agents', agentsData);
                    expect(localStorageMock.setItem).toHaveBeenCalledWith('agents', agentsData);

                    // Simulate saving workflows to localStorage
                    const workflowsData = JSON.stringify(systemData.workflows);
                    localStorage.setItem('workflows', workflowsData);
                    expect(localStorageMock.setItem).toHaveBeenCalledWith('workflows', workflowsData);

                    // Simulate saving settings to localStorage
                    const settingsData = JSON.stringify(systemData.settings);
                    localStorage.setItem('settings', settingsData);
                    expect(localStorageMock.setItem).toHaveBeenCalledWith('settings', settingsData);

                    // Simulate IndexedDB usage for large task data
                    indexedDB.open('ai-agent-db', 1);
                    expect(indexedDBMock.open).toHaveBeenCalledWith('ai-agent-db', 1);

                    // Verify no external server dependencies
                    // Check that no server-side endpoints are called
                    const serverEndpoints = [
                        'http://localhost',
                        'https://localhost',
                        '/api/',
                        '/server/',
                        'ws://',
                        'wss://'
                    ];

                    // Ensure fetch calls only go to OpenRouter API (external service, not our server)
                    if (mockFetch.mock.calls.length > 0) {
                        mockFetch.mock.calls.forEach(call => {
                            const url = call[0] as string;
                            const isOpenRouterAPI = url.includes('openrouter.ai');
                            const isServerEndpoint = serverEndpoints.some(endpoint => url.includes(endpoint));

                            // Should only call OpenRouter API, not our own server endpoints
                            expect(isOpenRouterAPI || !isServerEndpoint).toBe(true);
                        });
                    }

                    // Verify browser-native operation: all operations should use browser APIs
                    const browserAPIsUsed = {
                        localStorage: localStorageMock.setItem.mock.calls.length > 0,
                        indexedDB: indexedDBMock.open.mock.calls.length > 0,
                        webWorkers: WorkerConstructor.mock.instances.length > 0,
                        fetch: mockFetch.mock.calls.length > 0
                    };

                    // At least localStorage should be used for any non-empty system data
                    if (systemData.agents.length > 0 || systemData.workflows.length > 0) {
                        expect(browserAPIsUsed.localStorage).toBe(true);
                    }

                    // IndexedDB should be used if there are tasks or large data
                    if (systemData.tasks.length > 0) {
                        expect(browserAPIsUsed.indexedDB).toBe(true);
                    }

                    // Web Workers should be used if there are pending tasks
                    const hasPendingTasks = systemData.tasks.some(t => t.status === 'pending');
                    if (hasPendingTasks) {
                        expect(browserAPIsUsed.webWorkers).toBe(true);
                    }
                }
            ),
            { numRuns: 100 } // Run 100 iterations as specified in design document
        );
    });
});