/**
 * OpenRouter API Client Tests
 */

import { OpenRouterClient, OpenRouterError, RateLimitError } from '../src/services/openRouterClient';

// Mock fetch for testing
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock AbortSignal.timeout for older environments
if (!AbortSignal.timeout) {
    (AbortSignal as any).timeout = (ms: number) => {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), ms);
        return controller.signal;
    };
}

describe('OpenRouterClient', () => {
    let client: OpenRouterClient;

    beforeEach(() => {
        client = new OpenRouterClient({
            apiKey: 'test-api-key-1234567890abcdef', // 29文字の有効なAPIキー
            rateLimitRpm: 1000, // High rate limit to avoid delays in tests
            maxRetries: 0 // No retries to avoid delays in tests
        });
        mockFetch.mockClear();
        localStorage.clear();
    });

    describe('constructor', () => {
        it('should initialize with default configuration', () => {
            const defaultClient = new OpenRouterClient({ apiKey: 'test-default-key-1234567890' });
            expect(defaultClient).toBeInstanceOf(OpenRouterClient);
        });

        it('should merge custom configuration with defaults', () => {
            const customClient = new OpenRouterClient({
                apiKey: 'test-custom-key-1234567890',
                maxRetries: 5,
                rateLimitRpm: 30
            });
            expect(customClient).toBeInstanceOf(OpenRouterClient);
        });
    });

    describe('sendRequest', () => {
        it('should make successful API request', async () => {
            const mockResponse = {
                id: 'test-id',
                choices: [{
                    message: { content: 'Test response', role: 'assistant' },
                    finish_reason: 'stop'
                }],
                usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockResponse)
            });

            const result = await client.sendRequest('Test prompt', {
                model: 'test-model',
                maxTokens: 100,
                temperature: 0.7,
                timeout: 5000
            });

            expect(result).toEqual(mockResponse);
            expect(mockFetch).toHaveBeenCalledWith(
                'https://openrouter.ai/api/v1/chat/completions',
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Authorization': 'Bearer test-api-key-1234567890abcdef',
                        'Content-Type': 'application/json'
                    })
                })
            );
        });

        it('should handle API errors', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 400,
                statusText: 'Bad Request',
                headers: {
                    get: () => null
                },
                json: () => Promise.resolve({ error: { message: 'Invalid request' } })
            });

            await expect(client.sendRequest('Test', {
                model: 'test',
                maxTokens: 100,
                temperature: 0.7,
                timeout: 1000
            })).rejects.toThrow('Invalid request');
        }, 10000);

        it('should handle rate limit errors', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 429,
                statusText: 'Too Many Requests',
                headers: {
                    get: (key: string) => key === 'retry-after' ? '60' : null
                },
                json: () => Promise.resolve({ error: { message: 'Rate limited' } })
            });

            await expect(client.sendRequest('Test', {
                model: 'test',
                maxTokens: 100,
                temperature: 0.7,
                timeout: 5000
            })).rejects.toThrow(RateLimitError);
        });

        it('should validate response format', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                headers: {
                    get: () => null
                },
                json: () => Promise.resolve({ invalid: 'response' })
            });

            await expect(client.sendRequest('Test', {
                model: 'test',
                maxTokens: 100,
                temperature: 0.7,
                timeout: 1000
            })).rejects.toThrow('Invalid response format');
        }, 10000);
    });

    describe('checkModelAvailability', () => {
        it('should return true when model is available', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    data: [
                        { id: 'xiaomi/mimo-v2-flash:free' },
                        { id: 'other-model' }
                    ]
                })
            });

            const result = await client.checkModelAvailability();
            expect(result).toBe(true);
        });

        it('should return false when model is not available', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    data: [{ id: 'other-model' }]
                })
            });

            const result = await client.checkModelAvailability();
            expect(result).toBe(false);
        });

        it('should return false on API error', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            const result = await client.checkModelAvailability();
            expect(result).toBe(false);
        });
    });

    describe('getUsageStats', () => {
        it('should return initial usage stats', async () => {
            const stats = await client.getUsageStats();

            expect(stats).toEqual({
                totalRequests: 0,
                totalTokens: 0,
                averageResponseTime: 0,
                errorRate: 0
            });
        });
    });

    describe('error handling', () => {
        it('should create OpenRouterError with correct properties', () => {
            const error = new OpenRouterError('Test error', 400, 1000);

            expect(error.message).toBe('Test error');
            expect(error.statusCode).toBe(400);
            expect(error.retryAfter).toBe(1000);
            expect(error.name).toBe('OpenRouterError');
        });

        it('should create RateLimitError with correct properties', () => {
            const error = new RateLimitError(5000);

            expect(error.message).toContain('Rate limit exceeded');
            expect(error.statusCode).toBe(429);
            expect(error.retryAfter).toBe(5000);
            expect(error.name).toBe('RateLimitError');
        });
    });
});