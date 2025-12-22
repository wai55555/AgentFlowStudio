import React, { useEffect } from 'react';
import { AppProvider } from './contexts/AppContext';
import ErrorNotifications from './components/ErrorNotifications';
import Dashboard from './components/Dashboard';
import LoadingScreen from './components/LoadingScreen';
import { useApp } from './contexts/AppContext';
import { performanceOptimizer } from './services/performanceOptimizer';
import { keyboardShortcuts } from './services/keyboardShortcuts';
import './components/ErrorNotifications.css';
import './components/KeyboardShortcuts.css';

// Main app content component (needs to be inside AppProvider)
const AppContent: React.FC = () => {
    const { isLoading, setViewMode } = useApp();

    useEffect(() => {
        // Initialize performance optimization
        performanceOptimizer.enableLazyLoading();

        // Setup keyboard shortcuts event listeners
        const handleNavigate = (event: Event) => {
            const customEvent = event as CustomEvent;
            setViewMode(customEvent.detail.view);
        };

        const handleShortcutAction = (event: Event) => {
            const customEvent = event as CustomEvent;
            const { action } = customEvent.detail;

            // Handle shortcut actions
            switch (action) {
                case 'create-agent':
                    // Trigger agent creation modal
                    document.dispatchEvent(new CustomEvent('open-agent-modal'));
                    break;
                case 'create-task':
                    // Trigger task creation modal
                    document.dispatchEvent(new CustomEvent('open-task-modal'));
                    break;
                case 'create-workflow':
                    // Trigger workflow creation modal
                    document.dispatchEvent(new CustomEvent('open-workflow-modal'));
                    break;
            }
        };

        const handleRefreshData = () => {
            // Trigger data refresh
            window.location.reload();
        };

        const handleSaveConfiguration = () => {
            // Trigger configuration save
            document.dispatchEvent(new CustomEvent('save-config'));
        };

        // Add event listeners
        document.addEventListener('navigate', handleNavigate);
        document.addEventListener('shortcut-action', handleShortcutAction);
        document.addEventListener('refresh-data', handleRefreshData);
        document.addEventListener('save-configuration', handleSaveConfiguration);

        // Setup mouse/keyboard navigation detection
        const handleMouseDown = () => {
            document.body.classList.add('mouse-navigation');
            document.body.classList.remove('keyboard-navigation');
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Tab') {
                document.body.classList.add('keyboard-navigation');
                document.body.classList.remove('mouse-navigation');
            }
        };

        document.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('keydown', handleKeyDown);

        // Cleanup
        return () => {
            document.removeEventListener('navigate', handleNavigate);
            document.removeEventListener('shortcut-action', handleShortcutAction);
            document.removeEventListener('refresh-data', handleRefreshData);
            document.removeEventListener('save-configuration', handleSaveConfiguration);
            document.removeEventListener('mousedown', handleMouseDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [setViewMode]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            performanceOptimizer.destroy();
            keyboardShortcuts.destroy();
        };
    }, []);

    if (isLoading) {
        return <LoadingScreen />;
    }

    return (
        <div className="app">
            <ErrorNotifications />
            <header className="app-header">
                <h1>AI Agent Orchestration Platform</h1>
            </header>
            <main className="app-main">
                <Dashboard />
            </main>
        </div>
    );
};

function App() {
    return (
        <AppProvider>
            <AppContent />
        </AppProvider>
    );
}

export default App;