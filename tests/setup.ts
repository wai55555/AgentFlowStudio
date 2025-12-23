// Jest setup file for test environment configuration
import 'jest-environment-jsdom';

// Polyfill for TextEncoder/TextDecoder (needed for crypto tests)
import { TextEncoder, TextDecoder } from 'util';

Object.assign(global, { TextDecoder, TextEncoder });

// Mock Web Crypto API for tests
let cryptoCounter = 0;

// Simple XOR-based encryption for testing
function simpleEncrypt(data: Uint8Array, key: Uint8Array): Uint8Array {
    const result = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
        result[i] = data[i] ^ key[i % key.length];
    }
    return result;
}

function simpleDecrypt(data: Uint8Array, key: Uint8Array): Uint8Array {
    // XOR is its own inverse
    return simpleEncrypt(data, key);
}

const mockCrypto = {
    subtle: {
        encrypt: jest.fn().mockImplementation(async (algorithm: any, key: any, data: ArrayBuffer) => {
            // Use a simple but consistent encryption that varies with each call
            const input = new Uint8Array(data);
            const callId = cryptoCounter++; // Unique per call
            const keyBytes = new Uint8Array([0x42 + (callId % 256), 0x24, 0x84, 0x48]); // Vary key slightly
            const encrypted = simpleEncrypt(input, keyBytes);

            // Add some randomness to make each encryption different
            const result = new Uint8Array(encrypted.length + 4);
            result.set(encrypted);
            result[encrypted.length] = callId & 0xFF;
            result[encrypted.length + 1] = (callId >> 8) & 0xFF;
            result[encrypted.length + 2] = (callId >> 16) & 0xFF;
            result[encrypted.length + 3] = (callId >> 24) & 0xFF;

            return result.buffer;
        }),
        decrypt: jest.fn().mockImplementation(async (algorithm: any, key: any, data: ArrayBuffer) => {
            // Use the same simple decryption (XOR is its own inverse)
            const input = new Uint8Array(data);

            // Remove the added randomness bytes
            const actualData = input.slice(0, -4);
            const callId = input[input.length - 4] |
                (input[input.length - 3] << 8) |
                (input[input.length - 2] << 16) |
                (input[input.length - 1] << 24);

            const keyBytes = new Uint8Array([0x42 + (callId % 256), 0x24, 0x84, 0x48]); // Same key as encryption
            const decrypted = simpleDecrypt(actualData, keyBytes);
            return decrypted.buffer;
        }),
        importKey: jest.fn().mockImplementation(async (format: string, keyData: ArrayBuffer | Uint8Array, algorithm: any, extractable: boolean, keyUsages: string[]) => {
            // パラメータを検証
            if (!keyData) {
                throw new Error('Invalid keyData');
            }

            return { type: 'secret', algorithm: { name: 'PBKDF2' } };
        }),
        deriveKey: jest.fn().mockImplementation(async (deriveBitsParams: any, keyMaterial: any, derivedKeyAlgorithm: any, extractable: boolean, keyUsages: string[]) => {
            // パラメータを検証してエラーを防ぐ
            if (!deriveBitsParams || !deriveBitsParams.salt) {
                throw new Error('Invalid deriveBitsParams: salt is required');
            }

            // saltがUint8Arrayの場合、ArrayBufferに変換
            let saltBuffer = deriveBitsParams.salt;
            if (saltBuffer instanceof Uint8Array) {
                saltBuffer = saltBuffer.buffer;
            }

            return { type: 'secret', algorithm: { name: 'AES-GCM', length: 256 } };
        }),
        deriveBits: jest.fn().mockImplementation(async () => {
            return new ArrayBuffer(32);
        }),
        digest: jest.fn().mockImplementation(async (algorithm: string, data: ArrayBuffer) => {
            // Simple hash - create a hash based on input content
            const input = new Uint8Array(data);
            const hash = new Uint8Array(32);

            // Create a simple hash based on input content and a string representation
            let sum = 0;
            let contentHash = 0;
            for (let i = 0; i < input.length; i++) {
                sum = (sum + input[i] * (i + 1)) % 65536;
                contentHash = (contentHash * 31 + input[i]) % 2147483647;
            }

            // Fill hash with a pattern based on the sum, content hash, and input length
            for (let i = 0; i < 32; i++) {
                hash[i] = (sum + contentHash + i * input.length + i * 7) % 256;
            }
            return hash.buffer;
        })
    },
    getRandomValues: jest.fn((array: Uint8Array) => {
        // Use a counter-based approach to ensure different values each time
        const baseValue = cryptoCounter++;
        const timestamp = Date.now();
        for (let i = 0; i < array.length; i++) {
            // Ensure truly different values by using timestamp, counter, and position
            array[i] = (baseValue * 17 + i * 23 + timestamp + Math.floor(Math.random() * 256)) % 256;
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
    getItem: jest.fn((key: string) => {
        // Handle special keys that might conflict with Object prototype
        if (key === 'constructor' || key === 'prototype' || key === '__proto__') {
            return storage.hasOwnProperty(key) ? storage[key] : null;
        }
        return storage[key] || null;
    }),
    setItem: jest.fn((key: string, value: any) => {
        // Convert value to string like real localStorage API
        try {
            storage[key] = String(value);
        } catch (error) {
            // Fallback for objects that can't be converted to string
            storage[key] = '[object Object]';
        }
    }),
    removeItem: jest.fn((key: string) => {
        if (storage.hasOwnProperty(key)) {
            delete storage[key];
        }
    }),
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