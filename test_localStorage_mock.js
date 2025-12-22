// Simple test to verify localStorage mock behavior
const storage = {};
const localStorageMock = {
    getItem: (key) => storage[key] || null,
    setItem: (key, value) => { storage[key] = value; },
    removeItem: (key) => { delete storage[key]; },
    clear: () => { Object.keys(storage).forEach(key => delete storage[key]); },
    get length() { return Object.keys(storage).length; },
    key: (index) => Object.keys(storage)[index] || null
};

// Test basic functionality
console.log('Initial storage:', storage);
localStorageMock.setItem('test', 'value');
console.log('After setItem:', storage);
console.log('getItem result:', localStorageMock.getItem('test'));
localStorageMock.clear();
console.log('After clear:', storage);
console.log('getItem after clear:', localStorageMock.getItem('test'));