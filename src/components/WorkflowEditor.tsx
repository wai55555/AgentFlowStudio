import React, { useState } from 'react';
import { Workflow } from '../types/workflow';
import WorkflowCanvas from './WorkflowCanvas';
import WorkflowList from './WorkflowList';
import WorkflowTemplateModal from './WorkflowTemplateModal';
import { useApp } from '../contexts/AppContext';
import './WorkflowEditor.css';

interface WorkflowEditorProps {
    workflows: Workflow[];
    onWorkflowsUpdate: (workflows: Workflow[]) => void;
    activeWorkflow?: string;
    onCreateWorkflow: (name: string) => Promise<Workflow>;
    onUpdateWorkflow: (workflow: Workflow) => Promise<void>;
    onDeleteWorkflow: (workflowId: string) => Promise<void>;
    onExecuteWorkflow: (workflowId: string) => Promise<void>;
    onSetActiveWorkflow: (workflowId: string | undefined) => void;
}

const WorkflowEditor: React.FC<WorkflowEditorProps> = ({
    workflows,
    onWorkflowsUpdate,
    activeWorkflow,
    onCreateWorkflow,
    onUpdateWorkflow,
    onDeleteWorkflow,
    // onExecuteWorkflow,
    onSetActiveWorkflow
}) => {
    const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(activeWorkflow || null);
    const [viewMode, setViewMode] = useState<'list' | 'editor'>('list');
    const [isCreating, setIsCreating] = useState(false);
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const { setWorkflows } = useApp();

    console.log('[WorkflowEditor] Component rendered, showTemplateModal:', showTemplateModal);

    const handleCreateFromTemplate = async (workflow: Workflow) => {
        console.log('[WorkflowEditor] handleCreateFromTemplate called with workflow:', workflow);

        try {
            // ワークフローが有効かチェック
            if (!workflow || !workflow.id || !workflow.name) {
                throw new Error('無効なワークフローデータです');
            }

            console.log('[WorkflowEditor] Creating workflow via setWorkflows');

            // 既存のワークフローIDと重複していないかチェック
            const existingWorkflow = workflows.find(w => w.id === workflow.id);
            if (existingWorkflow) {
                console.warn('[WorkflowEditor] Workflow ID already exists, generating new ID');
                workflow.id = `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            }

            console.log('[WorkflowEditor] Adding workflow to list, current count:', workflows.length);

            // ワークフローリストを更新（AppContextのsetWorkflowsを使用）
            const updatedWorkflows = [...workflows, workflow];
            await setWorkflows(updatedWorkflows);

            console.log('[WorkflowEditor] Workflow list updated, new count:', updatedWorkflows.length);

            // 状態を更新
            setSelectedWorkflow(workflow.id);
            setViewMode('editor');
            onSetActiveWorkflow(workflow.id);

            console.log('[WorkflowEditor] State updated - selectedWorkflow:', workflow.id, 'viewMode: editor');
            console.log('[WorkflowEditor] Template workflow created successfully:', workflow.name);

        } catch (error) {
            console.error('[WorkflowEditor] Error in handleCreateFromTemplate:', error);
            alert(`ワークフローの作成に失敗しました: ${(error as Error).message}`);
        }
    };

    const handleCreateWorkflow = async () => {
        try {
            setIsCreating(true);
            const newWorkflow = await onCreateWorkflow(`New Workflow ${workflows.length + 1}`);
            setSelectedWorkflow(newWorkflow.id);
            setViewMode('editor');
            onSetActiveWorkflow(newWorkflow.id);
        } catch (error) {
            console.error('Failed to create workflow:', error);
            // Error handling is managed by the context
        } finally {
            setIsCreating(false);
        }
    };

    const handleSelectWorkflow = (workflowId: string) => {
        setSelectedWorkflow(workflowId);
        setViewMode('editor');
        onSetActiveWorkflow(workflowId);
    };

    const handleUpdateWorkflow = async (updatedWorkflow: Workflow) => {
        try {
            await onUpdateWorkflow(updatedWorkflow);
        } catch (error) {
            console.error('Failed to update workflow:', error);
            // Error handling is managed by the context
        }
    };

    const handleDeleteWorkflow = async (workflowId: string) => {
        if (confirm('Are you sure you want to delete this workflow?')) {
            try {
                await onDeleteWorkflow(workflowId);
                if (selectedWorkflow === workflowId) {
                    setSelectedWorkflow(null);
                    setViewMode('list');
                    onSetActiveWorkflow(undefined);
                }
            } catch (error) {
                console.error('Failed to delete workflow:', error);
                // Error handling is managed by the context
            }
        }
    };

    const handleDuplicateWorkflow = (workflowId: string) => {
        const originalWorkflow = workflows.find(w => w.id === workflowId);
        if (originalWorkflow) {
            const duplicatedWorkflow: Workflow = {
                ...originalWorkflow,
                id: `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                name: `${originalWorkflow.name} (Copy)`,
                status: 'draft'
            };
            onWorkflowsUpdate([...workflows, duplicatedWorkflow]);
        }
    };

    const getStatusCounts = () => {
        return {
            total: workflows.length,
            draft: workflows.filter(w => w.status === 'draft').length,
            running: workflows.filter(w => w.status === 'running').length,
            completed: workflows.filter(w => w.status === 'completed').length,
            failed: workflows.filter(w => w.status === 'failed').length
        };
    };

    const currentWorkflow = selectedWorkflow ?
        workflows.find(w => w.id === selectedWorkflow) : null;
    const statusCounts = getStatusCounts();

    // デバッグログ
    console.log('[WorkflowEditor] Render state:', {
        viewMode,
        selectedWorkflow,
        workflowsCount: workflows.length,
        currentWorkflow: !!currentWorkflow,
        showTemplateModal
    });

    return (
        <div className="workflow-editor">
            <div className="workflow-editor-header">
                <div className="header-left">
                    <h2>Workflow Editor</h2>
                    <div className="workflow-stats">
                        <div className="stat-item">
                            <span className="stat-value">{statusCounts.total}</span>
                            <span className="stat-label">Total</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-value draft">{statusCounts.draft}</span>
                            <span className="stat-label">Draft</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-value running">{statusCounts.running}</span>
                            <span className="stat-label">Running</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-value completed">{statusCounts.completed}</span>
                            <span className="stat-label">Completed</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-value failed">{statusCounts.failed}</span>
                            <span className="stat-label">Failed</span>
                        </div>
                    </div>
                </div>
                <div className="header-actions">
                    <button
                        className={`view-toggle ${viewMode === 'list' ? 'active' : ''}`}
                        onClick={() => setViewMode('list')}
                    >
                        📋 List
                    </button>
                    <button
                        className={`view-toggle ${viewMode === 'editor' ? 'active' : ''}`}
                        onClick={() => setViewMode('editor')}
                        disabled={!selectedWorkflow}
                    >
                        ✏️ Editor
                    </button>
                    <button
                        className="template-btn"
                        onClick={() => {
                            console.log('[WorkflowEditor] Template button clicked');
                            setShowTemplateModal(true);
                        }}
                    >
                        📋 テンプレート
                    </button>
                    <button
                        className="create-workflow-btn"
                        onClick={handleCreateWorkflow}
                        disabled={isCreating}
                    >
                        <span>+</span>
                        {isCreating ? 'Creating...' : 'New Workflow'}
                    </button>
                </div>
            </div>

            <div className="workflow-content">
                {(() => {
                    console.log('[WorkflowEditor] Rendering decision:', {
                        viewMode,
                        isListMode: viewMode === 'list',
                        hasCurrentWorkflow: !!currentWorkflow,
                        selectedWorkflow,
                        workflowsLength: workflows.length
                    });

                    if (viewMode === 'list') {
                        return (
                            <WorkflowList
                                workflows={workflows}
                                onSelect={handleSelectWorkflow}
                                onUpdate={handleUpdateWorkflow}
                                onDelete={handleDeleteWorkflow}
                                onDuplicate={handleDuplicateWorkflow}
                                selectedWorkflow={selectedWorkflow}
                            />
                        );
                    } else if (currentWorkflow) {
                        console.log('[WorkflowEditor] Rendering WorkflowCanvas for:', currentWorkflow.name);
                        return (
                            <WorkflowCanvas
                                workflow={currentWorkflow}
                                onUpdate={handleUpdateWorkflow}
                                onBack={() => setViewMode('list')}
                            />
                        );
                    } else {
                        console.log('[WorkflowEditor] Rendering empty state - no workflow found');
                        return (
                            <div className="no-workflow-selected">
                                <div className="empty-state">
                                    <div className="empty-icon">🔄</div>
                                    <h3>No workflow selected</h3>
                                    <p>Select a workflow from the list or create a new one to get started.</p>
                                    <button
                                        className="back-to-list-btn"
                                        onClick={() => setViewMode('list')}
                                    >
                                        Back to List
                                    </button>
                                </div>
                            </div>
                        );
                    }
                })()}
            </div>

            <WorkflowTemplateModal
                isOpen={showTemplateModal}
                onClose={() => setShowTemplateModal(false)}
                onCreateFromTemplate={handleCreateFromTemplate}
            />
        </div>
    );
};

export default WorkflowEditor;