/**
 * OpenRouter API Client
 * Handles communication with OpenRouter API for AI model access
 */

import type { APIClient, RequestConfig, APIResponse, UsageStats } from '../types/api';

export interface OpenRouterConfig {
    apiKey: string;
    baseUrl?: string;
    defaultModel?: string;
    maxRetries?: number;
    rateLimitRpm?: number;
}

export class OpenRouterError extends Error {
    constructor(
        message: string,
        public statusCode?: number,
        public retryAfter?: number,
        public originalError?: Error
    ) {
        super(message);
        this.name = 'OpenRouterError';
    }
}

export class RateLimitError extends OpenRouterError {
    constructor(retryAfter: number) {
        super(`Rate limit exceeded. Retry after ${retryAfter}ms`, 429, retryAfter);
        this.name = 'RateLimitError';
    }
}

interface RequestMetrics {
    totalRequests: number;
    totalTokens: number;
    totalResponseTime: number;
    errorCount: number;
    lastRequestTime: number;
}

export class OpenRouterClient implements APIClient {
    private config: Required<OpenRouterConfig>;
    private metrics: RequestMetrics;
    private requestQueue: Array<{ timestamp: number; resolve: () => void }> = [];
    private rateLimitWindow: number = 60000; // 1 minute in milliseconds

    constructor(config: OpenRouterConfig) {
        this.config = {
            baseUrl: 'https://openrouter.ai/api/v1',
            defaultModel: 'xiaomi/mimo-v2-flash:free',
            maxRetries: 3,
            rateLimitRpm: 60,
            ...config
        };

        this.metrics = {
            totalRequests: 0,
            totalTokens: 0,
            totalResponseTime: 0,
            errorCount: 0,
            lastRequestTime: 0
        };

        // Load existing metrics from localStorage
        this.loadMetrics();
    }

    /**
     * Send a request to OpenRouter API with retry logic and rate limiting
     */
    async sendRequest(prompt: string, config: RequestConfig): Promise<APIResponse> {
        await this.enforceRateLimit();

        const startTime = Date.now();
        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
            try {
                const response = await this.makeRequest(prompt, config);

                // Update metrics on success
                const responseTime = Date.now() - startTime;
                this.updateMetrics(response, responseTime, false);

                return response;
            } catch (error) {
                lastError = error as Error;

                // Don't retry on certain errors
                if (error instanceof RateLimitError ||
                    (error instanceof OpenRouterError && error.statusCode === 401)) {
                    throw error;
                }

                // Wait before retry with exponential backoff
                if (attempt < this.config.maxRetries) {
                    const backoffMs = Math.min(1000 * Math.pow(2, attempt), 30000);
                    await this.sleep(backoffMs);
                }
            }
        }

        // Update error metrics
        this.updateMetrics(null, Date.now() - startTime, true);
        throw lastError || new OpenRouterError('Max retries exceeded');
    }

    /**
     * Check if the configured model is available
     */
    async checkModelAvailability(): Promise<boolean> {
        try {
            const response = await fetch(`${this.config.baseUrl}/models`, {
                headers: this.getHeaders(),
                signal: AbortSignal.timeout(5000)
            });

            if (!response.ok) {
                return false;
            }

            const data = await response.json();
            return data.data?.some((model: any) => model.id === this.config.defaultModel) || false;
        } catch {
            return false;
        }
    }

    /**
     * Get current usage statistics
     */
    async getUsageStats(): Promise<UsageStats> {
        return {
            totalRequests: this.metrics.totalRequests,
            totalTokens: this.metrics.totalTokens,
            averageResponseTime: this.metrics.totalRequests > 0
                ? this.metrics.totalResponseTime / this.metrics.totalRequests
                : 0,
            errorRate: this.metrics.totalRequests > 0
                ? this.metrics.errorCount / this.metrics.totalRequests
                : 0
        };
    }

    /**
     * Make the actual HTTP request to OpenRouter API
     */
    private async makeRequest(prompt: string, config: RequestConfig): Promise<APIResponse> {
        const requestBody = {
            model: config.model || this.config.defaultModel,
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: config.maxTokens,
            temperature: config.temperature,
            stream: false
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.timeout);

        try {
            const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                await this.handleErrorResponse(response);
            }

            const data = await response.json();
            return this.validateResponse(data);
        } catch (error) {
            clearTimeout(timeoutId);

            if (error instanceof DOMException && error.name === 'AbortError') {
                throw new OpenRouterError('Request timeout', 408);
            }

            throw error;
        }
    }

    /**
     * Get HTTP headers for API requests
     */
    private getHeaders(): Record<string, string> {
        return {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': window.location.origin,
            'X-Title': 'AI Agent Orchestration Platform'
        };
    }

    /**
     * Handle error responses from the API
     */
    private async handleErrorResponse(response: Response): Promise<never> {
        const retryAfter = response.headers.get('retry-after');
        const retryAfterMs = retryAfter ? parseInt(retryAfter) * 1000 : 0;

        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

        try {
            const errorData = await response.json();
            if (errorData.error?.message) {
                errorMessage = errorData.error.message;
            }
        } catch {
            // Ignore JSON parsing errors for error responses
        }

        if (response.status === 429) {
            throw new RateLimitError(retryAfterMs || 60000);
        }

        throw new OpenRouterError(errorMessage, response.status, retryAfterMs);
    }

    /**
     * Validate API response structure
     */
    private validateResponse(data: any): APIResponse {
        if (!data || typeof data !== 'object') {
            throw new OpenRouterError('Invalid response format: not an object');
        }

        if (!data.id || typeof data.id !== 'string') {
            throw new OpenRouterError('Invalid response format: missing or invalid id');
        }

        if (!Array.isArray(data.choices) || data.choices.length === 0) {
            throw new OpenRouterError('Invalid response format: missing or empty choices array');
        }

        const choice = data.choices[0];
        if (!choice.message || typeof choice.message.content !== 'string') {
            throw new OpenRouterError('Invalid response format: missing or invalid message content');
        }

        if (!data.usage || typeof data.usage.total_tokens !== 'number') {
            throw new OpenRouterError('Invalid response format: missing or invalid usage data');
        }

        return {
            id: data.id,
            choices: data.choices.map((choice: any) => ({
                message: {
                    content: choice.message.content,
                    role: choice.message.role || 'assistant'
                },
                finish_reason: choice.finish_reason || 'stop'
            })),
            usage: {
                prompt_tokens: data.usage.prompt_tokens || 0,
                completion_tokens: data.usage.completion_tokens || 0,
                total_tokens: data.usage.total_tokens
            }
        };
    }

    /**
     * Enforce rate limiting based on requests per minute
     */
    private async enforceRateLimit(): Promise<void> {
        const now = Date.now();

        // Remove old requests outside the rate limit window
        this.requestQueue = this.requestQueue.filter(
            req => now - req.timestamp < this.rateLimitWindow
        );

        // Check if we're at the rate limit
        if (this.requestQueue.length >= this.config.rateLimitRpm) {
            const oldestRequest = this.requestQueue[0];
            const waitTime = this.rateLimitWindow - (now - oldestRequest.timestamp);

            if (waitTime > 0) {
                await this.sleep(waitTime);
                // After waiting, clean up the queue again
                const newNow = Date.now();
                this.requestQueue = this.requestQueue.filter(
                    req => newNow - req.timestamp < this.rateLimitWindow
                );
            }
        }

        // Add current request to queue
        this.requestQueue.push({ timestamp: now, resolve: () => { } });
    }

    /**
     * Update internal metrics
     */
    private updateMetrics(response: APIResponse | null, responseTime: number, isError: boolean): void {
        this.metrics.totalRequests++;
        this.metrics.totalResponseTime += responseTime;
        this.metrics.lastRequestTime = Date.now();

        if (isError) {
            this.metrics.errorCount++;
        } else if (response) {
            this.metrics.totalTokens += response.usage.total_tokens;
        }

        this.saveMetrics();
    }

    /**
     * Load metrics from localStorage
     */
    private loadMetrics(): void {
        try {
            const stored = localStorage.getItem('openrouter_metrics');
            if (stored) {
                const parsed = JSON.parse(stored);
                this.metrics = { ...this.metrics, ...parsed };
            }
        } catch {
            // Ignore errors loading metrics
        }
    }

    /**
     * Save metrics to localStorage
     */
    private saveMetrics(): void {
        try {
            localStorage.setItem('openrouter_metrics', JSON.stringify(this.metrics));
        } catch {
            // Ignore errors saving metrics
        }
    }

    /**
     * Sleep for specified milliseconds
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}