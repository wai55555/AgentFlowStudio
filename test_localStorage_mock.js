// Simple test to verify localStorage mock behavior
const storage = {};
const localStorageMock = {
    getItem: (key) => key in storage ? storage[key] : null,
    setItem: (key, value) => {
        // Convert value to string like real localStorage API
        // Handle edge cases where String() might fail
        try {
            storage[key] = String(value);
        } catch (error) {
            // Fallback for objects that can't be converted to string
            storage[key] = '[object Object]';
        }
    },
    removeItem: (key) => { delete storage[key]; },
    clear: () => { Object.keys(storage).forEach(key => delete storage[key]); },
    get length() { return Object.keys(storage).length; },
    key: (index) => Object.keys(storage)[index] || null
};

// Test basic functionality
console.log('Initial storage:', storage);
localStorageMock.setItem('test', 'value');
console.log('After setItem with string:', storage);
console.log('getItem result:', localStorageMock.getItem('test'));

// Test string conversion behavior
localStorageMock.setItem('number', 42);
console.log('After setItem with number:', storage);
console.log('getItem number result:', localStorageMock.getItem('number'));
console.log('Type of stored number:', typeof localStorageMock.getItem('number'));

localStorageMock.setItem('boolean', true);
console.log('After setItem with boolean:', storage);
console.log('getItem boolean result:', localStorageMock.getItem('boolean'));
console.log('Type of stored boolean:', typeof localStorageMock.getItem('boolean'));

localStorageMock.setItem('object', { key: 'value' });
console.log('After setItem with object:', storage);
console.log('getItem object result:', localStorageMock.getItem('object'));
console.log('Type of stored object:', typeof localStorageMock.getItem('object'));

localStorageMock.clear();
console.log('After clear:', storage);
console.log('getItem after clear:', localStorageMock.getItem('test'));