/**
 * Storage interfaces for LocalStorage and IndexedDB operations
 */

import type { Agent } from './agent';
import type { Task } from './task';
import type { Workflow } from './workflow';

export interface SystemSettings {
    maxAgents: number;
    defaultModel: string;
    apiTimeout: number;
    autoSaveInterval: number;
    theme: 'light' | 'dark';
}

export interface UsageStatistics {
    totalTasksExecuted: number;
    totalAgentsCreated: number;
    totalWorkflowsRun: number;
    averageTaskDuration: number;
    lastActiveDate: Date;
}

export interface AppState {
    agents: Agent[];
    tasks: Task[];
    workflows: Workflow[];
    activeWorkflow?: string;
    systemStatus: {
        totalTasks: number;
        runningTasks: number;
        availableAgents: number;
        queueLength: number;
    };
    ui: {
        selectedAgent?: string;
        selectedTask?: string;
        viewMode: 'dashboard' | 'agents' | 'workflows' | 'monitor';
    };
}

export interface StorageManager {
    saveAgents(agents: Agent[]): Promise<void>;
    loadAgents(): Promise<Agent[]>;
    saveWorkflows(workflows: Workflow[]): Promise<void>;
    loadWorkflows(): Promise<Workflow[]>;
    saveSettings(settings: SystemSettings): Promise<void>;
    loadSettings(): Promise<SystemSettings>;
    exportConfiguration(): Promise<string>;
    importConfiguration(data: string): Promise<void>;
}