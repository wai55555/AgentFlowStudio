/**
 * Application Context
 * Provides centralized state management and service integration
 */

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { Agent } from '../types/agent';
import { Task } from '../types/task';
import { Workflow } from '../types/workflow';
import { AppState } from '../types/storage';
import {
    UnifiedStorageManager,
    AgentManager,
    TaskQueueEngine,
    WorkflowEngine,
    ConfigurationManager,
    OpenRouterClient
} from '../services';
import { useErrorHandler } from '../hooks/useErrorHandler';
import { ErrorCategory } from '../services/errorHandler';

// Action types for state management
type AppAction =
    | { type: 'SET_LOADING'; payload: boolean }
    | { type: 'SET_AGENTS'; payload: Agent[] }
    | { type: 'ADD_AGENT'; payload: Agent }
    | { type: 'UPDATE_AGENT'; payload: Agent }
    | { type: 'DELETE_AGENT'; payload: string }
    | { type: 'SET_TASKS'; payload: Task[] }
    | { type: 'ADD_TASK'; payload: Task }
    | { type: 'UPDATE_TASK'; payload: Task }
    | { type: 'DELETE_TASK'; payload: string }
    | { type: 'SET_WORKFLOWS'; payload: Workflow[] }
    | { type: 'ADD_WORKFLOW'; payload: Workflow }
    | { type: 'UPDATE_WORKFLOW'; payload: Workflow }
    | { type: 'DELETE_WORKFLOW'; payload: string }
    | { type: 'SET_ACTIVE_WORKFLOW'; payload: string | undefined }
    | { type: 'SET_VIEW_MODE'; payload: AppState['ui']['viewMode'] }
    | { type: 'SET_SELECTED_AGENT'; payload: string | undefined }
    | { type: 'SET_SELECTED_TASK'; payload: string | undefined }
    | { type: 'UPDATE_SYSTEM_STATUS'; payload: Partial<AppState['systemStatus']> };

// Initial state
const initialState: AppState = {
    agents: [],
    tasks: [],
    workflows: [],
    activeWorkflow: undefined,
    systemStatus: {
        totalTasks: 0,
        runningTasks: 0,
        availableAgents: 0,
        queueLength: 0
    },
    ui: {
        selectedAgent: undefined,
        selectedTask: undefined,
        viewMode: 'dashboard'
    }
};

// State reducer
function appReducer(state: AppState, action: AppAction): AppState {
    switch (action.type) {
        case 'SET_LOADING':
            return state; // Loading handled separately

        case 'SET_AGENTS':
            return { ...state, agents: action.payload };

        case 'ADD_AGENT':
            return { ...state, agents: [...state.agents, action.payload] };

        case 'UPDATE_AGENT':
            return {
                ...state,
                agents: state.agents.map(agent =>
                    agent.id === action.payload.id ? action.payload : agent
                )
            };

        case 'DELETE_AGENT':
            return {
                ...state,
                agents: state.agents.filter(agent => agent.id !== action.payload),
                ui: {
                    ...state.ui,
                    selectedAgent: state.ui.selectedAgent === action.payload ? undefined : state.ui.selectedAgent
                }
            };

        case 'SET_TASKS':
            return { ...state, tasks: action.payload };

        case 'ADD_TASK':
            return { ...state, tasks: [...state.tasks, action.payload] };

        case 'UPDATE_TASK':
            return {
                ...state,
                tasks: state.tasks.map(task =>
                    task.id === action.payload.id ? action.payload : task
                )
            };

        case 'DELETE_TASK':
            return {
                ...state,
                tasks: state.tasks.filter(task => task.id !== action.payload),
                ui: {
                    ...state.ui,
                    selectedTask: state.ui.selectedTask === action.payload ? undefined : state.ui.selectedTask
                }
            };

        case 'SET_WORKFLOWS':
            return { ...state, workflows: action.payload };

        case 'ADD_WORKFLOW':
            return { ...state, workflows: [...state.workflows, action.payload] };

        case 'UPDATE_WORKFLOW':
            return {
                ...state,
                workflows: state.workflows.map(workflow =>
                    workflow.id === action.payload.id ? action.payload : workflow
                )
            };

        case 'DELETE_WORKFLOW':
            return {
                ...state,
                workflows: state.workflows.filter(workflow => workflow.id !== action.payload),
                activeWorkflow: state.activeWorkflow === action.payload ? undefined : state.activeWorkflow
            };

        case 'SET_ACTIVE_WORKFLOW':
            return { ...state, activeWorkflow: action.payload };

        case 'SET_VIEW_MODE':
            return { ...state, ui: { ...state.ui, viewMode: action.payload } };

        case 'SET_SELECTED_AGENT':
            return { ...state, ui: { ...state.ui, selectedAgent: action.payload } };

        case 'SET_SELECTED_TASK':
            return { ...state, ui: { ...state.ui, selectedTask: action.payload } };

        case 'UPDATE_SYSTEM_STATUS':
            return {
                ...state,
                systemStatus: { ...state.systemStatus, ...action.payload }
            };

        default:
            return state;
    }
}

// Service instances (singleton pattern)
let serviceInstances: ServiceInstances | null = null;

// Service instances type
interface ServiceInstances {
    storageManager: UnifiedStorageManager;
    agentManager: AgentManager;
    taskQueue: TaskQueueEngine;
    workflowEngine: WorkflowEngine;
    configurationManager: ConfigurationManager;
    openRouterClient: OpenRouterClient;
}

// Context interface
interface AppContextType {
    state: AppState;
    isLoading: boolean;
    services: ServiceInstances | null;

    // Agent operations
    createAgent: (config: Parameters<AgentManager['createAgent']>[0]) => Promise<Agent>;
    updateAgent: (agent: Agent) => Promise<void>;
    deleteAgent: (agentId: string) => Promise<void>;

    // Task operations
    createTask: (taskData: Omit<Task, 'id' | 'createdAt' | 'retryCount'>) => Promise<Task>;
    updateTask: (task: Task) => Promise<void>;
    deleteTask: (taskId: string) => Promise<void>;

    // Workflow operations
    createWorkflow: (name: string) => Promise<Workflow>;
    updateWorkflow: (workflow: Workflow) => Promise<void>;
    deleteWorkflow: (workflowId: string) => Promise<void>;
    executeWorkflow: (workflowId: string) => Promise<void>;

    // UI operations
    setViewMode: (mode: AppState['ui']['viewMode']) => void;
    setSelectedAgent: (agentId: string | undefined) => void;
    setSelectedTask: (taskId: string | undefined) => void;
    setActiveWorkflow: (workflowId: string | undefined) => void;

    // Configuration operations
    exportConfiguration: () => Promise<string>;
    importConfiguration: (data: string) => Promise<void>;

    // System operations
    refreshData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

// Provider component
interface AppProviderProps {
    children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
    const [state, dispatch] = useReducer(appReducer, initialState);
    const [isLoading, setIsLoading] = React.useState(true);
    const { handleError, logInfo } = useErrorHandler();

    // Initialize services
    useEffect(() => {
        const initializeServices = async () => {
            try {
                setIsLoading(true);
                await logInfo('Initializing AI Agent Orchestration Platform services', ErrorCategory.SYSTEM);

                // Create service instances if not already created
                if (!serviceInstances) {
                    const storageManager = new UnifiedStorageManager();
                    await storageManager.initialize();

                    const agentManager = new AgentManager(storageManager);
                    const taskQueue = new TaskQueueEngine(storageManager, agentManager);
                    const workflowEngine = new WorkflowEngine(storageManager, taskQueue, agentManager);
                    const configurationManager = new ConfigurationManager(storageManager);
                    const openRouterClient = new OpenRouterClient({
                        apiKey: localStorage.getItem('openrouter_api_key') || '', // Read from localStorage
                        baseUrl: 'https://openrouter.ai/api/v1'
                    });

                    serviceInstances = {
                        storageManager,
                        agentManager,
                        taskQueue,
                        workflowEngine,
                        configurationManager,
                        openRouterClient
                    };
                }

                // Load initial data
                await refreshData();

                await logInfo('Services initialized successfully', ErrorCategory.SYSTEM);
            } catch (error) {
                await handleError(
                    error instanceof Error ? error : new Error('Service initialization failed'),
                    ErrorCategory.SYSTEM
                );
            } finally {
                setIsLoading(false);
            }
        };

        initializeServices();
    }, [handleError, logInfo]);

    // Set up real-time system status updates
    useEffect(() => {
        const updateSystemStatus = () => {
            if (!serviceInstances) return;

            const agents = serviceInstances.agentManager.getAllAgents();
            const queueStats = serviceInstances.taskQueue.getQueueStats();

            dispatch({
                type: 'UPDATE_SYSTEM_STATUS',
                payload: {
                    totalTasks: queueStats.total,
                    runningTasks: queueStats.running,
                    availableAgents: agents.filter(a => a.status === 'idle').length,
                    queueLength: queueStats.pending
                }
            });
        };

        const interval = setInterval(updateSystemStatus, 1000);
        return () => clearInterval(interval);
    }, []);

    // Data refresh function
    const refreshData = async () => {
        if (!serviceInstances) return;

        try {
            const [agents, tasks, workflows] = await Promise.all([
                Promise.resolve(serviceInstances.agentManager.getAllAgents()),
                serviceInstances.taskQueue.getTasks(),
                Promise.resolve(serviceInstances.workflowEngine.getWorkflows())
            ]);

            dispatch({ type: 'SET_AGENTS', payload: agents });
            dispatch({ type: 'SET_TASKS', payload: tasks });
            dispatch({ type: 'SET_WORKFLOWS', payload: workflows });
        } catch (error) {
            await handleError(
                error instanceof Error ? error : new Error('Failed to refresh data'),
                ErrorCategory.SYSTEM
            );
        }
    };

    // Agent operations
    const createAgent = async (config: Parameters<AgentManager['createAgent']>[0]): Promise<Agent> => {
        if (!serviceInstances) throw new Error('Services not initialized');

        try {
            const agent = await serviceInstances.agentManager.createAgent(config);
            dispatch({ type: 'ADD_AGENT', payload: agent });
            await logInfo(`Agent created: ${agent.name}`, ErrorCategory.AGENT);
            return agent;
        } catch (error) {
            await handleError(
                error instanceof Error ? error : new Error('Failed to create agent'),
                ErrorCategory.AGENT
            );
            throw error;
        }
    };

    const updateAgent = async (agent: Agent): Promise<void> => {
        if (!serviceInstances) throw new Error('Services not initialized');

        try {
            // Update in service (this will persist to storage)
            serviceInstances.agentManager.updateAgentStatus(agent.id, agent.status);
            dispatch({ type: 'UPDATE_AGENT', payload: agent });
        } catch (error) {
            await handleError(
                error instanceof Error ? error : new Error('Failed to update agent'),
                ErrorCategory.AGENT
            );
            throw error;
        }
    };

    const deleteAgent = async (agentId: string): Promise<void> => {
        if (!serviceInstances) throw new Error('Services not initialized');

        try {
            await serviceInstances.agentManager.deleteAgent(agentId);
            dispatch({ type: 'DELETE_AGENT', payload: agentId });
            await logInfo(`Agent deleted: ${agentId}`, ErrorCategory.AGENT);
        } catch (error) {
            await handleError(
                error instanceof Error ? error : new Error('Failed to delete agent'),
                ErrorCategory.AGENT
            );
            throw error;
        }
    };

    // Task operations
    const createTask = async (taskData: Omit<Task, 'id' | 'createdAt' | 'retryCount'>): Promise<Task> => {
        if (!serviceInstances) throw new Error('Services not initialized');

        try {
            const task: Task = {
                ...taskData,
                id: serviceInstances.taskQueue.generateTaskId(),
                createdAt: new Date(),
                retryCount: 0
            };

            serviceInstances.taskQueue.enqueue(task);
            dispatch({ type: 'ADD_TASK', payload: task });
            await logInfo(`Task created: ${task.id}`, ErrorCategory.TASK);
            return task;
        } catch (error) {
            await handleError(
                error instanceof Error ? error : new Error('Failed to create task'),
                ErrorCategory.TASK
            );
            throw error;
        }
    };

    const updateTask = async (task: Task): Promise<void> => {
        if (!serviceInstances) throw new Error('Services not initialized');

        try {
            serviceInstances.taskQueue.updateTaskStatus(task.id, task.status);
            dispatch({ type: 'UPDATE_TASK', payload: task });
        } catch (error) {
            await handleError(
                error instanceof Error ? error : new Error('Failed to update task'),
                ErrorCategory.TASK
            );
            throw error;
        }
    };

    const deleteTask = async (taskId: string): Promise<void> => {
        if (!serviceInstances) throw new Error('Services not initialized');

        try {
            serviceInstances.taskQueue.removeTask(taskId);
            dispatch({ type: 'DELETE_TASK', payload: taskId });
            await logInfo(`Task deleted: ${taskId}`, ErrorCategory.TASK);
        } catch (error) {
            await handleError(
                error instanceof Error ? error : new Error('Failed to delete task'),
                ErrorCategory.TASK
            );
            throw error;
        }
    };

    // Workflow operations
    const createWorkflow = async (name: string): Promise<Workflow> => {
        if (!serviceInstances) throw new Error('Services not initialized');

        try {
            const workflow = serviceInstances.workflowEngine.createWorkflow(name);
            dispatch({ type: 'ADD_WORKFLOW', payload: workflow });
            await logInfo(`Workflow created: ${workflow.name}`, ErrorCategory.WORKFLOW);
            return workflow;
        } catch (error) {
            await handleError(
                error instanceof Error ? error : new Error('Failed to create workflow'),
                ErrorCategory.WORKFLOW
            );
            throw error;
        }
    };

    const updateWorkflow = async (workflow: Workflow): Promise<void> => {
        if (!serviceInstances) throw new Error('Services not initialized');

        try {
            // The workflow engine doesn't have a direct update method, 
            // but changes are persisted when nodes/connections are modified
            dispatch({ type: 'UPDATE_WORKFLOW', payload: workflow });
        } catch (error) {
            await handleError(
                error instanceof Error ? error : new Error('Failed to update workflow'),
                ErrorCategory.WORKFLOW
            );
            throw error;
        }
    };

    const deleteWorkflow = async (workflowId: string): Promise<void> => {
        if (!serviceInstances) throw new Error('Services not initialized');

        try {
            serviceInstances.workflowEngine.deleteWorkflow(workflowId);
            dispatch({ type: 'DELETE_WORKFLOW', payload: workflowId });
            await logInfo(`Workflow deleted: ${workflowId}`, ErrorCategory.WORKFLOW);
        } catch (error) {
            await handleError(
                error instanceof Error ? error : new Error('Failed to delete workflow'),
                ErrorCategory.WORKFLOW
            );
            throw error;
        }
    };

    const executeWorkflow = async (workflowId: string): Promise<void> => {
        if (!serviceInstances) throw new Error('Services not initialized');

        try {
            await serviceInstances.workflowEngine.executeWorkflow(workflowId);
            await logInfo(`Workflow executed: ${workflowId}`, ErrorCategory.WORKFLOW);

            // Refresh workflows to get updated status
            const workflows = serviceInstances.workflowEngine.getWorkflows();
            dispatch({ type: 'SET_WORKFLOWS', payload: workflows });
        } catch (error) {
            await handleError(
                error instanceof Error ? error : new Error('Failed to execute workflow'),
                ErrorCategory.WORKFLOW
            );
            throw error;
        }
    };

    // UI operations
    const setViewMode = (mode: AppState['ui']['viewMode']) => {
        dispatch({ type: 'SET_VIEW_MODE', payload: mode });
    };

    const setSelectedAgent = (agentId: string | undefined) => {
        dispatch({ type: 'SET_SELECTED_AGENT', payload: agentId });
    };

    const setSelectedTask = (taskId: string | undefined) => {
        dispatch({ type: 'SET_SELECTED_TASK', payload: taskId });
    };

    const setActiveWorkflow = (workflowId: string | undefined) => {
        dispatch({ type: 'SET_ACTIVE_WORKFLOW', payload: workflowId });
    };

    // Configuration operations
    const exportConfiguration = async (): Promise<string> => {
        if (!serviceInstances) throw new Error('Services not initialized');

        try {
            const configData = await serviceInstances.configurationManager.exportConfiguration();
            await logInfo('Configuration exported successfully', ErrorCategory.SYSTEM);
            return configData;
        } catch (error) {
            await handleError(
                error instanceof Error ? error : new Error('Failed to export configuration'),
                ErrorCategory.SYSTEM
            );
            throw error;
        }
    };

    const importConfiguration = async (data: string): Promise<void> => {
        if (!serviceInstances) throw new Error('Services not initialized');

        try {
            await serviceInstances.configurationManager.importConfiguration(data);
            await refreshData();
            await logInfo('Configuration imported successfully', ErrorCategory.SYSTEM);
        } catch (error) {
            await handleError(
                error instanceof Error ? error : new Error('Failed to import configuration'),
                ErrorCategory.SYSTEM
            );
            throw error;
        }
    };

    const contextValue: AppContextType = {
        state,
        isLoading,
        services: serviceInstances,

        // Agent operations
        createAgent,
        updateAgent,
        deleteAgent,

        // Task operations
        createTask,
        updateTask,
        deleteTask,

        // Workflow operations
        createWorkflow,
        updateWorkflow,
        deleteWorkflow,
        executeWorkflow,

        // UI operations
        setViewMode,
        setSelectedAgent,
        setSelectedTask,
        setActiveWorkflow,

        // Configuration operations
        exportConfiguration,
        importConfiguration,

        // System operations
        refreshData
    };

    return (
        <AppContext.Provider value={contextValue}>
            {children}
        </AppContext.Provider>
    );
};

// Hook to use the app context
export const useApp = (): AppContextType => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useApp must be used within an AppProvider');
    }
    return context;
};

export default AppContext;