/**
 * API Client interfaces for OpenRouter integration
 */

export interface RequestConfig {
    model: string;
    maxTokens: number;
    temperature: number;
    timeout: number;
}

export interface APIResponse {
    id: string;
    choices: Array<{
        message: {
            content: string;
            role: string;
        };
        finish_reason: string;
    }>;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

export interface UsageStats {
    totalRequests: number;
    totalTokens: number;
    averageResponseTime: number;
    errorRate: number;
}

export interface APIClient {
    sendRequest(prompt: string, config: RequestConfig): Promise<APIResponse>;
    checkModelAvailability(): Promise<boolean>;
    getUsageStats(): Promise<UsageStats>;
}