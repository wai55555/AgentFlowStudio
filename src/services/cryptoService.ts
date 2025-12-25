/**
 * Crypto Service
 * Provides encryption/decryption functionality using Web Crypto API
 * for secure storage of sensitive data like API keys
 */

export class CryptoServiceError extends Error {
    constructor(message: string, public code: string) {
        super(message);
        this.name = 'CryptoServiceError';
    }
}

export interface EncryptedData {
    ciphertext: string;
    iv: string;
    salt: string;
}

export class CryptoService {
    private static readonly ALGORITHM = 'AES-GCM';
    private static readonly KEY_LENGTH = 256;
    private static readonly IV_LENGTH = 12;
    private static readonly SALT_LENGTH = 16;
    private static readonly ITERATIONS = 100000;

    /**
     * Generate a cryptographic key from a password using PBKDF2
     */
    private static async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
        const encoder = new TextEncoder();
        const passwordBuffer = encoder.encode(password);

        // Import password as key material
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            passwordBuffer,
            'PBKDF2',
            false,
            ['deriveBits', 'deriveKey']
        );

        // Derive encryption key
        return crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt as unknown as ArrayBuffer,
                iterations: this.ITERATIONS,
                hash: 'SHA-256'
            },
            keyMaterial,
            {
                name: this.ALGORITHM,
                length: this.KEY_LENGTH
            },
            false,
            ['encrypt', 'decrypt']
        );
    }

    /**
     * Encrypt data using AES-GCM
     */
    static async encrypt(plaintext: string, password: string): Promise<EncryptedData> {
        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(plaintext);

            // Generate random salt and IV
            const salt = crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH));
            const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));

            // Derive encryption key
            const key = await this.deriveKey(password, salt);

            // Encrypt data
            const ciphertext = await crypto.subtle.encrypt(
                {
                    name: this.ALGORITHM,
                    iv: iv
                },
                key,
                data
            );

            // Convert to base64 for storage
            return {
                ciphertext: this.arrayBufferToBase64(ciphertext),
                iv: this.arrayBufferToBase64(iv.buffer),
                salt: this.arrayBufferToBase64(salt.buffer)
            };
        } catch (error) {
            throw new CryptoServiceError(
                `Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'ENCRYPTION_FAILED'
            );
        }
    }

    /**
     * Decrypt data using AES-GCM
     */
    static async decrypt(encryptedData: EncryptedData, password: string): Promise<string> {
        try {
            // Convert from base64
            const ciphertext = this.base64ToArrayBuffer(encryptedData.ciphertext);
            const iv = this.base64ToArrayBuffer(encryptedData.iv);
            const salt = this.base64ToArrayBuffer(encryptedData.salt);

            // Derive decryption key
            const key = await this.deriveKey(password, new Uint8Array(salt));

            // Decrypt data
            const decrypted = await crypto.subtle.decrypt(
                {
                    name: this.ALGORITHM,
                    iv: new Uint8Array(iv)
                },
                key,
                ciphertext
            );

            // Convert to string
            const decoder = new TextDecoder();
            return decoder.decode(decrypted);
        } catch (error) {
            throw new CryptoServiceError(
                `Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'DECRYPTION_FAILED'
            );
        }
    }

    /**
     * Generate a secure random password for encryption
     * This can be derived from user's session or browser fingerprint
     */
    static async generateEncryptionKey(): Promise<string> {
        try {
            // Generate a random key
            const array = new Uint8Array(32);
            crypto.getRandomValues(array);

            // Convert to base64
            return this.arrayBufferToBase64(array.buffer);
        } catch (error) {
            throw new CryptoServiceError(
                `Key generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'KEY_GENERATION_FAILED'
            );
        }
    }

    /**
     * Create a device-specific encryption key based on browser fingerprint
     * This provides a consistent key per device without user input
     */
    static async getDeviceKey(): Promise<string> {
        try {
            // Collect browser fingerprint data
            const fingerprint = [
                navigator.userAgent,
                navigator.language,
                new Date().getTimezoneOffset().toString(),
                screen.colorDepth.toString(),
                screen.width.toString() + 'x' + screen.height.toString(),
                navigator.hardwareConcurrency?.toString() || '0'
            ].join('|');

            // Hash the fingerprint to create a consistent key
            const encoder = new TextEncoder();
            const data = encoder.encode(fingerprint);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);

            return this.arrayBufferToBase64(hashBuffer);
        } catch (error) {
            throw new CryptoServiceError(
                `Device key generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'DEVICE_KEY_FAILED'
            );
        }
    }

    /**
     * Convert ArrayBuffer to Base64 string
     */
    private static arrayBufferToBase64(buffer: ArrayBuffer): string {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    /**
     * Convert Base64 string to ArrayBuffer
     */
    private static base64ToArrayBuffer(base64: string): ArrayBuffer {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }

    /**
     * Hash a string using SHA-256
     */
    static async hash(data: string): Promise<string> {
        try {
            const encoder = new TextEncoder();
            const dataBuffer = encoder.encode(data);
            const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
            return this.arrayBufferToBase64(hashBuffer);
        } catch (error) {
            throw new CryptoServiceError(
                `Hashing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'HASH_FAILED'
            );
        }
    }

    /**
     * Verify if Web Crypto API is available
     */
    static isAvailable(): boolean {
        return typeof crypto !== 'undefined' &&
            typeof crypto.subtle !== 'undefined' &&
            typeof crypto.getRandomValues === 'function';
    }
}
