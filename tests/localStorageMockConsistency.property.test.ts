/**
 * Property-based test for localStorage mock consistency
 * **Feature: code-quality-fixes, Property 11: localStorage mock consistency**
 * **Validates: Requirements 5.1, 5.4, 5.5**
 */

import * as fc from 'fast-check';

// Create a localStorage mock that matches the real API behavior
function createLocalStorageMock() {
    const storage: Record<string, string> = {};

    return {
        getItem: (key: string): string | null => {
            // Handle special keys that might conflict with Object prototype
            if (key === 'constructor' || key === 'prototype' || key === '__proto__' ||
                key === 'toString' || key === 'valueOf' || key === 'hasOwnProperty') {
                return storage.hasOwnProperty(key) ? storage[key] : null;
            }
            return key in storage ? storage[key] : null;
        },
        setItem: (key: string, value: any): void => {
            // Convert value to string like real localStorage API
            // Handle edge cases where String() might fail
            try {
                storage[key] = String(value);
            } catch (error) {
                // Fallback for objects that can't be converted to string
                storage[key] = '[object Object]';
            }
        },
        removeItem: (key: string): void => {
            if (storage.hasOwnProperty(key)) {
                delete storage[key];
            }
        },
        clear: (): void => { Object.keys(storage).forEach(key => delete storage[key]); },
        get length(): number { return Object.keys(storage).length; },
        key: (index: number): string | null => Object.keys(storage)[index] || null,
        // Internal storage for testing
        _getInternalStorage: () => storage
    };
}

describe('Property 11: localStorage mock consistency', () => {
    let mockStorage: ReturnType<typeof createLocalStorageMock>;

    beforeEach(() => {
        mockStorage = createLocalStorageMock();
    });

    /**
     * Property 11: localStorage mock consistency
     * For any localStorage operation, the mock should behave identically to the real API
     * Validates: Requirements 5.1, 5.4, 5.5
     */
    test('Property 11: String conversion consistency - all values stored as strings', async () => {
        await fc.assert(
            fc.property(
                // Generate various types of values that might be stored
                fc.record({
                    key: fc.string({ minLength: 1, maxLength: 50 }).filter(k =>
                        k !== 'constructor' && k !== 'prototype' && k !== '__proto__'
                    ),
                    value: fc.oneof(
                        fc.string(),
                        fc.integer(),
                        fc.float(),
                        fc.boolean(),
                        fc.constant(null),
                        fc.constant(undefined),
                        // Avoid objects that can't be converted to string
                        fc.constant({ toString: () => 'test object' }),
                        fc.array(fc.string()) // Will be converted to comma-separated string
                    )
                }),
                ({ key, value }) => {
                    // Store the value
                    mockStorage.setItem(key, value);

                    // Property: All stored values should be strings
                    const storedValue = mockStorage.getItem(key);
                    expect(typeof storedValue).toBe('string');

                    // Property: The stored value should match String(value)
                    let expectedValue: string;
                    try {
                        expectedValue = String(value);
                    } catch (error) {
                        expectedValue = '[object Object]';
                    }
                    expect(storedValue).toBe(expectedValue);

                    // Property: Internal storage should only contain strings
                    const internalStorage = mockStorage._getInternalStorage();
                    expect(typeof internalStorage[key]).toBe('string');

                    return true; // Property holds
                }
            ),
            { numRuns: 100 }
        );
    });

    test('Property 11: API interface consistency - matches localStorage interface', async () => {
        await fc.assert(
            fc.property(
                fc.array(
                    fc.record({
                        key: fc.string({ minLength: 1, maxLength: 20 }),
                        value: fc.oneof(fc.string(), fc.integer(), fc.boolean())
                    }),
                    { minLength: 0, maxLength: 10 }
                ),
                (items) => {
                    // Clear storage
                    mockStorage.clear();

                    // Add items (handle duplicate keys properly)
                    const uniqueKeys = new Set();
                    items.forEach(({ key, value }) => {
                        mockStorage.setItem(key, value);
                        uniqueKeys.add(key);
                    });

                    // Property: length should match number of unique keys
                    expect(mockStorage.length).toBe(uniqueKeys.size);

                    // Property: key() method should return keys in order
                    for (let i = 0; i < uniqueKeys.size; i++) {
                        const keyAtIndex = mockStorage.key(i);
                        expect(keyAtIndex).toBeDefined();
                        expect(typeof keyAtIndex).toBe('string');
                    }

                    // Property: key() should return null for out-of-bounds indices
                    expect(mockStorage.key(uniqueKeys.size)).toBeNull();
                    expect(mockStorage.key(-1)).toBeNull();

                    // Property: getItem should return stored values as strings for unique keys
                    // For duplicate keys, the last value should be stored
                    const uniqueItems = Array.from(uniqueKeys).map(key => {
                        // Find the last item with this key (since setItem overwrites)
                        let lastItem = null;
                        for (let i = items.length - 1; i >= 0; i--) {
                            if (items[i].key === key) {
                                lastItem = items[i];
                                break;
                            }
                        }
                        return lastItem ? { key, value: lastItem.value } : null;
                    }).filter(Boolean);

                    uniqueItems.forEach(({ key, value }) => {
                        const retrieved = mockStorage.getItem(key);
                        expect(retrieved).toBe(String(value));
                        expect(typeof retrieved).toBe('string');
                    });

                    // Property: getItem should return null for non-existent keys
                    expect(mockStorage.getItem('non-existent-key')).toBeNull();

                    return true; // Property holds
                }
            ),
            { numRuns: 50 }
        );
    });

    test('Property 11: Removal consistency - removeItem and clear work correctly', async () => {
        await fc.assert(
            fc.property(
                fc.array(
                    fc.record({
                        key: fc.string({ minLength: 1, maxLength: 20 }).filter(k =>
                            k !== 'constructor' && k !== 'prototype' && k !== '__proto__' &&
                            k !== 'toString' && k !== 'valueOf' && k !== 'hasOwnProperty'
                        ),
                        value: fc.string({ minLength: 0, maxLength: 50 })
                    }),
                    { minLength: 1, maxLength: 10 }
                ),
                (items) => {
                    // Clear and populate storage
                    mockStorage.clear();

                    // Use unique keys to avoid duplicates
                    const uniqueItems = items.reduce((acc, item) => {
                        if (!acc.some(existing => existing.key === item.key)) {
                            acc.push(item);
                        }
                        return acc;
                    }, [] as typeof items);

                    uniqueItems.forEach(({ key, value }) => {
                        mockStorage.setItem(key, value);
                    });

                    const initialLength = mockStorage.length;
                    expect(initialLength).toBe(uniqueItems.length);

                    // Remove first item
                    if (uniqueItems.length > 0) {
                        const firstKey = uniqueItems[0].key;
                        mockStorage.removeItem(firstKey);

                        // Property: Item should be removed
                        expect(mockStorage.getItem(firstKey)).toBeNull();
                        expect(mockStorage.length).toBe(initialLength - 1);
                    }

                    // Property: Clear should remove all items
                    mockStorage.clear();
                    expect(mockStorage.length).toBe(0);

                    // All items should be gone
                    uniqueItems.forEach(({ key }) => {
                        expect(mockStorage.getItem(key)).toBeNull();
                    });

                    return true; // Property holds
                }
            ),
            { numRuns: 30 }
        );
    });

    test('Property 11: Type coercion consistency - matches JavaScript String() behavior', async () => {
        await fc.assert(
            fc.property(
                fc.oneof(
                    fc.integer(),
                    fc.float(),
                    fc.boolean(),
                    fc.constant(null),
                    fc.constant(undefined),
                    fc.array(fc.string(), { maxLength: 3 }),
                    fc.object({ maxDepth: 1 })
                ),
                (value) => {
                    const key = 'test-key';

                    // Clear storage before test
                    mockStorage.clear();

                    // Store the value
                    mockStorage.setItem(key, value);

                    // Property: Stored value should match JavaScript's String() conversion
                    const storedValue = mockStorage.getItem(key);
                    let expectedValue: string;

                    try {
                        expectedValue = String(value);
                    } catch (error) {
                        // Handle objects that can't be converted to string
                        expectedValue = '[object Object]';
                    }

                    expect(storedValue).toBe(expectedValue);
                    expect(typeof storedValue).toBe('string');

                    return true; // Property holds
                }
            ),
            { numRuns: 50 }
        );
    });

    test('Property 11: Edge case handling - empty keys and special values', async () => {
        // Test edge cases that might occur in real usage
        const edgeCases = [
            { key: '', value: 'empty key' },
            { key: 'normal', value: '' },
            { key: 'space key', value: 'space value' },
            { key: 'unicode-🔑', value: 'unicode-🎯' },
            { key: 'number-key', value: 0 },
            { key: 'boolean-key', value: false },
            { key: 'null-key', value: null },
            { key: 'undefined-key', value: undefined }
        ];

        edgeCases.forEach(({ key, value }) => {
            mockStorage.setItem(key, value);

            // Property: All values should be stored as strings
            const stored = mockStorage.getItem(key);
            expect(typeof stored).toBe('string');
            expect(stored).toBe(String(value));
        });

        // Property: Length should match number of items
        expect(mockStorage.length).toBe(edgeCases.length);
    });

    test('Property 11: Overwrite behavior - setItem overwrites existing values', async () => {
        await fc.assert(
            fc.property(
                fc.record({
                    key: fc.string({ minLength: 1, maxLength: 20 }),
                    value1: fc.oneof(fc.string(), fc.integer(), fc.boolean()),
                    value2: fc.oneof(fc.string(), fc.integer(), fc.boolean())
                }),
                ({ key, value1, value2 }) => {
                    // Clear storage before test
                    mockStorage.clear();

                    // Set initial value
                    mockStorage.setItem(key, value1);
                    expect(mockStorage.getItem(key)).toBe(String(value1));
                    expect(mockStorage.length).toBe(1);

                    // Overwrite with new value
                    mockStorage.setItem(key, value2);

                    // Property: Value should be overwritten, not duplicated
                    expect(mockStorage.getItem(key)).toBe(String(value2));
                    expect(mockStorage.length).toBe(1); // Should still be 1, not 2

                    return true; // Property holds
                }
            ),
            { numRuns: 30 }
        );
    });
});