/**
 * Input Validation Service
 * Provides comprehensive input validation and sanitization
 * to prevent XSS, injection attacks, and data corruption
 */

export class ValidationError extends Error {
    constructor(message: string, public field: string, public code: string) {
        super(message);
        this.name = 'ValidationError';
    }
}

export interface ValidationRule {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    customValidator?: (value: any) => boolean | string;
    sanitizer?: (value: string) => string;
}

export interface ValidationSchema {
    [field: string]: ValidationRule;
}

export interface ValidationResult {
    isValid: boolean;
    errors: Array<{
        field: string;
        message: string;
        code: string;
    }>;
    sanitizedData: Record<string, any>;
}

export class InputValidator {
    /**
     * HTML entities for XSS prevention
     */
    private static readonly HTML_ENTITIES: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;',
        '`': '&#96;',
        '=': '&#x3D;'
    };

    /**
     * Dangerous patterns that should be blocked
     */
    private static readonly DANGEROUS_PATTERNS = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
        /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
        /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
        /javascript:/gi,
        /vbscript:/gi,
        /data:text\/html/gi,
        /on\w+\s*=/gi, // Event handlers like onclick, onload, etc.
        /expression\s*\(/gi, // CSS expressions
        /url\s*\(\s*javascript:/gi
    ];

    /**
     * SQL injection patterns
     */
    private static readonly SQL_INJECTION_PATTERNS = [
        /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
        /(--|\/\*|\*\/|;|'|"|\||&|\+)/g,
        /(\bOR\b|\bAND\b)\s+\d+\s*=\s*\d+/gi
    ];

    /**
     * Validate data against a schema
     */
    static validate(data: Record<string, any>, schema: ValidationSchema): ValidationResult {
        const errors: ValidationResult['errors'] = [];
        const sanitizedData: Record<string, any> = {};

        for (const [field, rule] of Object.entries(schema)) {
            const value = data[field];

            try {
                // Check required fields
                if (rule.required && (value === undefined || value === null || value === '')) {
                    errors.push({
                        field,
                        message: `${field} is required`,
                        code: 'REQUIRED'
                    });
                    continue;
                }

                // Skip validation for optional empty fields
                if (!rule.required && (value === undefined || value === null || value === '')) {
                    sanitizedData[field] = value;
                    continue;
                }

                // Convert to string for validation
                const stringValue = String(value);

                // Length validation
                if (rule.minLength !== undefined && stringValue.length < rule.minLength) {
                    errors.push({
                        field,
                        message: `${field} must be at least ${rule.minLength} characters long`,
                        code: 'MIN_LENGTH'
                    });
                }

                if (rule.maxLength !== undefined && stringValue.length > rule.maxLength) {
                    errors.push({
                        field,
                        message: `${field} must not exceed ${rule.maxLength} characters`,
                        code: 'MAX_LENGTH'
                    });
                }

                // Pattern validation
                if (rule.pattern && !rule.pattern.test(stringValue)) {
                    errors.push({
                        field,
                        message: `${field} format is invalid`,
                        code: 'INVALID_FORMAT'
                    });
                }

                // Custom validation
                if (rule.customValidator) {
                    const customResult = rule.customValidator(value);
                    if (customResult !== true) {
                        errors.push({
                            field,
                            message: typeof customResult === 'string' ? customResult : `${field} is invalid`,
                            code: 'CUSTOM_VALIDATION'
                        });
                    }
                }

                // Sanitize the value
                let sanitizedValue = stringValue;
                if (rule.sanitizer) {
                    sanitizedValue = rule.sanitizer(stringValue);
                } else {
                    sanitizedValue = this.sanitizeInput(stringValue);
                }

                sanitizedData[field] = sanitizedValue;

            } catch (error) {
                errors.push({
                    field,
                    message: `Validation error for ${field}: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    code: 'VALIDATION_ERROR'
                });
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
            sanitizedData
        };
    }

    /**
     * Sanitize input to prevent XSS attacks
     */
    static sanitizeInput(input: string): string {
        if (typeof input !== 'string') {
            return String(input);
        }

        // Check for dangerous patterns
        for (const pattern of this.DANGEROUS_PATTERNS) {
            if (pattern.test(input)) {
                throw new ValidationError(
                    'Input contains potentially dangerous content',
                    'input',
                    'DANGEROUS_CONTENT'
                );
            }
        }

        // HTML entity encoding
        return input.replace(/[&<>"'`=\/]/g, (match) => {
            return this.HTML_ENTITIES[match] || match;
        });
    }

    /**
     * Sanitize HTML content (more permissive than sanitizeInput)
     */
    static sanitizeHTML(html: string): string {
        if (typeof html !== 'string') {
            return String(html);
        }

        // Remove dangerous tags and attributes
        let sanitized = html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
            .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
            .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/vbscript:/gi, '')
            .replace(/on\w+\s*=/gi, '');

        return sanitized;
    }

    /**
     * Validate and sanitize API key
     */
    static validateAPIKey(apiKey: string): string {
        if (!apiKey || typeof apiKey !== 'string') {
            throw new ValidationError('API key is required', 'apiKey', 'REQUIRED');
        }

        const trimmed = apiKey.trim();

        if (trimmed.length < 20) {
            throw new ValidationError('API key is too short', 'apiKey', 'TOO_SHORT');
        }

        if (trimmed.length > 200) {
            throw new ValidationError('API key is too long', 'apiKey', 'TOO_LONG');
        }

        // Check for valid API key characters
        if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
            throw new ValidationError('API key contains invalid characters', 'apiKey', 'INVALID_CHARACTERS');
        }

        // Check for SQL injection patterns
        for (const pattern of this.SQL_INJECTION_PATTERNS) {
            if (pattern.test(trimmed)) {
                throw new ValidationError('API key contains suspicious patterns', 'apiKey', 'SUSPICIOUS_CONTENT');
            }
        }

        return trimmed;
    }

    /**
     * Validate agent name
     */
    static validateAgentName(name: string): string {
        if (!name || typeof name !== 'string') {
            throw new ValidationError('Agent name is required', 'name', 'REQUIRED');
        }

        const trimmed = name.trim();

        if (trimmed.length < 1) {
            throw new ValidationError('Agent name cannot be empty', 'name', 'EMPTY');
        }

        if (trimmed.length > 100) {
            throw new ValidationError('Agent name is too long (max 100 characters)', 'name', 'TOO_LONG');
        }

        // Allow alphanumeric, spaces, hyphens, underscores
        if (!/^[a-zA-Z0-9\s\-_]+$/.test(trimmed)) {
            throw new ValidationError('Agent name contains invalid characters', 'name', 'INVALID_CHARACTERS');
        }

        return this.sanitizeInput(trimmed);
    }

    /**
     * Validate prompt template
     */
    static validatePromptTemplate(prompt: string): string {
        if (!prompt || typeof prompt !== 'string') {
            throw new ValidationError('Prompt template is required', 'promptTemplate', 'REQUIRED');
        }

        const trimmed = prompt.trim();

        if (trimmed.length < 10) {
            throw new ValidationError('Prompt template is too short (min 10 characters)', 'promptTemplate', 'TOO_SHORT');
        }

        if (trimmed.length > 5000) {
            throw new ValidationError('Prompt template is too long (max 5000 characters)', 'promptTemplate', 'TOO_LONG');
        }

        return this.sanitizeHTML(trimmed);
    }

    /**
     * Validate workflow name
     */
    static validateWorkflowName(name: string): string {
        if (!name || typeof name !== 'string') {
            throw new ValidationError('Workflow name is required', 'name', 'REQUIRED');
        }

        const trimmed = name.trim();

        if (trimmed.length < 1) {
            throw new ValidationError('Workflow name cannot be empty', 'name', 'EMPTY');
        }

        if (trimmed.length > 100) {
            throw new ValidationError('Workflow name is too long (max 100 characters)', 'name', 'TOO_LONG');
        }

        return this.sanitizeInput(trimmed);
    }

    /**
     * Validate task prompt
     */
    static validateTaskPrompt(prompt: string): string {
        if (!prompt || typeof prompt !== 'string') {
            throw new ValidationError('Task prompt is required', 'prompt', 'REQUIRED');
        }

        const trimmed = prompt.trim();

        if (trimmed.length < 5) {
            throw new ValidationError('Task prompt is too short (min 5 characters)', 'prompt', 'TOO_SHORT');
        }

        if (trimmed.length > 2000) {
            throw new ValidationError('Task prompt is too long (max 2000 characters)', 'prompt', 'TOO_LONG');
        }

        return this.sanitizeHTML(trimmed);
    }

    /**
     * Validate numeric input
     */
    static validateNumber(
        value: any,
        field: string,
        options: { min?: number; max?: number; integer?: boolean } = {}
    ): number {
        const num = Number(value);

        if (isNaN(num)) {
            throw new ValidationError(`${field} must be a valid number`, field, 'INVALID_NUMBER');
        }

        if (options.integer && !Number.isInteger(num)) {
            throw new ValidationError(`${field} must be an integer`, field, 'NOT_INTEGER');
        }

        if (options.min !== undefined && num < options.min) {
            throw new ValidationError(`${field} must be at least ${options.min}`, field, 'TOO_SMALL');
        }

        if (options.max !== undefined && num > options.max) {
            throw new ValidationError(`${field} must not exceed ${options.max}`, field, 'TOO_LARGE');
        }

        return num;
    }

    /**
     * Validate URL
     */
    static validateURL(url: string, field: string = 'url'): string {
        if (!url || typeof url !== 'string') {
            throw new ValidationError(`${field} is required`, field, 'REQUIRED');
        }

        const trimmed = url.trim();

        try {
            const urlObj = new URL(trimmed);

            // Only allow HTTP and HTTPS protocols
            if (!['http:', 'https:'].includes(urlObj.protocol)) {
                throw new ValidationError(`${field} must use HTTP or HTTPS protocol`, field, 'INVALID_PROTOCOL');
            }

            return trimmed;
        } catch {
            throw new ValidationError(`${field} is not a valid URL`, field, 'INVALID_URL');
        }
    }

    /**
     * Validate email address
     */
    static validateEmail(email: string): string {
        if (!email || typeof email !== 'string') {
            throw new ValidationError('Email is required', 'email', 'REQUIRED');
        }

        const trimmed = email.trim().toLowerCase();
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailPattern.test(trimmed)) {
            throw new ValidationError('Email format is invalid', 'email', 'INVALID_FORMAT');
        }

        if (trimmed.length > 254) {
            throw new ValidationError('Email is too long', 'email', 'TOO_LONG');
        }

        return trimmed;
    }

    /**
     * Validate JSON string
     */
    static validateJSON(jsonString: string, field: string = 'json'): any {
        if (!jsonString || typeof jsonString !== 'string') {
            throw new ValidationError(`${field} is required`, field, 'REQUIRED');
        }

        try {
            return JSON.parse(jsonString);
        } catch {
            throw new ValidationError(`${field} is not valid JSON`, field, 'INVALID_JSON');
        }
    }

    /**
     * Create validation schema for common entities
     */
    static getAgentValidationSchema(): ValidationSchema {
        return {
            name: {
                required: true,
                minLength: 1,
                maxLength: 100,
                pattern: /^[a-zA-Z0-9\s\-_]+$/,
                sanitizer: this.sanitizeInput
            },
            role: {
                required: true,
                minLength: 1,
                maxLength: 100,
                sanitizer: this.sanitizeInput
            },
            promptTemplate: {
                required: true,
                minLength: 10,
                maxLength: 5000,
                sanitizer: this.sanitizeHTML
            },
            maxTokens: {
                required: true,
                customValidator: (value) => {
                    const num = Number(value);
                    return !isNaN(num) && num >= 1 && num <= 4000 && Number.isInteger(num);
                }
            },
            temperature: {
                required: true,
                customValidator: (value) => {
                    const num = Number(value);
                    return !isNaN(num) && num >= 0 && num <= 2;
                }
            }
        };
    }

    /**
     * Create validation schema for workflows
     */
    static getWorkflowValidationSchema(): ValidationSchema {
        return {
            name: {
                required: true,
                minLength: 1,
                maxLength: 100,
                sanitizer: this.sanitizeInput
            },
            description: {
                required: false,
                maxLength: 500,
                sanitizer: this.sanitizeHTML
            }
        };
    }

    /**
     * Create validation schema for tasks
     */
    static getTaskValidationSchema(): ValidationSchema {
        return {
            prompt: {
                required: true,
                minLength: 5,
                maxLength: 2000,
                sanitizer: this.sanitizeHTML
            },
            priority: {
                required: true,
                customValidator: (value) => {
                    const num = Number(value);
                    return !isNaN(num) && num >= 1 && num <= 10 && Number.isInteger(num);
                }
            }
        };
    }
}