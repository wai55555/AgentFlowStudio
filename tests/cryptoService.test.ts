/**
 * Unit tests for CryptoService
 * Tests encryption/decryption functionality using Web Crypto API
 */

import { CryptoService, CryptoServiceError } from '../src/services/cryptoService';

describe('CryptoService', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Setup default mock implementations using global crypto from setup.ts
        const mockCrypto = (global as any).crypto;

        mockCrypto.subtle.importKey.mockResolvedValue({} as CryptoKey);
        mockCrypto.subtle.deriveKey.mockResolvedValue({} as CryptoKey);
        mockCrypto.subtle.encrypt.mockResolvedValue(new ArrayBuffer(32));
        mockCrypto.subtle.decrypt.mockResolvedValue(new TextEncoder().encode('test data'));
        mockCrypto.subtle.digest.mockResolvedValue(new ArrayBuffer(32));
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
            const encryptedData = {
                ciphertext: 'encrypted',
                iv: 'iv',
                salt: 'salt'
            };
            const password = 'test password';

            const result = await CryptoService.decrypt(encryptedData, password);

            expect(result).toBe('test data');
        });

        it('should throw CryptoServiceError on decryption failure', async () => {
            const mockCrypto = (global as any).crypto;
            mockCrypto.subtle.decrypt.mockRejectedValue(new Error('Decryption failed'));

            const encryptedData = {
                ciphertext: 'encrypted',
                iv: 'iv',
                salt: 'salt'
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