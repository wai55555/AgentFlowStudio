/**
 * Data serialization and deserialization utilities
 */

export class SerializationError extends Error {
    constructor(message: string, public readonly operation: string) {
        super(message);
        this.name = 'SerializationError';
    }
}

export interface SerializationOptions {
    includeMetadata?: boolean;
    compress?: boolean;
    validate?: boolean;
}

export class DataSerializer {
    /**
     * Serialize data to JSON string with error handling
     */
    static serialize<T>(data: T, options: SerializationOptions = {}): string {
        try {
            const payload = options.includeMetadata ? {
                data,
                metadata: {
                    serializedAt: new Date().toISOString(),
                    version: '1.0.0',
                    type: typeof data
                }
            } : data;

            let result = JSON.stringify(payload, this.replacer);

            if (options.compress) {
                result = this.compress(result);
            }

            if (options.validate) {
                // Validate by attempting to deserialize
                this.deserialize(result, options);
            }

            return result;
        } catch (error) {
            throw new SerializationError(
                `Failed to serialize data: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'serialize'
            );
        }
    }

    /**
     * Deserialize JSON string to typed data with error handling
     */
    static deserialize<T>(jsonString: string, options: SerializationOptions = {}): T {
        try {
            let data = jsonString;

            if (options.compress) {
                data = this.decompress(data);
            }

            const parsed = JSON.parse(data, this.reviver);

            // Extract data from metadata wrapper if present
            if (parsed && typeof parsed === 'object' && 'data' in parsed && 'metadata' in parsed) {
                return parsed.data as T;
            }

            return parsed as T;
        } catch (error) {
            throw new SerializationError(
                `Failed to deserialize data: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'deserialize'
            );
        }
    }

    /**
     * JSON replacer function to handle special types
     */
    private static replacer(_key: string, value: any): any {
        // Handle Date objects
        if (value instanceof Date) {
            return {
                __type: 'Date',
                __value: value.toISOString()
            };
        }

        // Handle Map objects
        if (value instanceof Map) {
            return {
                __type: 'Map',
                __value: Array.from(value.entries())
            };
        }

        // Handle Set objects
        if (value instanceof Set) {
            return {
                __type: 'Set',
                __value: Array.from(value)
            };
        }

        // Handle undefined values
        if (value === undefined) {
            return {
                __type: 'undefined',
                __value: null
            };
        }

        return value;
    }

    /**
     * JSON reviver function to restore special types
     */
    private static reviver(_key: string, value: any): any {
        // Handle special type objects
        if (value && typeof value === 'object' && '__type' in value) {
            switch (value.__type) {
                case 'Date':
                    return new Date(value.__value);
                case 'Map':
                    return new Map(value.__value);
                case 'Set':
                    return new Set(value.__value);
                case 'undefined':
                    return undefined;
            }
        }

        // Handle ISO date strings (fallback for Date objects that were serialized by JSON.stringify's built-in behavior)
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
            return new Date(value);
        }

        return value;
    }

    /**
     * Simple compression using JSON minification
     */
    private static compress(data: string): string {
        try {
            // Remove unnecessary whitespace
            const parsed = JSON.parse(data);
            return JSON.stringify(parsed);
        } catch {
            return data;
        }
    }

    /**
     * Decompress data (currently just returns as-is since we use simple compression)
     */
    private static decompress(data: string): string {
        return data;
    }

    /**
     * Validate serialized data structure
     */
    static validate(jsonString: string): boolean {
        try {
            const parsed = JSON.parse(jsonString);
            return parsed !== null && parsed !== undefined;
        } catch {
            return false;
        }
    }

    /**
     * Get serialized data size in bytes
     */
    static getSize(data: string): number {
        return new Blob([data]).size;
    }

    /**
     * Create a deep clone of an object using serialization
     */
    static clone<T>(obj: T): T {
        return this.deserialize<T>(this.serialize(obj));
    }

    /**
     * Compare two objects by serializing them
     */
    static equals<T>(obj1: T, obj2: T): boolean {
        try {
            const serialized1 = this.serialize(obj1);
            const serialized2 = this.serialize(obj2);
            return serialized1 === serialized2;
        } catch {
            return false;
        }
    }
}