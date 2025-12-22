/**
 * Unit tests for SecureStorage and SecureAPIKeyManager
 * Tests encrypted storage functionality
 */

import { SecureStorage, SecureAPIKeyManager, SecureStorageError } from '../src/services/secureStorage';
import { CryptoService } from '../src/services/cryptoService';

// Mock CryptoService
jest.mock('../src/services/cryptoService');
const mockCryptoService = CryptoService as jest.Mocked<typeof CryptoService>;

// Mock localStorage
const mockLocalStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
    key: jest.fn(),
    length: 0
};

Object.defineProperty(global, 'localStorage', {
    value: mockLocalStorage,
    writable: true
});

describe('SecureStorage', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Setup default mock implementations
        mockCryptoService.isAvailable.mockReturnValue(true);
        mockCryptoService.encrypt.mockResolvedValue({
            ciphertext: 'encrypted_data',
            iv: 'random_iv',
            salt: 'random_salt'
        });
        mockCryptoService.decrypt.mockResolvedValue('decrypted_data');
        mockCryptoService.getDeviceKey.mockResolvedValue('device_key');
        mockCryptoService.generateEncryptionKey.mockResolvedValue('random_key');
    });

    describe('setItem', () => {
        it('should store encrypted data successfully', async () => {
            await SecureStorage.setItem('test_key', 'test_value');

            expect(mockCryptoService.encrypt).toHaveBeenCalledWith('test_value', 'device_key');
            expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
                'secure_test_key',
                expect.stringContaining('encrypted_data')
            );
        });

        it('should throw error when Web Crypto API is not available', async () => {
            mockCryptoService.isAvailable.mockReturnValue(false);

            await expect(SecureStorage.setItem('key', 'value'))
                .rejects
                .toThrow(SecureStorageError);
        });

        it('should handle encryption failures', async () => {
            mockCryptoService.encrypt.mockRejectedValue(new Error('Encryption failed'));

            await expect(SecureStorage.setItem('key', 'value'))
                .rejects
                .toThrow(SecureStorageError);
        });
    });

    describe('getItem', () => {
        it('should retrieve and decrypt data successfully', async () => {
            const storedData = JSON.stringify({
                ciphertext: 'encrypted_data',
                iv: 'random_iv',
                salt: 'random_salt',
                timestamp: Date.now(),
                version: '1.0'
            });
            mockLocalStorage.getItem.mockReturnValue(storedData);

            const result = await SecureStorage.getItem('test_key');

            expect(result).toBe('decrypted_data');
            expect(mockCryptoService.decrypt).toHaveBeenCalledWith(
                {
                    ciphertext: 'encrypted_data',
                    iv: 'random_iv',
                    salt: 'random_salt'
                },
                'device_key'
            );
        });

        it('should return null when item does not exist', async () => {
            mockLocalStorage.getItem.mockReturnValue(null);

            const result = await SecureStorage.getItem('nonexistent_key');

            expect(result).toBeNull();
        });

        it('should throw error for invalid data format', async () => {
            mockLocalStorage.getItem.mockReturnValue('invalid_json');

            await expect(SecureStorage.getItem('key'))
                .rejects
                .toThrow(SecureStorageError);
        });

        it('should handle decryption failures', async () => {
            const storedData = JSON.stringify({
                ciphertext: 'encrypted_data',
                iv: 'random_iv',
                salt: 'random_salt',
                timestamp: Date.now(),
                version: '1.0'
            });
            mockLocalStorage.getItem.mockReturnValue(storedData);
            mockCryptoService.decrypt.mockRejectedValue(new Error('Decryption failed'));

            await expect(SecureStorage.getItem('key'))
                .rejects
                .toThrow(SecureStorageError);
        });
    });

    describe('removeItem', () => {
        it('should remove item from localStorage', () => {
            SecureStorage.removeItem('test_key');

            expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('secure_test_key');
        });
    });

    describe('hasItem', () => {
        it('should return true when item exists', () => {
            mockLocalStorage.getItem.mockReturnValue('some_data');

            const result = SecureStorage.hasItem('test_key');

            expect(result).toBe(true);
        });

        it('should return false when item does not exist', () => {
            mockLocalStorage.getItem.mockReturnValue(null);

            const result = SecureStorage.hasItem('test_key');

            expect(result).toBe(false);
        });
    });

    describe('testCrypto', () => {
        it('should return true when encryption/decryption works', async () => {
            const result = await SecureStorage.testCrypto();

            expect(result).toBe(true);
        });

        it('should return false when encryption/decryption fails', async () => {
            mockCryptoService.encrypt.mockRejectedValue(new Error('Test failure'));

            const result = await SecureStorage.testCrypto();

            expect(result).toBe(false);
        });
    });
});

describe('SecureAPIKeyManager', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Setup default mocks
        mockCryptoService.isAvailable.mockReturnValue(true);
        mockCryptoService.encrypt.mockResolvedValue({
            ciphertext: 'encrypted_key',
            iv: 'random_iv',
            salt: 'random_salt'
        });
        mockCryptoService.decrypt.mockResolvedValue('sk-test-api-key-1234567890');
        mockCryptoService.getDeviceKey.mockResolvedValue('device_key');
    });

    describe('setAPIKey', () => {
        it('should store API key securely', async () => {
            const apiKey = 'sk-test-api-key-1234567890';

            await SecureAPIKeyManager.setAPIKey(apiKey);

            expect(mockCryptoService.encrypt).toHaveBeenCalledWith(apiKey, 'device_key');
        });

        it('should validate API key format', async () => {
            const invalidKey = 'invalid';

            await expect(SecureAPIKeyManager.setAPIKey(invalidKey))
                .rejects
                .toThrow(SecureStorageError);
        });

        it('should reject empty API key', async () => {
            await expect(SecureAPIKeyManager.setAPIKey(''))
                .rejects
                .toThrow(SecureStorageError);
        });
    });

    describe('getAPIKey', () => {
        it('should retrieve API key successfully', async () => {
            const storedData = JSON.stringify({
                ciphertext: 'encrypted_key',
                iv: 'random_iv',
                salt: 'random_salt',
                timestamp: Date.now(),
                version: '1.0'
            });
            mockLocalStorage.getItem.mockReturnValue(storedData);

            const result = await SecureAPIKeyManager.getAPIKey();

            expect(result).toBe('sk-test-api-key-1234567890');
        });

        it('should migrate legacy plaintext key', async () => {
            mockLocalStorage.getItem.mockImplementation((key) => {
                if (key === 'secure_openrouter_api_key') return null;
                if (key === 'openrouter_api_key_plain') return 'sk-legacy-key-1234567890';
                return null;
            });

            const result = await SecureAPIKeyManager.getAPIKey();

            expect(result).toBe('sk-legacy-key-1234567890');
            expect(mockCryptoService.encrypt).toHaveBeenCalled();
            expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('openrouter_api_key_plain');
        });

        it('should return null when no key exists', async () => {
            mockLocalStorage.getItem.mockReturnValue(null);

            const result = await SecureAPIKeyManager.getAPIKey();

            expect(result).toBeNull();
        });

        it('should handle corrupted keys gracefully', async () => {
            const storedData = JSON.stringify({
                ciphertext: 'corrupted_data',
                iv: 'random_iv',
                salt: 'random_salt',
                timestamp: Date.now(),
                version: '1.0'
            });
            mockLocalStorage.getItem.mockReturnValue(storedData);
            mockCryptoService.decrypt.mockRejectedValue(new Error('Decryption failed'));

            const result = await SecureAPIKeyManager.getAPIKey();

            expect(result).toBeNull();
            expect(mockLocalStorage.removeItem).toHaveBeenCalled();
        });
    });

    describe('getAPIKeyPreview', () => {
        it('should return masked API key', async () => {
            const storedData = JSON.stringify({
                ciphertext: 'encrypted_key',
                iv: 'random_iv',
                salt: 'random_salt',
                timestamp: Date.now(),
                version: '1.0'
            });
            mockLocalStorage.getItem.mockReturnValue(storedData);

            const result = await SecureAPIKeyManager.getAPIKeyPreview();

            expect(result).toBe('sk-t**************7890');
        });

        it('should return empty string when no key exists', async () => {
            mockLocalStorage.getItem.mockReturnValue(null);

            const result = await SecureAPIKeyManager.getAPIKeyPreview();

            expect(result).toBe('');
        });
    });

    describe('hasAPIKey', () => {
        it('should return true when encrypted key exists', () => {
            mockLocalStorage.getItem.mockImplementation((key) => {
                if (key === 'secure_openrouter_api_key') return 'encrypted_data';
                return null;
            });

            const result = SecureAPIKeyManager.hasAPIKey();

            expect(result).toBe(true);
        });

        it('should return true when legacy key exists', () => {
            mockLocalStorage.getItem.mockImplementation((key) => {
                if (key === 'secure_openrouter_api_key') return null;
                if (key === 'openrouter_api_key_plain') return 'legacy_key';
                return null;
            });

            const result = SecureAPIKeyManager.hasAPIKey();

            expect(result).toBe(true);
        });

        it('should return false when no key exists', () => {
            mockLocalStorage.getItem.mockReturnValue(null);

            const result = SecureAPIKeyManager.hasAPIKey();

            expect(result).toBe(false);
        });
    });

    describe('testAPIKeyStorage', () => {
        it('should return true when storage works correctly', async () => {
            const result = await SecureAPIKeyManager.testAPIKeyStorage();

            expect(result).toBe(true);
        });

        it('should return false when storage fails', async () => {
            mockCryptoService.encrypt.mockRejectedValue(new Error('Storage failed'));

            const result = await SecureAPIKeyManager.testAPIKeyStorage();

            expect(result).toBe(false);
        });
    });
});