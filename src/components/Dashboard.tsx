import React, { useEffect, useCallback } from 'react';
import { useApp } from '../contexts/AppContext';
import AgentDashboard from './AgentDashboard';
import TaskMonitor from './TaskMonitor';
import WorkflowEditor from './WorkflowEditor';
import SystemMonitor from './SystemMonitor';
import SettingsPanel from './SettingsPanel';
import './Dashboard.css';

const Dashboard: React.FC = () => {
    const {
        state,
        services,
        setViewMode,
        updateAgent,
        createAgent,
        deleteAgent,
        createTask,
        updateTask,
        deleteTask,
        createWorkflow,
        updateWorkflow,
        deleteWorkflow,
        executeWorkflow,
        setActiveWorkflow,
        setWorkflows
    } = useApp();

    // Keyboard shortcuts
    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        // Only handle shortcuts when not in input fields
        if (event.target instanceof HTMLInputElement ||
            event.target instanceof HTMLTextAreaElement ||
            event.target instanceof HTMLSelectElement) {
            return;
        }

        // Alt + number keys for navigation
        if (event.altKey && !event.ctrlKey && !event.shiftKey) {
            switch (event.key) {
                case '1':
                    event.preventDefault();
                    setViewMode('dashboard');
                    break;
                case '2':
                    event.preventDefault();
                    setViewMode('agents');
                    break;
                case '3':
                    event.preventDefault();
                    setViewMode('workflows');
                    break;
                case '4':
                    event.preventDefault();
                    setViewMode('monitor');
                    break;
            }
        }

        // Escape key to close modals or return to dashboard
        if (event.key === 'Escape') {
            setViewMode('dashboard');
        }
    }, [setViewMode]);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleKeyDown]);

    const handleViewModeChange = (viewMode: typeof state.ui.viewMode) => {
        setViewMode(viewMode);
    };

    const handleAgentUpdate = async (/* agents: typeof state.agents */) => {
        // This is handled through individual agent operations now
        // The context manages the state updates
    };

    const handleTaskUpdate = async (/* tasks: typeof state.tasks */) => {
        // This is handled through individual task operations now
        // The context manages the state updates
    };

    const handleWorkflowUpdate = async (workflows: typeof state.workflows) => {
        console.log('[Dashboard] handleWorkflowUpdate called with workflows count:', workflows.length);
        try {
            // AppContextのdispatchを使用してワークフローを更新
            // SET_WORKFLOWSアクションを呼ぶ
            if (services && services.storageManager) {
                // ワークフローをストレージに保存
                await services.storageManager.saveWorkflows(workflows);
                console.log('[Dashboard] Workflows saved successfully');
            }
            // React状態を更新
            await setWorkflows(workflows);
            console.log('[Dashboard] React state updated with new workflows');
        } catch (error) {
            console.error('[Dashboard] Error updating workflows:', error);
        }
    };

    return (
        <div className="dashboard" role="main">
            {/* Skip link for accessibility */}
            <a href="#main-content" className="skip-link">
                Skip to main content
            </a>

            <nav className="dashboard-nav" role="navigation" aria-label="Main navigation">
                <button
                    className={`nav-button ${state.ui.viewMode === 'dashboard' ? 'active' : ''}`}
                    onClick={() => handleViewModeChange('dashboard')}
                    aria-pressed={state.ui.viewMode === 'dashboard'}
                    title="Dashboard (Alt+1)"
                >
                    <span className="nav-icon" aria-hidden="true">📊</span>
                    <span className="nav-text">Dashboard</span>
                    <span className="nav-shortcut" aria-hidden="true">Alt+1</span>
                </button>
                <button
                    className={`nav-button ${state.ui.viewMode === 'agents' ? 'active' : ''}`}
                    onClick={() => handleViewModeChange('agents')}
                    aria-pressed={state.ui.viewMode === 'agents'}
                    title="Agents (Alt+2)"
                >
                    <span className="nav-icon" aria-hidden="true">🤖</span>
                    <span className="nav-text">Agents</span>
                    <span className="nav-shortcut" aria-hidden="true">Alt+2</span>
                </button>
                <button
                    className={`nav-button ${state.ui.viewMode === 'workflows' ? 'active' : ''}`}
                    onClick={() => handleViewModeChange('workflows')}
                    aria-pressed={state.ui.viewMode === 'workflows'}
                    title="Workflows (Alt+3)"
                >
                    <span className="nav-icon" aria-hidden="true">🔄</span>
                    <span className="nav-text">Workflows</span>
                    <span className="nav-shortcut" aria-hidden="true">Alt+3</span>
                </button>
                <button
                    className={`nav-button ${state.ui.viewMode === 'monitor' ? 'active' : ''}`}
                    onClick={() => handleViewModeChange('monitor')}
                    aria-pressed={state.ui.viewMode === 'monitor'}
                    title="Monitor (Alt+4)"
                >
                    <span className="nav-icon" aria-hidden="true">📈</span>
                    <span className="nav-text">Monitor</span>
                    <span className="nav-shortcut" aria-hidden="true">Alt+4</span>
                </button>
            </nav>

            <div id="main-content" className="dashboard-content" role="main">
                {state.ui.viewMode === 'dashboard' && (
                    <SystemMonitor
                        systemStatus={state.systemStatus}
                        agents={state.agents}
                        tasks={state.tasks}
                        workflows={state.workflows}
                    />
                )}

                {state.ui.viewMode === 'agents' && (
                    <AgentDashboard
                        agents={state.agents}
                        onAgentsUpdate={handleAgentUpdate}
                        selectedAgent={state.ui.selectedAgent}
                        onCreateAgent={createAgent}
                        onUpdateAgent={updateAgent}
                        onDeleteAgent={deleteAgent}
                    />
                )}

                {state.ui.viewMode === 'workflows' && (
                    <WorkflowEditor
                        workflows={state.workflows}
                        onWorkflowsUpdate={handleWorkflowUpdate}
                        activeWorkflow={state.activeWorkflow}
                        onCreateWorkflow={createWorkflow}
                        onUpdateWorkflow={updateWorkflow}
                        onDeleteWorkflow={deleteWorkflow}
                        onExecuteWorkflow={executeWorkflow}
                        onSetActiveWorkflow={setActiveWorkflow}
                    />
                )}

                {state.ui.viewMode === 'monitor' && (
                    <TaskMonitor
                        tasks={state.tasks}
                        agents={state.agents}
                        onTasksUpdate={handleTaskUpdate}
                        onCreateTask={createTask}
                        onUpdateTask={updateTask}
                        onDeleteTask={deleteTask}
                    />
                )}
            </div>

            <SettingsPanel />
        </div>
    );
};

export default Dashboard;