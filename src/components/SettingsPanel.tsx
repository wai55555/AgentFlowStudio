import React, { useState, useEffect } from 'react';
import { SystemSettings } from '../types/storage';
import { useApp } from '../contexts/AppContext';
import './SettingsPanel.css';

interface SettingsPanelProps {
    isOpen?: boolean;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
    isOpen = false
}) => {
    const { exportConfiguration, importConfiguration, services } = useApp();
    const [showSettings, setShowSettings] = useState(isOpen);
    const [settings, setSettings] = useState<SystemSettings>({
        maxAgents: 10,
        defaultModel: 'xiaomi/mimo-v2-flash:free',
        apiTimeout: 30000,
        autoSaveInterval: 60000,
        theme: 'light'
    });

    const [exportData, setExportData] = useState<string>('');
    const [importData, setImportData] = useState<string>('');
    const [showExportModal, setShowExportModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [storageStats, setStorageStats] = useState<any>(null);

    // Load settings and storage stats on mount
    useEffect(() => {
        const loadData = async () => {
            if (!services) return;

            try {
                const [loadedSettings, stats] = await Promise.all([
                    services.storageManager.loadSettings(),
                    services.storageManager.getStorageStats()
                ]);
                setSettings(loadedSettings);
                setStorageStats(stats);
            } catch (error) {
                console.error('Failed to load settings:', error);
            }
        };

        loadData();
    }, [services]);

    const handleSettingChange = (key: keyof SystemSettings, value: any) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const handleSaveSettings = async () => {
        if (!services) return;

        try {
            setIsLoading(true);
            await services.storageManager.saveSettings(settings);
            alert('Settings saved successfully!');
        } catch (error) {
            console.error('Failed to save settings:', error);
            alert('Failed to save settings. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleExportConfiguration = async () => {
        try {
            setIsLoading(true);
            const configData = await exportConfiguration();
            setExportData(configData);
            setShowExportModal(true);
        } catch (error) {
            console.error('Failed to export configuration:', error);
            alert('Failed to export configuration. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownloadExport = () => {
        const blob = new Blob([exportData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ai-agent-config-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setShowExportModal(false);
    };

    const handleImportConfiguration = async () => {
        try {
            setIsLoading(true);
            await importConfiguration(importData);
            alert('Configuration imported successfully!');
            setShowImportModal(false);
            setImportData('');
        } catch (error) {
            console.error('Failed to import configuration:', error);
            alert('Failed to import configuration: ' + (error instanceof Error ? error.message : 'Unknown error'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target?.result as string;
                setImportData(content);
            };
            reader.readAsText(file);
        }
    };

    const handleClearAllData = async () => {
        if (confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
            if (!services) return;

            try {
                setIsLoading(true);
                await services.storageManager.clearAll();
                alert('All data cleared successfully!');
                // Refresh the page to reset the application state
                window.location.reload();
            } catch (error) {
                console.error('Failed to clear data:', error);
                alert('Failed to clear data. Please try again.');
            } finally {
                setIsLoading(false);
            }
        }
    };

    const formatStorageSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    if (!showSettings) {
        return (
            <button
                className="settings-toggle-btn"
                onClick={() => setShowSettings(true)}
                title="Open Settings"
                disabled={isLoading}
            >
                ⚙️
            </button>
        );
    }

    return (
        <>
            <div className="settings-overlay" onClick={() => setShowSettings(false)} />
            <div className="settings-panel">
                <div className="settings-header">
                    <h3>Settings</h3>
                    <button
                        className="close-settings-btn"
                        onClick={() => setShowSettings(false)}
                        disabled={isLoading}
                    >
                        ×
                    </button>
                </div>

                <div className="settings-content">
                    {/* General Settings */}
                    <div className="settings-section">
                        <h4>General</h4>

                        <div className="setting-item">
                            <label>Maximum Agents</label>
                            <input
                                type="number"
                                value={settings.maxAgents}
                                onChange={(e) => handleSettingChange('maxAgents', parseInt(e.target.value))}
                                min="1"
                                max="50"
                                disabled={isLoading}
                            />
                            <span className="setting-help">Maximum number of agents that can be created</span>
                        </div>

                        <div className="setting-item">
                            <label>Default Model</label>
                            <select
                                value={settings.defaultModel}
                                onChange={(e) => handleSettingChange('defaultModel', e.target.value)}
                                disabled={isLoading}
                            >
                                <option value="xiaomi/mimo-v2-flash:free">Xiaomi Mimo V2 Flash (Free)</option>
                                <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                                <option value="gpt-4">GPT-4</option>
                            </select>
                            <span className="setting-help">Default model for new agents</span>
                        </div>

                        <div className="setting-item">
                            <label>API Timeout (seconds)</label>
                            <input
                                type="number"
                                value={settings.apiTimeout / 1000}
                                onChange={(e) => handleSettingChange('apiTimeout', parseInt(e.target.value) * 1000)}
                                min="5"
                                max="300"
                                disabled={isLoading}
                            />
                            <span className="setting-help">Timeout for API requests</span>
                        </div>

                        <div className="setting-item">
                            <label>Auto-save Interval (minutes)</label>
                            <input
                                type="number"
                                value={settings.autoSaveInterval / 60000}
                                onChange={(e) => handleSettingChange('autoSaveInterval', parseInt(e.target.value) * 60000)}
                                min="1"
                                max="60"
                                disabled={isLoading}
                            />
                            <span className="setting-help">How often to automatically save data</span>
                        </div>

                        <div className="setting-item">
                            <label>Theme</label>
                            <select
                                value={settings.theme}
                                onChange={(e) => handleSettingChange('theme', e.target.value as 'light' | 'dark')}
                                disabled={isLoading}
                            >
                                <option value="light">Light</option>
                                <option value="dark">Dark</option>
                            </select>
                            <span className="setting-help">Application theme</span>
                        </div>
                    </div>

                    {/* Data Management */}
                    <div className="settings-section">
                        <h4>Data Management</h4>

                        <div className="setting-actions">
                            <button
                                className="action-btn export-btn"
                                onClick={handleExportConfiguration}
                                disabled={isLoading}
                            >
                                📤 {isLoading ? 'Exporting...' : 'Export Configuration'}
                            </button>

                            <button
                                className="action-btn import-btn"
                                onClick={() => setShowImportModal(true)}
                                disabled={isLoading}
                            >
                                📥 Import Configuration
                            </button>

                            <button
                                className="action-btn clear-btn"
                                onClick={handleClearAllData}
                                disabled={isLoading}
                            >
                                🗑️ {isLoading ? 'Clearing...' : 'Clear All Data'}
                            </button>
                        </div>
                    </div>

                    {/* Storage Info */}
                    <div className="settings-section">
                        <h4>Storage Information</h4>
                        <div className="storage-info">
                            <div className="storage-item">
                                <span className="storage-label">Local Storage:</span>
                                <span className="storage-value">
                                    {storageStats?.localStorage ? 'Available' : 'Loading...'}
                                </span>
                            </div>
                            <div className="storage-item">
                                <span className="storage-label">IndexedDB:</span>
                                <span className="storage-value">
                                    {storageStats?.indexedDB ? 'Available' : 'Loading...'}
                                </span>
                            </div>
                            <div className="storage-item">
                                <span className="storage-label">Estimated Usage:</span>
                                <span className="storage-value">
                                    {storageStats ? formatStorageSize(storageStats.localStorage?.used || 0) : 'Loading...'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="settings-footer">
                    <button
                        className="save-settings-btn"
                        onClick={handleSaveSettings}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            </div>

            {/* Export Modal */}
            {showExportModal && (
                <div className="modal-overlay" onClick={() => setShowExportModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Export Configuration</h3>
                            <button className="close-btn" onClick={() => setShowExportModal(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            <p>Your configuration has been generated. You can copy it or download as a file.</p>
                            <textarea
                                value={exportData}
                                readOnly
                                rows={10}
                                className="export-textarea"
                            />
                        </div>
                        <div className="modal-footer">
                            <button
                                className="copy-btn"
                                onClick={() => {
                                    navigator.clipboard.writeText(exportData);
                                    alert('Configuration copied to clipboard!');
                                }}
                            >
                                Copy to Clipboard
                            </button>
                            <button
                                className="download-btn"
                                onClick={handleDownloadExport}
                            >
                                Download File
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Import Modal */}
            {showImportModal && (
                <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Import Configuration</h3>
                            <button className="close-btn" onClick={() => setShowImportModal(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            <p>Paste your configuration JSON or upload a file:</p>
                            <div className="import-options">
                                <input
                                    type="file"
                                    accept=".json"
                                    onChange={handleFileImport}
                                    className="file-input"
                                    disabled={isLoading}
                                />
                                <span>or</span>
                                <textarea
                                    value={importData}
                                    onChange={(e) => setImportData(e.target.value)}
                                    placeholder="Paste configuration JSON here..."
                                    rows={8}
                                    className="import-textarea"
                                    disabled={isLoading}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button
                                className="cancel-btn"
                                onClick={() => setShowImportModal(false)}
                                disabled={isLoading}
                            >
                                Cancel
                            </button>
                            <button
                                className="import-confirm-btn"
                                onClick={handleImportConfiguration}
                                disabled={!importData.trim() || isLoading}
                            >
                                {isLoading ? 'Importing...' : 'Import Configuration'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default SettingsPanel;