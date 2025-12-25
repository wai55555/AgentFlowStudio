import React, { useState } from 'react';
import { WorkflowTemplate, workflowTemplates, getAllCategories, createWorkflowFromTemplate } from '../data/workflowTemplates';
import { Workflow } from '../types/workflow';
import './WorkflowTemplateModal.css';

interface WorkflowTemplateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreateFromTemplate: (workflow: Workflow) => void;
}

const WorkflowTemplateModal: React.FC<WorkflowTemplateModalProps> = ({
    isOpen,
    onClose,
    onCreateFromTemplate
}) => {
    console.log('[WorkflowTemplateModal] Props received:', {
        isOpen,
        onClose: typeof onClose,
        onCreateFromTemplate: typeof onCreateFromTemplate
    });
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [creatingTemplateId, setCreatingTemplateId] = useState<string | null>(null);

    console.log('[WorkflowTemplateModal] Component rendered, isOpen:', isOpen);

    if (!isOpen) return null;

    const categories = getAllCategories();
    console.log('[WorkflowTemplateModal] Available categories:', categories);

    const filteredTemplates = workflowTemplates.filter(template => {
        const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
        const matchesDifficulty = selectedDifficulty === 'all' || template.difficulty === selectedDifficulty;
        const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            template.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            template.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));

        return matchesCategory && matchesDifficulty && matchesSearch;
    });

    console.log('[WorkflowTemplateModal] Filtered templates count:', filteredTemplates.length);

    const handleCreateFromTemplate = async (template: WorkflowTemplate) => {
        console.log('[WorkflowTemplateModal] Creating workflow from template:', template.name);

        if (isCreating) {
            console.log('[WorkflowTemplateModal] Already creating a workflow, ignoring click');
            return;
        }

        setIsCreating(true);
        setCreatingTemplateId(template.id);

        try {
            const newWorkflow = createWorkflowFromTemplate(template);
            console.log('[WorkflowTemplateModal] Created workflow:', newWorkflow);

            if (typeof onCreateFromTemplate !== 'function') {
                throw new Error('onCreateFromTemplate is not a function');
            }

            // 少し遅延を入れてユーザーにフィードバックを見せる
            await new Promise(resolve => setTimeout(resolve, 500));

            onCreateFromTemplate(newWorkflow);
            console.log('[WorkflowTemplateModal] Workflow passed to parent, closing modal');

            // 成功メッセージ
            console.log('[WorkflowTemplateModal] Successfully created workflow from template');

            onClose();
        } catch (error) {
            console.error('[WorkflowTemplateModal] Error creating workflow from template:', error);
            alert('テンプレートからワークフローを作成中にエラーが発生しました: ' + (error as Error).message);
        } finally {
            setIsCreating(false);
            setCreatingTemplateId(null);
        }
    };

    const handleTemplateSelect = (template: WorkflowTemplate) => {
        console.log('[WorkflowTemplateModal] Template selected for preview:', template.name);
        setSelectedTemplate(template);
        setShowPreview(true);
    };

    const handleBackToList = () => {
        console.log('[WorkflowTemplateModal] Back to template list');
        setShowPreview(false);
        setSelectedTemplate(null);
    };

    const handleModalClose = () => {
        console.log('[WorkflowTemplateModal] Modal closing');
        setShowPreview(false);
        setSelectedTemplate(null);
        onClose();
    };

    const getDifficultyColor = (difficulty: string) => {
        switch (difficulty) {
            case 'beginner': return '#27ae60';
            case 'intermediate': return '#f39c12';
            case 'advanced': return '#e74c3c';
            default: return '#95a5a6';
        }
    };

    const getDifficultyIcon = (difficulty: string) => {
        switch (difficulty) {
            case 'beginner': return '🟢';
            case 'intermediate': return '🟡';
            case 'advanced': return '🔴';
            default: return '⚪';
        }
    };

    return (
        <div className="modal-overlay" onClick={handleModalClose}>
            <div className="template-modal-content" onClick={e => e.stopPropagation()}>
                <div className="template-modal-header">
                    <h2>ワークフローテンプレート</h2>
                    <button className="close-btn" onClick={handleModalClose}>✕</button>
                </div>

                <div className="template-filters">
                    <div className="search-section">
                        <input
                            type="text"
                            placeholder="テンプレートを検索..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="template-search"
                        />
                    </div>

                    <div className="filter-section">
                        <div className="filter-group">
                            <label>カテゴリ:</label>
                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="filter-select"
                            >
                                <option value="all">すべて</option>
                                {categories.map(category => (
                                    <option key={category} value={category}>{category}</option>
                                ))}
                            </select>
                        </div>

                        <div className="filter-group">
                            <label>難易度:</label>
                            <select
                                value={selectedDifficulty}
                                onChange={(e) => setSelectedDifficulty(e.target.value)}
                                className="filter-select"
                            >
                                <option value="all">すべて</option>
                                <option value="beginner">初級</option>
                                <option value="intermediate">中級</option>
                                <option value="advanced">上級</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="template-content">
                    {!showPreview ? (
                        <div className="templates-grid">
                            {filteredTemplates.length === 0 ? (
                                <div className="no-templates">
                                    <p>条件に一致するテンプレートが見つかりません。</p>
                                </div>
                            ) : (
                                filteredTemplates.map(template => (
                                    <div key={template.id} className="template-card">
                                        <div className="template-card-header">
                                            <h3>{template.name}</h3>
                                            <div className="template-difficulty">
                                                <span
                                                    className="difficulty-badge"
                                                    style={{ backgroundColor: getDifficultyColor(template.difficulty) }}
                                                >
                                                    {getDifficultyIcon(template.difficulty)} {template.difficulty}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="template-meta">
                                            <span className="template-category">{template.category}</span>
                                            <span className="template-nodes">{template.nodes.length} ノード</span>
                                        </div>

                                        <p className="template-description">{template.description}</p>

                                        <div className="template-tags">
                                            {template.tags.map(tag => (
                                                <span key={tag} className="template-tag">{tag}</span>
                                            ))}
                                        </div>

                                        <div className="template-use-cases">
                                            <h4>使用例:</h4>
                                            <ul>
                                                {template.useCases.slice(0, 3).map((useCase, index) => (
                                                    <li key={index}>{useCase}</li>
                                                ))}
                                            </ul>
                                        </div>

                                        <div className="template-actions">
                                            <button
                                                className="preview-btn"
                                                onClick={() => handleTemplateSelect(template)}
                                            >
                                                詳細を見る
                                            </button>
                                            <button
                                                className="use-template-btn"
                                                onClick={() => {
                                                    console.log('[WorkflowTemplateModal] Use template button clicked:', template.name);
                                                    handleCreateFromTemplate(template);
                                                }}
                                                disabled={isCreating}
                                            >
                                                {creatingTemplateId === template.id ? (
                                                    <>
                                                        <span className="loading-spinner">⏳</span>
                                                        作成中...
                                                    </>
                                                ) : (
                                                    'このテンプレートを使用'
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    ) : selectedTemplate && (
                        <div className="template-preview">
                            <div className="preview-header">
                                <button
                                    className="back-btn"
                                    onClick={() => setShowPreview(false)}
                                >
                                    ← 戻る
                                </button>
                                <h3>{selectedTemplate.name}</h3>
                                <button
                                    className="use-template-btn"
                                    onClick={() => handleCreateFromTemplate(selectedTemplate)}
                                    disabled={isCreating}
                                >
                                    {creatingTemplateId === selectedTemplate.id ? (
                                        <>
                                            <span className="loading-spinner">⏳</span>
                                            作成中...
                                        </>
                                    ) : (
                                        'このテンプレートを使用'
                                    )}
                                </button>
                            </div>

                            <div className="preview-content">
                                <div className="preview-info">
                                    <div className="info-section">
                                        <h4>概要</h4>
                                        <p>{selectedTemplate.description}</p>
                                    </div>

                                    <div className="info-section">
                                        <h4>カテゴリ・難易度</h4>
                                        <div className="meta-info">
                                            <span className="category-badge">{selectedTemplate.category}</span>
                                            <span
                                                className="difficulty-badge"
                                                style={{ backgroundColor: getDifficultyColor(selectedTemplate.difficulty) }}
                                            >
                                                {getDifficultyIcon(selectedTemplate.difficulty)} {selectedTemplate.difficulty}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="info-section">
                                        <h4>使用方法</h4>
                                        <div className="instructions">
                                            {selectedTemplate.instructions.split('\n').map((line, index) => (
                                                <p key={index}>{line}</p>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="info-section">
                                        <h4>活用例</h4>
                                        <ul className="use-cases-list">
                                            {selectedTemplate.useCases.map((useCase, index) => (
                                                <li key={index}>{useCase}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>

                                <div className="preview-workflow">
                                    <h4>ワークフロー構成</h4>
                                    <div className="workflow-summary">
                                        <div className="summary-stats">
                                            <div className="stat">
                                                <span className="stat-value">{selectedTemplate.nodes.length}</span>
                                                <span className="stat-label">ノード</span>
                                            </div>
                                            <div className="stat">
                                                <span className="stat-value">{selectedTemplate.connections.length}</span>
                                                <span className="stat-label">接続</span>
                                            </div>
                                        </div>

                                        <div className="node-types">
                                            <h5>ノード構成:</h5>
                                            {Object.entries(
                                                selectedTemplate.nodes.reduce((acc, node) => {
                                                    acc[node.type] = (acc[node.type] || 0) + 1;
                                                    return acc;
                                                }, {} as Record<string, number>)
                                            ).map(([type, count]) => (
                                                <div key={type} className="node-type-count">
                                                    <span className={`node-type-icon ${type}`}>
                                                        {type === 'input' ? '📥' :
                                                            type === 'process' ? '⚙️' :
                                                                type === 'condition' ? '🔀' : '📤'}
                                                    </span>
                                                    <span>{type}: {count}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WorkflowTemplateModal;