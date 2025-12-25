/**
 * Secure Storage Service
 * Provides encrypted storage for sensitive data like API keys
 * Uses Web Crypto API for encryption and localStorage for persistence
 */

import { CryptoService, CryptoServiceError, EncryptedData } from './cryptoService';

export class SecureStorageError extends Error {
    constructor(message: string, public code: string) {
        super(message);
        this.name = 'SecureStorageError';
    }
}

export interface SecureStorageOptions {
    useDeviceKey?: boolean;
    keyDerivationRounds?: number;
    compressionEnabled?: boolean;
}

export class SecureStorage {
    private static readonly STORAGE_PREFIX = 'secure_';
    private static readonly DEVICE_KEY_STORAGE = 'device_encryption_key';
    private static deviceKey: string | null = null;

    /**
     * Store encrypted data in localStorage
     */
    static async setItem(
        key: string,
        value: string,
        options: SecureStorageOptions = {}
    ): Promise<void> {
        if (!CryptoService.isAvailable()) {
            throw new SecureStorageError(
                'Web Crypto API is not available in this environment',
                'CRYPTO_UNAVAILABLE'
            );
        }

        try {
            const encryptionKey = await this.getEncryptionKey(options.useDeviceKey);
            const encryptedData = await CryptoService.encrypt(value, encryptionKey);

            const storageData = {
                ...encryptedData,
                timestamp: Date.now(),
                version: '1.0'
            };

            localStorage.setItem(
                this.STORAGE_PREFIX + key,
                JSON.stringify(storageData)
            );
        } catch (error) {
            if (error instanceof CryptoServiceError) {
                throw new SecureStorageError(
                    `Failed to encrypt data: ${error.message}`,
                    'ENCRYPTION_FAILED'
                );
            }
            throw new SecureStorageError(
                `Failed to store encrypted data: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'STORAGE_FAILED'
            );
        }
    }

    /**
     * Retrieve and decrypt data from localStorage
     */
    static async getItem(
        key: string,
        options: SecureStorageOptions = {}
    ): Promise<string | null> {
        if (!CryptoService.isAvailable()) {
            throw new SecureStorageError(
                'Web Crypto API is not available in this environment',
                'CRYPTO_UNAVAILABLE'
            );
        }

        try {
            const storedData = localStorage.getItem(this.STORAGE_PREFIX + key);
            if (!storedData) {
                return null;
            }

            const parsedData = JSON.parse(storedData);

            // Validate stored data structure
            if (!this.isValidEncryptedData(parsedData)) {
                throw new SecureStorageError(
                    'Invalid encrypted data format',
                    'INVALID_DATA_FORMAT'
                );
            }

            const encryptionKey = await this.getEncryptionKey(options.useDeviceKey);
            const encryptedData: EncryptedData = {
                ciphertext: parsedData.ciphertext,
                iv: parsedData.iv,
                salt: parsedData.salt
            };

            return await CryptoService.decrypt(encryptedData, encryptionKey);
        } catch (error) {
            if (error instanceof CryptoServiceError) {
                throw new SecureStorageError(
                    `Failed to decrypt data: ${error.message}`,
                    'DECRYPTION_FAILED'
                );
            }
            if (error instanceof SecureStorageError) {
                throw error;
            }
            throw new SecureStorageError(
                `Failed to retrieve encrypted data: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'RETRIEVAL_FAILED'
            );
        }
    }

    /**
     * Remove encrypted data from localStorage
     */
    static removeItem(key: string): void {
        localStorage.removeItem(this.STORAGE_PREFIX + key);
    }

    /**
     * Check if encrypted data exists for a key
     */
    static hasItem(key: string): boolean {
        return localStorage.getItem(this.STORAGE_PREFIX + key) !== null;
    }

    /**
     * Clear all encrypted data
     */
    static clear(): void {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith(this.STORAGE_PREFIX)) {
                localStorage.removeItem(key);
            }
        });

        // Clear device key cache
        this.deviceKey = null;
    }

    /**
     * Get list of all encrypted storage keys
     */
    static getKeys(): string[] {
        const keys = Object.keys(localStorage);
        return keys
            .filter(key => key.startsWith(this.STORAGE_PREFIX))
            .map(key => key.substring(this.STORAGE_PREFIX.length));
    }

    /**
     * Get storage usage statistics
     */
    static getStorageStats(): {
        totalItems: number;
        totalSize: number;
        keys: string[];
    } {
        const keys = this.getKeys();
        let totalSize = 0;

        keys.forEach(key => {
            const data = localStorage.getItem(this.STORAGE_PREFIX + key);
            if (data) {
                totalSize += data.length;
            }
        });

        return {
            totalItems: keys.length,
            totalSize,
            keys
        };
    }

    /**
     * Migrate unencrypted data to encrypted storage
     */
    static async migrateFromPlaintext(
        key: string,
        plaintextKey: string,
        options: SecureStorageOptions = {}
    ): Promise<boolean> {
        try {
            const plaintextValue = localStorage.getItem(plaintextKey);
            if (!plaintextValue) {
                return false;
            }

            // Store encrypted version
            await this.setItem(key, plaintextValue, options);

            // Remove plaintext version
            localStorage.removeItem(plaintextKey);

            return true;
        } catch (error) {
            throw new SecureStorageError(
                `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'MIGRATION_FAILED'
            );
        }
    }

    /**
     * Test encryption/decryption functionality
     */
    static async testCrypto(): Promise<boolean> {
        try {
            console.log('SecureStorage.testCrypto: Starting test');
            const testData = 'test_encryption_' + Date.now();
            const testKey = 'crypto_test';
            console.log('SecureStorage.testCrypto: Test data:', testData);

            console.log('SecureStorage.testCrypto: Setting item');
            await this.setItem(testKey, testData);
            console.log('SecureStorage.testCrypto: Item set successfully');

            console.log('SecureStorage.testCrypto: Getting item');
            const retrieved = await this.getItem(testKey);
            console.log('SecureStorage.testCrypto: Retrieved:', retrieved);

            console.log('SecureStorage.testCrypto: Removing item');
            this.removeItem(testKey);
            console.log('SecureStorage.testCrypto: Item removed');

            const result = retrieved === testData;
            console.log('SecureStorage.testCrypto: Comparison result:', result);
            return result;
        } catch (error) {
            console.error('SecureStorage.testCrypto: Error occurred:', error);
            return false;
        }
    }

    /**
     * Get or generate encryption key
     */
    private static async getEncryptionKey(useDeviceKey = true): Promise<string> {
        if (useDeviceKey) {
            if (!this.deviceKey) {
                // Try to load existing device key
                const storedKey = localStorage.getItem(this.DEVICE_KEY_STORAGE);
                if (storedKey) {
                    this.deviceKey = storedKey;
                } else {
                    // Generate new device key
                    this.deviceKey = await CryptoService.getDeviceKey();
                    localStorage.setItem(this.DEVICE_KEY_STORAGE, this.deviceKey);
                }
            }
            return this.deviceKey;
        } else {
            // Generate a session-specific key
            return await CryptoService.generateEncryptionKey();
        }
    }

    /**
     * Validate encrypted data structure
     */
    private static isValidEncryptedData(data: any): boolean {
        return (
            typeof data === 'object' &&
            typeof data.ciphertext === 'string' &&
            typeof data.iv === 'string' &&
            typeof data.salt === 'string' &&
            typeof data.timestamp === 'number' &&
            typeof data.version === 'string'
        );
    }
}

/**
 * Secure API Key Manager
 * Specialized class for managing API keys with encryption
 */
export class SecureAPIKeyManager {
    private static readonly API_KEY_STORAGE_KEY = 'openrouter_api_key';
    private static readonly LEGACY_KEY = 'openrouter_api_key_plain';

    /**
     * Get API key from environment variables (development only)
     */
    private static getEnvAPIKey(): string | null {
        // Only in development mode and when running in browser with Vite
        try {
            // Check if import.meta is available (Vite environment)
            const meta = (globalThis as any).import?.meta;
            if (meta?.env?.DEV && meta?.env?.VITE_OPENROUTER_API_KEY) {
                console.log('[SecureAPIKeyManager] Using API key from environment variables (development mode)');
                return meta.env.VITE_OPENROUTER_API_KEY;
            }
        } catch (error) {
            // import.meta not available (Jest environment)
            console.log('[SecureAPIKeyManager] import.meta not available, skipping environment variable check');
        }
        return null;
    }

    /**
     * Check if development mode API key is available
     */
    static hasEnvAPIKey(): boolean {
        try {
            const meta = (globalThis as any).import?.meta;
            return meta?.env?.DEV && !!meta?.env?.VITE_OPENROUTER_API_KEY;
        } catch (error) {
            return false;
        }
    }

    /**
     * Store API key securely
     */
    static async setAPIKey(apiKey: string): Promise<void> {
        if (!apiKey || typeof apiKey !== 'string') {
            throw new SecureStorageError('Invalid API key provided', 'INVALID_API_KEY');
        }

        // Validate API key format (basic check)
        if (!this.isValidAPIKeyFormat(apiKey)) {
            throw new SecureStorageError('API key format is invalid', 'INVALID_API_KEY_FORMAT');
        }

        await SecureStorage.setItem(this.API_KEY_STORAGE_KEY, apiKey, { useDeviceKey: true });
    }

    /**
     * Retrieve API key securely
     * Priority: 1. Environment variables (dev only), 2. Encrypted storage, 3. Legacy storage
     */
    static async getAPIKey(): Promise<string | null> {
        // First, check environment variables in development mode
        const envKey = this.getEnvAPIKey();
        if (envKey) {
            return envKey;
        }

        try {
            // Try to get encrypted API key first
            const encryptedKey = await SecureStorage.getItem(this.API_KEY_STORAGE_KEY, { useDeviceKey: true });
            if (encryptedKey) {
                return encryptedKey;
            }

            // Check for legacy plaintext key and migrate
            const legacyKey = localStorage.getItem(this.LEGACY_KEY);
            if (legacyKey) {
                await this.setAPIKey(legacyKey);
                localStorage.removeItem(this.LEGACY_KEY);
                return legacyKey;
            }

            return null;
        } catch (error) {
            // If decryption fails, the key might be corrupted
            if (error instanceof SecureStorageError &&
                (error.code === 'DECRYPTION_FAILED' || error.code === 'RETRIEVAL_FAILED')) {
                // Remove corrupted key
                this.removeAPIKey();
                return null;
            }
            throw error;
        }
    }

    /**
     * Remove API key
     */
    static removeAPIKey(): void {
        SecureStorage.removeItem(this.API_KEY_STORAGE_KEY);
        localStorage.removeItem(this.LEGACY_KEY); // Also remove legacy key if exists
    }

    /**
     * Check if API key exists (including environment variables in dev mode)
     */
    static hasAPIKey(): boolean {
        // Check environment variables first in development mode
        if (this.hasEnvAPIKey()) {
            return true;
        }

        return SecureStorage.hasItem(this.API_KEY_STORAGE_KEY) ||
            localStorage.getItem(this.LEGACY_KEY) !== null;
    }

    /**
     * Get masked API key for display
     */
    static async getAPIKeyPreview(): Promise<string> {
        // Check if using environment variable
        if (this.hasEnvAPIKey()) {
            return '[環境変数から読み込み]';
        }

        const apiKey = await this.getAPIKey();
        if (!apiKey) {
            return '';
        }

        if (apiKey.length <= 8) {
            return '*'.repeat(apiKey.length);
        }

        return `${apiKey.substring(0, 4)}${'*'.repeat(apiKey.length - 8)}${apiKey.slice(-4)}`;
    }

    /**
     * Validate API key format
     */
    private static isValidAPIKeyFormat(apiKey: string): boolean {
        // Basic validation - adjust based on OpenRouter's actual format
        return apiKey.length >= 20 && apiKey.length <= 200 && /^[a-zA-Z0-9_-]+$/.test(apiKey);
    }

    /**
     * Test API key functionality
     */
    static async testAPIKeyStorage(): Promise<boolean> {
        try {
            const testKey = 'test_key_' + Date.now() + '_abcdefghijklmnop';
            await this.setAPIKey(testKey);
            const retrieved = await this.getAPIKey();
            this.removeAPIKey();
            return retrieved === testKey;
        } catch {
            return false;
        }
    }
}