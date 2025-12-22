/**
 * Loading Screen Component
 * Displays loading state during application initialization with optimized animations
 */

import React, { useState, useEffect } from 'react';
import './LoadingScreen.css';

interface LoadingStep {
    id: string;
    label: string;
    completed: boolean;
}

const LoadingScreen: React.FC = () => {
    const [currentStep, setCurrentStep] = useState(0);
    const [steps, setSteps] = useState<LoadingStep[]>([
        { id: 'storage', label: 'Storage systems', completed: false },
        { id: 'agents', label: 'Agent manager', completed: false },
        { id: 'tasks', label: 'Task queue', completed: false },
        { id: 'workflows', label: 'Workflow engine', completed: false },
        { id: 'data', label: 'Loading data...', completed: false }
    ]);

    useEffect(() => {
        // Simulate loading steps with realistic timing
        const stepTimings = [500, 300, 400, 350, 600]; // ms for each step
        let totalTime = 0;

        steps.forEach((_, index) => {
            totalTime += stepTimings[index];

            setTimeout(() => {
                setSteps(prevSteps =>
                    prevSteps.map((step, i) =>
                        i === index ? { ...step, completed: true } : step
                    )
                );

                if (index < steps.length - 1) {
                    setCurrentStep(index + 1);
                }
            }, totalTime);
        });
    }, []);

    return (
        <div className="loading-screen" role="status" aria-label="Loading application">
            <div className="loading-content">
                <div className="loading-logo">
                    <div className="logo-icon" aria-hidden="true">🤖</div>
                    <h1>AI Agent Orchestration Platform</h1>
                </div>

                <div className="loading-spinner" aria-hidden="true">
                    <div className="spinner"></div>
                    <div className="spinner-glow"></div>
                </div>

                <div className="loading-text">
                    <p>Initializing services...</p>
                    <div className="loading-steps" role="progressbar" aria-valuenow={currentStep} aria-valuemax={steps.length}>
                        {steps.map((step, index) => (
                            <div
                                key={step.id}
                                className={`step ${step.completed ? 'completed' : ''} ${index === currentStep ? 'active' : ''}`}
                                aria-label={`${step.label} ${step.completed ? 'completed' : index === currentStep ? 'in progress' : 'pending'}`}
                            >
                                <span className="step-icon" aria-hidden="true">
                                    {step.completed ? '✓' : index === currentStep ? '⟳' : '○'}
                                </span>
                                <span className="step-label">{step.label}</span>
                                {index === currentStep && !step.completed && (
                                    <div className="step-progress" aria-hidden="true">
                                        <div className="step-progress-bar"></div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="loading-tips">
                    <p className="tip-text">
                        💡 Tip: Use <kbd>Alt + 1-4</kbd> to quickly navigate between sections
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LoadingScreen;