// Minimal test to isolate the localStorage issue
import { LocalStorageManager } from './src/services/localStorage.ts';

// Mock localStorage exactly like in the tests
const storage = {};
global.localStorage = {
    getItem: (key) => storage[key] || null,
    setItem: (key, value) => { storage[key] = value; },
    removeItem: (key) => { delete storage[key]; },
    clear: () => { Object.keys(storage).forEach(key => delete storage[key]); },
    get length() { return Object.keys(storage).length; },
    key: (index) => Object.keys(storage)[index] || null
};

async function testMinimal() {
    const manager = new LocalStorageManager();

    // Clear storage
    localStorage.clear();
    await manager.clearAll();

    const testSettings = {
        maxAgents: 14,
        defaultModel: "  ",
        apiTimeout: 1000,
        autoSaveInterval: 1000,
        theme: "dark"
    };

    console.log('Original settings:', testSettings);
    console.log('Storage before save:', storage);

    // Save settings
    await manager.saveSettings(testSettings);
    console.log('Storage after save:', storage);

    // Load settings
    const loaded = manager.loadSettings();
    console.log('Loaded settings:', loaded);

    // Check if they match
    const match = JSON.stringify(loaded) === JSON.stringify(testSettings);
    console.log('Match:', match);

    if (!match) {
        console.log('Difference:');
        console.log('Expected:', testSettings);
        console.log('Received:', loaded);
    }
}

testMinimal().catch(console.error);