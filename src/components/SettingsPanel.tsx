import React, { useState, useEffect } from 'react';
import { SystemSettings } from '../types/storage';
import { useApp } from '../contexts/AppContext';
import { SecureAPIKeyManager, SecureStorageError } from '../services/secureStorage';
import './SettingsPanel.css';

interface APIKeyTestResult {
    isValid: boolean;
    testedKey: string; // マスクされたキー
    timestamp: Date;
    errorMessage?: string;
}

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

    // API Key management state
    const [apiKey, setApiKey] = useState<string>('');
    const [showApiKey, setShowApiKey] = useState<boolean>(false);
    const [apiKeyStatus, setApiKeyStatus] = useState<'none' | 'valid' | 'invalid' | 'checking'>('none');
    const [isUsingEnvKey, setIsUsingEnvKey] = useState<boolean>(false);

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

                // Load API key status from secure storage
                const hasEnvKey = SecureAPIKeyManager.hasEnvAPIKey();
                setIsUsingEnvKey(hasEnvKey);

                const hasApiKey = SecureAPIKeyManager.hasAPIKey();
                if (hasApiKey) {
                    const keyPreview = await SecureAPIKeyManager.getAPIKeyPreview();
                    setApiKey(keyPreview); // Show masked version or env indicator
                    setApiKeyStatus('valid');
                } else {
                    // Check for legacy plaintext key and migrate
                    const legacyKey = localStorage.getItem('openrouter_api_key');
                    if (legacyKey) {
                        try {
                            await SecureAPIKeyManager.setAPIKey(legacyKey);
                            localStorage.removeItem('openrouter_api_key');
                            setApiKey(await SecureAPIKeyManager.getAPIKeyPreview());
                            setApiKeyStatus('valid');
                        } catch (error) {
                            console.error('Failed to migrate API key:', error);
                            setApiKey(legacyKey);
                            setApiKeyStatus('invalid');
                        }
                    }
                }
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

            // Save API key securely if provided
            if (apiKey.trim() && !apiKey.includes('*')) { // Don't save masked keys
                try {
                    await SecureAPIKeyManager.setAPIKey(apiKey.trim());
                    // Update OpenRouter client with new key
                    await services.openRouterClient.updateApiKey(apiKey.trim());
                    setApiKeyStatus('valid');
                    // Update display to show masked version
                    const keyPreview = await SecureAPIKeyManager.getAPIKeyPreview();
                    setApiKey(keyPreview);
                } catch (error) {
                    console.error('Failed to save API key securely:', error);
                    setApiKeyStatus('invalid');
                    if (error instanceof SecureStorageError) {
                        alert(`Failed to save API key: ${error.message}`);
                        return;
                    }
                }
            } else if (!apiKey.trim()) {
                SecureAPIKeyManager.removeAPIKey();
                setApiKeyStatus('none');
            }

            alert('Settings saved successfully!');
        } catch (error) {
            console.error('Failed to save settings:', error);
            alert('Failed to save settings. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleApiKeyChange = (value: string) => {
        setApiKey(value);
        if (value.trim() && !value.includes('*')) { // Don't validate masked keys
            setApiKeyStatus('checking');
            // Simple validation - check if it looks like an API key
            if (value.length >= 20) {
                setApiKeyStatus('valid');
            } else {
                setApiKeyStatus('invalid');
            }
        } else if (!value.trim()) {
            setApiKeyStatus('none');
        }
    };

    const handleTestApiKey = async (): Promise<APIKeyTestResult> => {
        if (!services) {
            const result: APIKeyTestResult = {
                isValid: false,
                testedKey: '',
                timestamp: new Date(),
                errorMessage: 'Services not available'
            };
            return result;
        }

        try {
            setIsLoading(true);
            setApiKeyStatus('checking');

            // Validate that we have a key to test
            const keyToTest = apiKey.trim();
            if (!keyToTest || keyToTest.includes('*')) {
                const result: APIKeyTestResult = {
                    isValid: false,
                    testedKey: keyToTest.includes('*') ? keyToTest : '',
                    timestamp: new Date(),
                    errorMessage: 'Please enter a valid API key first.'
                };
                setApiKeyStatus('none');
                alert(result.errorMessage);
                return result;
            }

            // Create a masked version of the key for the result
            const maskedKey = keyToTest.length > 8
                ? `${keyToTest.substring(0, 4)}${'*'.repeat(keyToTest.length - 8)}${keyToTest.substring(keyToTest.length - 4)}`
                : '*'.repeat(keyToTest.length);

            // Update the client configuration with the new key before testing
            await services.openRouterClient.updateApiKey(keyToTest);

            // Test the API key by checking model availability
            const isValid = await services.openRouterClient.checkModelAvailability();

            const result: APIKeyTestResult = {
                isValid,
                testedKey: maskedKey,
                timestamp: new Date(),
                errorMessage: isValid ? undefined : 'API key appears to be invalid or there was a connection issue.'
            };

            setApiKeyStatus(isValid ? 'valid' : 'invalid');

            if (isValid) {
                alert('API key is valid!');
            } else {
                alert(result.errorMessage);
            }

            return result;
        } catch (error) {
            console.error('Failed to test API key:', error);
            const result: APIKeyTestResult = {
                isValid: false,
                testedKey: apiKey.includes('*') ? apiKey : '*'.repeat(Math.min(apiKey.length, 20)),
                timestamp: new Date(),
                errorMessage: `Failed to test API key: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
            setApiKeyStatus('invalid');
            alert(result.errorMessage);
            return result;
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
                    {/* API Configuration */}
                    <div className="settings-section">
                        <h4>API Configuration</h4>

                        <div className="setting-item">
                            <label>OpenRouter API Key</label>
                            <div className="api-key-input-group">
                                <input
                                    type={showApiKey ? "text" : "password"}
                                    value={apiKey}
                                    onChange={(e) => handleApiKeyChange(e.target.value)}
                                    placeholder={isUsingEnvKey ? "環境変数から読み込み中..." : "Enter your OpenRouter API key (sk-...)"}
                                    disabled={isLoading || isUsingEnvKey}
                                    className={`api-key-input ${apiKeyStatus}`}
                                />
                                <button
                                    type="button"
                                    className="toggle-visibility-btn"
                                    onClick={() => setShowApiKey(!showApiKey)}
                                    title={showApiKey ? "Hide API key" : "Show API key"}
                                    disabled={isLoading}
                                >
                                    {showApiKey ? "🙈" : "👁️"}
                                </button>
                                <button
                                    type="button"
                                    className="test-api-key-btn"
                                    onClick={() => handleTestApiKey()}
                                    disabled={!apiKey.trim() || isLoading}
                                    title="Test API key"
                                >
                                    {apiKeyStatus === 'checking' ? "⏳" : "🧪"}
                                </button>
                            </div>
                            <div className="api-key-status">
                                {isUsingEnvKey && (
                                    <div className="env-key-notice">
                                        <span className="status-env">🔧 開発環境: .envファイルからAPIキーを読み込み中</span>
                                        <small>本番環境では手動でAPIキーを設定してください</small>
                                    </div>
                                )}
                                {!isUsingEnvKey && apiKeyStatus === 'none' && (
                                    <span className="status-none">⚠️ No API key configured</span>
                                )}
                                {!isUsingEnvKey && apiKeyStatus === 'valid' && (
                                    <span className="status-valid">✅ API key looks valid</span>
                                )}
                                {!isUsingEnvKey && apiKeyStatus === 'invalid' && (
                                    <span className="status-invalid">❌ API key appears invalid</span>
                                )}
                                {apiKeyStatus === 'checking' && (
                                    <span className="status-checking">⏳ Checking API key...</span>
                                )}
                            </div>
                            <span className="setting-help">
                                Get your API key from <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer">OpenRouter</a>.
                                Your key is stored locally in your browser only.
                            </span>
                        </div>
                    </div>

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