/**
 * Performance Optimizer Service
 * Handles memory management, performance monitoring, and optimization
 */

interface PerformanceMetrics {
    memoryUsage: number;
    renderTime: number;
    componentCount: number;
    eventListeners: number;
    storageSize: number;
}

interface OptimizationConfig {
    maxMemoryUsage: number; // MB
    maxRenderTime: number; // ms
    cleanupInterval: number; // ms
    enableVirtualization: boolean;
    enableLazyLoading: boolean;
}

class PerformanceOptimizer {
    private config: OptimizationConfig;
    private metrics: PerformanceMetrics;
    private cleanupTimer: number | null = null;
    private observers: PerformanceObserver[] = [];
    private memoryWarningThreshold = 0.8; // 80% of max memory

    constructor(config: Partial<OptimizationConfig> = {}) {
        this.config = {
            maxMemoryUsage: 100, // 100MB default
            maxRenderTime: 16, // 60fps target
            cleanupInterval: 30000, // 30 seconds
            enableVirtualization: true,
            enableLazyLoading: true,
            ...config
        };

        this.metrics = {
            memoryUsage: 0,
            renderTime: 0,
            componentCount: 0,
            eventListeners: 0,
            storageSize: 0
        };

        this.initialize();
    }

    private initialize(): void {
        this.startPerformanceMonitoring();
        this.startMemoryMonitoring();
        this.startCleanupTimer();
        this.setupEventListenerTracking();
    }

    private startPerformanceMonitoring(): void {
        if ('PerformanceObserver' in window) {
            // Monitor paint timing
            const paintObserver = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                entries.forEach((entry) => {
                    if (entry.name === 'first-contentful-paint') {
                        this.metrics.renderTime = entry.startTime;
                    }
                });
            });

            try {
                paintObserver.observe({ entryTypes: ['paint'] });
                this.observers.push(paintObserver);
            } catch (e) {
                console.warn('Paint timing not supported');
            }

            // Monitor long tasks
            const longTaskObserver = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                entries.forEach((entry) => {
                    if (entry.duration > 50) { // Tasks longer than 50ms
                        console.warn(`Long task detected: ${entry.duration}ms`);
                        this.optimizePerformance();
                    }
                });
            });

            try {
                longTaskObserver.observe({ entryTypes: ['longtask'] });
                this.observers.push(longTaskObserver);
            } catch (e) {
                console.warn('Long task monitoring not supported');
            }
        }
    }

    private startMemoryMonitoring(): void {
        const checkMemory = () => {
            if ('memory' in performance) {
                const memory = (performance as any).memory;
                this.metrics.memoryUsage = memory.usedJSHeapSize / (1024 * 1024); // Convert to MB

                if (this.metrics.memoryUsage > this.config.maxMemoryUsage * this.memoryWarningThreshold) {
                    console.warn(`High memory usage detected: ${this.metrics.memoryUsage.toFixed(2)}MB`);
                    this.performMemoryCleanup();
                }
            }

            // Check storage usage
            this.checkStorageUsage();
        };

        // Check memory every 10 seconds
        setInterval(checkMemory, 10000);
        checkMemory(); // Initial check
    }

    private checkStorageUsage(): void {
        try {
            let totalSize = 0;

            // Check localStorage
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    totalSize += localStorage[key].length;
                }
            }

            this.metrics.storageSize = totalSize / (1024 * 1024); // Convert to MB

            // Warn if storage is getting full (>4MB for localStorage)
            if (this.metrics.storageSize > 4) {
                console.warn(`High storage usage: ${this.metrics.storageSize.toFixed(2)}MB`);
                this.optimizeStorage();
            }
        } catch (e) {
            console.warn('Could not check storage usage:', e);
        }
    }

    private startCleanupTimer(): void {
        this.cleanupTimer = window.setInterval(() => {
            this.performRoutineCleanup();
        }, this.config.cleanupInterval);
    }

    private setupEventListenerTracking(): void {
        // Track event listeners to prevent memory leaks
        const originalAddEventListener = EventTarget.prototype.addEventListener;
        const originalRemoveEventListener = EventTarget.prototype.removeEventListener;

        let listenerCount = 0;

        EventTarget.prototype.addEventListener = function (type, listener, options) {
            listenerCount++;
            return originalAddEventListener.call(this, type, listener, options);
        };

        EventTarget.prototype.removeEventListener = function (type, listener, options) {
            listenerCount--;
            return originalRemoveEventListener.call(this, type, listener, options);
        };

        // Update metrics periodically
        setInterval(() => {
            this.metrics.eventListeners = listenerCount;
        }, 5000);
    }

    private optimizePerformance(): void {
        // Defer non-critical operations
        this.deferNonCriticalOperations();

        // Optimize DOM operations
        this.optimizeDOMOperations();

        // Clean up unused resources
        this.performMemoryCleanup();
    }

    private deferNonCriticalOperations(): void {
        // Use requestIdleCallback for non-critical operations
        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => {
                this.performRoutineCleanup();
            });
        } else {
            // Fallback for browsers without requestIdleCallback
            setTimeout(() => {
                this.performRoutineCleanup();
            }, 100);
        }
    }

    private optimizeDOMOperations(): void {
        // Batch DOM operations
        const elementsToOptimize = document.querySelectorAll('[data-optimize]');

        if (elementsToOptimize.length > 0) {
            // Use DocumentFragment for batch operations
            const fragment = document.createDocumentFragment();

            elementsToOptimize.forEach((element) => {
                // Move elements to fragment for batch processing
                if (element.parentNode) {
                    fragment.appendChild(element);
                }
            });

            // Re-append optimized elements
            document.body.appendChild(fragment);
        }
    }

    private performMemoryCleanup(): void {
        // Clear unused caches
        this.clearUnusedCaches();

        // Trigger garbage collection if available
        if ('gc' in window) {
            (window as any).gc();
        }

        // Clean up event listeners
        this.cleanupEventListeners();
    }

    private clearUnusedCaches(): void {
        // Clear browser caches if possible
        if ('caches' in window) {
            caches.keys().then((cacheNames) => {
                cacheNames.forEach((cacheName) => {
                    if (cacheName.includes('old') || cacheName.includes('temp')) {
                        caches.delete(cacheName);
                    }
                });
            });
        }
    }

    private cleanupEventListeners(): void {
        // Remove orphaned event listeners
        const elements = document.querySelectorAll('[data-cleanup-listeners]');
        elements.forEach((element) => {
            // Clone and replace element to remove all event listeners
            const newElement = element.cloneNode(true);
            element.parentNode?.replaceChild(newElement, element);
        });
    }

    private optimizeStorage(): void {
        try {
            // Compress large localStorage items
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    const value = localStorage[key];
                    if (value.length > 10000) { // Items larger than 10KB
                        try {
                            // Simple compression by removing whitespace from JSON
                            const parsed = JSON.parse(value);
                            const compressed = JSON.stringify(parsed);
                            if (compressed.length < value.length) {
                                localStorage.setItem(key, compressed);
                            }
                        } catch (e) {
                            // Not JSON, skip compression
                        }
                    }
                }
            }

            // Remove old or unused items
            this.cleanupOldStorageItems();
        } catch (e) {
            console.warn('Storage optimization failed:', e);
        }
    }

    private cleanupOldStorageItems(): void {
        const now = Date.now();
        const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                try {
                    const item = JSON.parse(localStorage[key]);
                    if (item.timestamp && (now - item.timestamp) > maxAge) {
                        localStorage.removeItem(key);
                    }
                } catch (e) {
                    // Not a timestamped item, skip
                }
            }
        }
    }

    private performRoutineCleanup(): void {
        // Clean up temporary DOM elements
        const tempElements = document.querySelectorAll('[data-temp]');
        tempElements.forEach((element) => {
            element.remove();
        });

        // Clean up unused CSS classes
        this.cleanupUnusedStyles();

        // Update component count
        this.metrics.componentCount = document.querySelectorAll('[data-component]').length;
    }

    private cleanupUnusedStyles(): void {
        // Remove unused CSS classes from elements
        const elements = document.querySelectorAll('*');
        elements.forEach((element) => {
            const classes = Array.from(element.classList);
            classes.forEach((className) => {
                if (className.startsWith('temp-') || className.startsWith('old-')) {
                    element.classList.remove(className);
                }
            });
        });
    }

    // Public methods
    public getMetrics(): PerformanceMetrics {
        return { ...this.metrics };
    }

    public updateConfig(newConfig: Partial<OptimizationConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }

    public forceCleanup(): void {
        this.performMemoryCleanup();
        this.performRoutineCleanup();
    }

    public enableVirtualization(): void {
        this.config.enableVirtualization = true;
        // Add virtualization logic here
    }

    public disableVirtualization(): void {
        this.config.enableVirtualization = false;
    }

    public enableLazyLoading(): void {
        this.config.enableLazyLoading = true;
        this.setupLazyLoading();
    }

    private setupLazyLoading(): void {
        if ('IntersectionObserver' in window) {
            const lazyObserver = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const element = entry.target as HTMLElement;

                        // Load lazy content
                        if (element.dataset.lazySrc) {
                            if (element instanceof HTMLImageElement) {
                                element.src = element.dataset.lazySrc;
                            }
                        }

                        // Load lazy components
                        if (element.dataset.lazyComponent) {
                            element.classList.add('lazy-loaded');
                        }

                        lazyObserver.unobserve(element);
                    }
                });
            }, {
                rootMargin: '50px'
            });

            // Observe all lazy elements
            document.querySelectorAll('[data-lazy]').forEach((element) => {
                lazyObserver.observe(element);
            });
        }
    }

    public destroy(): void {
        // Clean up observers
        this.observers.forEach((observer) => {
            observer.disconnect();
        });
        this.observers = [];

        // Clear cleanup timer
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }

        // Final cleanup
        this.forceCleanup();
    }
}

// Create singleton instance
export const performanceOptimizer = new PerformanceOptimizer();

// Export types and class for advanced usage
export type { PerformanceMetrics, OptimizationConfig };
export { PerformanceOptimizer };