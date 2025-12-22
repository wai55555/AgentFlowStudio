// Jest setup file for test environment configuration
import 'jest-environment-jsdom';

// Mock localStorage for tests
let storage: { [key: string]: string } = {};

const localStorageMock = {
    getItem: jest.fn((key: string) => storage[key] || null),
    setItem: jest.fn((key: string, value: string) => { storage[key] = value; }),
    removeItem: jest.fn((key: string) => { delete storage[key]; }),
    clear: jest.fn(() => {
        // Clear all keys from the existing storage object
        Object.keys(storage).forEach(key => delete storage[key]);
    }),
    get length() { return Object.keys(storage).length; },
    key: jest.fn((index: number) => Object.keys(storage)[index] || null)
};

// Add a global reset function for tests
(global as any).resetLocalStorageMock = () => {
    storage = {};
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();
    localStorageMock.clear.mockClear();
    localStorageMock.key.mockClear();
};

Object.defineProperty(window, 'localStorage', {
    value: localStorageMock
});

// Mock IndexedDB for tests
const indexedDBMock = {
    open: jest.fn(),
    deleteDatabase: jest.fn(),
};

Object.defineProperty(window, 'indexedDB', {
    value: indexedDBMock
});

// Mock Web Workers
class WorkerMock {
    constructor(public url: string) { }
    postMessage = jest.fn();
    terminate = jest.fn();
    addEventListener = jest.fn();
    removeEventListener = jest.fn();
}

const WorkerConstructorMock = jest.fn().mockImplementation((url: string) => new WorkerMock(url));

Object.defineProperty(window, 'Worker', {
    value: WorkerConstructorMock
});