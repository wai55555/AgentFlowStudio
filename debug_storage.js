// Debug script to test localStorage behavior
const { LocalStorageManager } = require('./src/services/localStorage.ts');

// Mock localStorage
const storage = {};
global.localStorage = {
    getItem: (key) => storage[key] || null,
    setItem: (key, value) => { storage[key] = value; },
    removeItem: (key) => { delete storage[key]; },
    clear: () => { Object.keys(storage).forEach(key => delete storage[key]); },
    get length() { return Object.keys(storage).length; },
    key: (index) => Object.keys(storage)[index] || null
};

async function testSettings() {
    const manager = new LocalStorageManager();

    const testSettings = {
        maxAgents: 1,
        defaultModel: " ",
        apiTimeout: 1000,
        autoSaveInterval: 1000,
        theme: "dark"
    };

    console.log('Original settings:', testSettings);

    // Save settings
    await manager.saveSettings(testSettings);
    console.log('Storage after save:', storage);

    // Load settings
    const loaded = manager.loadSettings();
    console.log('Loaded settings:', loaded);

    // Check if they match
    console.log('Match:', JSON.stringify(loaded) === JSON.stringify(testSettings));
}

testSettings().catch(console.error);