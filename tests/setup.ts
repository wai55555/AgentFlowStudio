// Jest setup file for test environment configuration
import 'jest-environment-jsdom';

// Polyfill for TextEncoder/TextDecoder (needed for crypto tests)
import { TextEncoder, TextDecoder } from 'util';

Object.assign(global, { TextDecoder, TextEncoder });

// Mock Web Crypto API for tests
const mockCrypto = {
    subtle: {
        encrypt: jest.fn(),
        decrypt: jest.fn(),
        importKey: jest.fn(),
        deriveKey: jest.fn(),
        deriveBits: jest.fn(),
        digest: jest.fn()
    },
    getRandomValues: jest.fn((array: Uint8Array) => {
        for (let i = 0; i < array.length; i++) {
            array[i] = Math.floor(Math.random() * 256);
        }
        return array;
    })
};

Object.defineProperty(global, 'crypto', {
    value: mockCrypto,
    writable: true
});

// Mock navigator for device fingerprinting
Object.defineProperty(global, 'navigator', {
    value: {
        userAgent: 'Mozilla/5.0 (Test Environment)',
        language: 'en-US',
        hardwareConcurrency: 4
    },
    writable: true
});

// Mock screen for device fingerprinting
Object.defineProperty(global, 'screen', {
    value: {
        width: 1920,
        height: 1080,
        colorDepth: 24
    },
    writable: true
});

// Mock Date for consistent timezone
Object.defineProperty(Date.prototype, 'getTimezoneOffset', {
    value: () => -480 // UTC+8
});

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