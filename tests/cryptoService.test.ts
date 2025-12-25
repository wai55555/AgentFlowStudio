/**
 * Unit tests for CryptoService
 * Tests encryption/decryption functionality using Web Crypto API
 */

import { CryptoService, CryptoServiceError } from '../src/services/cryptoService';

describe('CryptoService', () => {
    beforeEach(() => {
        // Don't clear all mocks as it removes our setup.ts mocks
        // Instead, restore the original implementations from setup.ts
        const mockCrypto = (global as any).crypto;

        // Restore the original mock implementations
        const { TextEncoder, TextDecoder } = require('util');
        let cryptoCounter = 0;

        function simpleEncrypt(data: Uint8Array, key: Uint8Array): Uint8Array {
            const result = new Uint8Array(data.length);
            for (let i = 0; i < data.length; i++) {
                result[i] = data[i] ^ key[i % key.length];
            }
            return result;
        }

        // Restore encrypt implementation
        mockCrypto.subtle.encrypt.mockImplementation(async (algorithm: any, key: any, data: ArrayBuffer) => {
            const input = new Uint8Array(data);
            const callId = cryptoCounter++;
            const keyBytes = new Uint8Array([0x42 + (callId % 256), 0x24, 0x84, 0x48]);
            const encrypted = simpleEncrypt(input, keyBytes);

            const result = new Uint8Array(encrypted.length + 4);
            result.set(encrypted);
            result[encrypted.length] = callId & 0xFF;
            result[encrypted.length + 1] = (callId >> 8) & 0xFF;
            result[encrypted.length + 2] = (callId >> 16) & 0xFF;
            result[encrypted.length + 3] = (callId >> 24) & 0xFF;

            return result.buffer;
        });

        // Restore decrypt implementation
        mockCrypto.subtle.decrypt.mockImplementation(async (algorithm: any, key: any, data: ArrayBuffer) => {
            const input = new Uint8Array(data);
            const actualData = input.slice(0, -4);
            const callId = input[input.length - 4] |
                (input[input.length - 3] << 8) |
                (input[input.length - 2] << 16) |
                (input[input.length - 1] << 24);

            const keyBytes = new Uint8Array([0x42 + (callId % 256), 0x24, 0x84, 0x48]);
            const decrypted = simpleEncrypt(actualData, keyBytes); // XOR is its own inverse
            return decrypted.buffer;
        });

        // Ensure these are set for the tests that need them
        mockCrypto.subtle.importKey.mockImplementation(async (format: string, keyData: ArrayBuffer | Uint8Array, algorithm: any, extractable: boolean, keyUsages: string[]) => {
            if (!keyData) {
                throw new Error('Invalid keyData');
            }
            return { type: 'secret', algorithm: { name: 'PBKDF2' } };
        });

        mockCrypto.subtle.deriveKey.mockImplementation(async (deriveBitsParams: any, keyMaterial: any, derivedKeyAlgorithm: any, extractable: boolean, keyUsages: string[]) => {
            if (!deriveBitsParams || !deriveBitsParams.salt) {
                throw new Error('Invalid deriveBitsParams: salt is required');
            }

            let saltBuffer = deriveBitsParams.salt;
            if (saltBuffer instanceof Uint8Array) {
                saltBuffer = saltBuffer.buffer;
            }

            return { type: 'secret', algorithm: { name: 'AES-GCM', length: 256 } };
        });
    });

    describe('isAvailable', () => {
        it('should return true when Web Crypto API is available', () => {
            expect(CryptoService.isAvailable()).toBe(true);
        });

        it('should return false when Web Crypto API is not available', () => {
            const originalCrypto = global.crypto;
            // @ts-ignore
            delete global.crypto;

            expect(CryptoService.isAvailable()).toBe(false);

            global.crypto = originalCrypto;
        });
    });

    describe('encrypt', () => {
        it('should encrypt data successfully', async () => {
            const plaintext = 'sensitive data';
            const password = 'test password';

            const result = await CryptoService.encrypt(plaintext, password);

            expect(result).toHaveProperty('ciphertext');
            expect(result).toHaveProperty('iv');
            expect(result).toHaveProperty('salt');
            expect(typeof result.ciphertext).toBe('string');
            expect(typeof result.iv).toBe('string');
            expect(typeof result.salt).toBe('string');
        });

        it('should throw CryptoServiceError on encryption failure', async () => {
            const mockCrypto = (global as any).crypto;
            mockCrypto.subtle.encrypt.mockRejectedValue(new Error('Encryption failed'));

            await expect(CryptoService.encrypt('data', 'password'))
                .rejects
                .toThrow(CryptoServiceError);
        });

        it('should generate different results for same input', async () => {
            const plaintext = 'test data';
            const password = 'password';

            const result1 = await CryptoService.encrypt(plaintext, password);
            const result2 = await CryptoService.encrypt(plaintext, password);

            // Should be different due to random IV and salt
            expect(result1.ciphertext).not.toBe(result2.ciphertext);
            expect(result1.iv).not.toBe(result2.iv);
            expect(result1.salt).not.toBe(result2.salt);
        });
    });

    describe('decrypt', () => {
        it('should decrypt data successfully', async () => {
            // First encrypt some data to get valid encrypted data
            const plaintext = 'test data';
            const password = 'test password';

            const encryptedData = await CryptoService.encrypt(plaintext, password);

            // Now decrypt it
            const result = await CryptoService.decrypt(encryptedData, password);

            expect(result).toBe(plaintext);
        });

        it('should throw CryptoServiceError on decryption failure', async () => {
            const mockCrypto = (global as any).crypto;
            mockCrypto.subtle.decrypt.mockRejectedValue(new Error('Decryption failed'));

            // Use valid base64 data but mock will fail
            const encryptedData = {
                ciphertext: 'dGVzdA==', // base64 for 'test'
                iv: 'aXY=', // base64 for 'iv'
                salt: 'c2FsdA==' // base64 for 'salt'
            };

            await expect(CryptoService.decrypt(encryptedData, 'password'))
                .rejects
                .toThrow(CryptoServiceError);
        });
    });

    describe('generateEncryptionKey', () => {
        it('should generate a random encryption key', async () => {
            const key = await CryptoService.generateEncryptionKey();

            expect(typeof key).toBe('string');
            expect(key.length).toBeGreaterThan(0);
        });

        it('should generate different keys each time', async () => {
            const key1 = await CryptoService.generateEncryptionKey();
            const key2 = await CryptoService.generateEncryptionKey();

            expect(key1).not.toBe(key2);
        });
    });

    describe('getDeviceKey', () => {
        it('should generate a device-specific key', async () => {
            const key = await CryptoService.getDeviceKey();

            expect(typeof key).toBe('string');
            expect(key.length).toBeGreaterThan(0);
        });

        it('should generate the same key for the same device', async () => {
            const key1 = await CryptoService.getDeviceKey();
            const key2 = await CryptoService.getDeviceKey();

            expect(key1).toBe(key2);
        });
    });

    describe('hash', () => {
        it('should hash data successfully', async () => {
            const data = 'test data';
            const hash = await CryptoService.hash(data);

            expect(typeof hash).toBe('string');
            expect(hash.length).toBeGreaterThan(0);
        });

        it('should generate the same hash for the same input', async () => {
            const data = 'test data';
            const hash1 = await CryptoService.hash(data);
            const hash2 = await CryptoService.hash(data);

            expect(hash1).toBe(hash2);
        });

        it('should generate different hashes for different inputs', async () => {
            const hash1 = await CryptoService.hash('data1');
            const hash2 = await CryptoService.hash('data2');

            expect(hash1).not.toBe(hash2);
        });
    });

    describe('error handling', () => {
        it('should throw CryptoServiceError with proper error codes', async () => {
            const mockCrypto = (global as any).crypto;
            mockCrypto.subtle.encrypt.mockRejectedValue(new Error('Test error'));

            try {
                await CryptoService.encrypt('data', 'password');
            } catch (error) {
                expect(error).toBeInstanceOf(CryptoServiceError);
                expect((error as CryptoServiceError).code).toBe('ENCRYPTION_FAILED');
            }
        });
    });
});