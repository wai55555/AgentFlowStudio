import React, { useState } from 'react';
import { AgentConfig } from '../types/agent';
import './AgentCreationModal.css';

interface AgentCreationModalProps {
    onClose: () => void;
    onCreate: (config: AgentConfig & { name: string; role: string; promptTemplate: string }) => Promise<void>;
    isCreating?: boolean;
}

const AgentCreationModal: React.FC<AgentCreationModalProps> = ({ onClose, onCreate, isCreating = false }) => {
    const [formData, setFormData] = useState({
        name: '',
        role: '',
        promptTemplate: '',
        maxTokens: 1000,
        temperature: 0.7,
        model: 'xiaomi/mimo-v2-flash:free'
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        if (!formData.name.trim()) {
            newErrors.name = 'Agent name is required';
        }

        if (!formData.role.trim()) {
            newErrors.role = 'Agent role is required';
        }

        if (!formData.promptTemplate.trim()) {
            newErrors.promptTemplate = 'Prompt template is required';
        }

        if (formData.maxTokens < 1 || formData.maxTokens > 4000) {
            newErrors.maxTokens = 'Max tokens must be between 1 and 4000';
        }

        if (formData.temperature < 0 || formData.temperature > 2) {
            newErrors.temperature = 'Temperature must be between 0 and 2';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (validateForm()) {
            try {
                await onCreate(formData);
            } catch (error) {
                // Error handling is managed by the parent component
                console.error('Failed to create agent:', error);
            }
        }
    };

    const handleInputChange = (field: string, value: string | number) => {
        setFormData(prev => ({ ...prev, [field]: value }));

        // Clear error for this field when user starts typing
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: '' }));
        }
    };

    const presetRoles = [
        {
            name: 'Data Analyst',
            role: 'Data Analysis Specialist',
            promptTemplate: 'You are a data analyst. Analyze the provided data and provide insights, trends, and recommendations. Focus on accuracy and actionable conclusions.'
        },
        {
            name: 'Content Writer',
            role: 'Content Creation Specialist',
            promptTemplate: 'You are a professional content writer. Create engaging, well-structured content that is informative and tailored to the target audience. Maintain a consistent tone and style.'
        },
        {
            name: 'Code Reviewer',
            role: 'Software Development Specialist',
            promptTemplate: 'You are a senior software engineer. Review code for best practices, potential bugs, performance issues, and maintainability. Provide constructive feedback and suggestions.'
        },
        {
            name: 'Research Assistant',
            role: 'Research and Analysis Specialist',
            promptTemplate: 'You are a research assistant. Gather, analyze, and synthesize information on given topics. Provide comprehensive summaries with reliable sources and key findings.'
        }
    ];

    const applyPreset = (preset: typeof presetRoles[0]) => {
        setFormData(prev => ({
            ...prev,
            name: preset.name,
            role: preset.role,
            promptTemplate: preset.promptTemplate
        }));
        setErrors({});
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Create New Agent</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div className="modal-body">
                    <div className="presets-section">
                        <h3>Quick Start Presets</h3>
                        <div className="presets-grid">
                            {presetRoles.map((preset, index) => (
                                <button
                                    key={index}
                                    className="preset-btn"
                                    onClick={() => applyPreset(preset)}
                                >
                                    <strong>{preset.name}</strong>
                                    <span>{preset.role}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="agent-form">
                        <div className="form-group">
                            <label htmlFor="name">Agent Name *</label>
                            <input
                                id="name"
                                type="text"
                                value={formData.name}
                                onChange={(e) => handleInputChange('name', e.target.value)}
                                className={errors.name ? 'error' : ''}
                                placeholder="e.g., Data Analyst Bot"
                            />
                            {errors.name && <span className="error-text">{errors.name}</span>}
                        </div>

                        <div className="form-group">
                            <label htmlFor="role">Role *</label>
                            <input
                                id="role"
                                type="text"
                                value={formData.role}
                                onChange={(e) => handleInputChange('role', e.target.value)}
                                className={errors.role ? 'error' : ''}
                                placeholder="e.g., Data Analysis Specialist"
                            />
                            {errors.role && <span className="error-text">{errors.role}</span>}
                        </div>

                        <div className="form-group">
                            <label htmlFor="promptTemplate">Prompt Template *</label>
                            <textarea
                                id="promptTemplate"
                                value={formData.promptTemplate}
                                onChange={(e) => handleInputChange('promptTemplate', e.target.value)}
                                className={errors.promptTemplate ? 'error' : ''}
                                placeholder="Define the agent's behavior, expertise, and response style..."
                                rows={4}
                            />
                            {errors.promptTemplate && <span className="error-text">{errors.promptTemplate}</span>}
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="model">Model</label>
                                <select
                                    id="model"
                                    value={formData.model}
                                    onChange={(e) => handleInputChange('model', e.target.value)}
                                >
                                    <option value="xiaomi/mimo-v2-flash:free">Xiaomi Mimo V2 Flash (Free)</option>
                                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                                    <option value="gpt-4">GPT-4</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label htmlFor="maxTokens">Max Tokens</label>
                                <input
                                    id="maxTokens"
                                    type="number"
                                    value={formData.maxTokens}
                                    onChange={(e) => handleInputChange('maxTokens', parseInt(e.target.value))}
                                    className={errors.maxTokens ? 'error' : ''}
                                    min="1"
                                    max="4000"
                                />
                                {errors.maxTokens && <span className="error-text">{errors.maxTokens}</span>}
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="temperature">
                                Temperature ({formData.temperature})
                                <span className="help-text">
                                    Lower values = more focused, Higher values = more creative
                                </span>
                            </label>
                            <input
                                id="temperature"
                                type="range"
                                value={formData.temperature}
                                onChange={(e) => handleInputChange('temperature', parseFloat(e.target.value))}
                                min="0"
                                max="2"
                                step="0.1"
                                className="temperature-slider"
                            />
                            {errors.temperature && <span className="error-text">{errors.temperature}</span>}
                        </div>

                        <div className="form-actions">
                            <button type="button" className="cancel-btn" onClick={onClose} disabled={isCreating}>
                                Cancel
                            </button>
                            <button type="submit" className="create-btn" disabled={isCreating}>
                                {isCreating ? 'Creating...' : 'Create Agent'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default AgentCreationModal;