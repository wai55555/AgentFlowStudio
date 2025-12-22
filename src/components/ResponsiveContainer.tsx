/**
 * Responsive Container Component
 * Provides responsive layout utilities and mobile optimization
 */

import React, { useState, useEffect, ReactNode } from 'react';

interface ResponsiveContainerProps {
    children: ReactNode;
    className?: string;
    breakpoint?: 'mobile' | 'tablet' | 'desktop';
    enableVirtualization?: boolean;
}

interface ViewportInfo {
    width: number;
    height: number;
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
    orientation: 'portrait' | 'landscape';
}

const ResponsiveContainer: React.FC<ResponsiveContainerProps> = ({
    children,
    className = '',
    breakpoint,
    enableVirtualization = false
}) => {
    const [viewport, setViewport] = useState<ViewportInfo>({
        width: window.innerWidth,
        height: window.innerHeight,
        isMobile: window.innerWidth <= 768,
        isTablet: window.innerWidth > 768 && window.innerWidth <= 1024,
        isDesktop: window.innerWidth > 1024,
        orientation: window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
    });

    useEffect(() => {
        const updateViewport = () => {
            const width = window.innerWidth;
            const height = window.innerHeight;

            setViewport({
                width,
                height,
                isMobile: width <= 768,
                isTablet: width > 768 && width <= 1024,
                isDesktop: width > 1024,
                orientation: width > height ? 'landscape' : 'portrait'
            });
        };

        // Throttle resize events for performance
        let timeoutId: number;
        const throttledResize = () => {
            clearTimeout(timeoutId);
            timeoutId = window.setTimeout(updateViewport, 100);
        };

        window.addEventListener('resize', throttledResize);
        window.addEventListener('orientationchange', updateViewport);

        return () => {
            window.removeEventListener('resize', throttledResize);
            window.removeEventListener('orientationchange', updateViewport);
            clearTimeout(timeoutId);
        };
    }, []);

    // Apply responsive classes based on viewport
    const getResponsiveClasses = (): string => {
        const classes = [className];

        if (viewport.isMobile) classes.push('responsive-mobile');
        if (viewport.isTablet) classes.push('responsive-tablet');
        if (viewport.isDesktop) classes.push('responsive-desktop');
        if (viewport.orientation === 'landscape') classes.push('responsive-landscape');
        if (viewport.orientation === 'portrait') classes.push('responsive-portrait');

        if (breakpoint) {
            classes.push(`responsive-breakpoint-${breakpoint}`);
        }

        if (enableVirtualization) {
            classes.push('responsive-virtualized');
        }

        return classes.filter(Boolean).join(' ');
    };

    // Hide content if breakpoint doesn't match
    const shouldRender = (): boolean => {
        if (!breakpoint) return true;

        switch (breakpoint) {
            case 'mobile':
                return viewport.isMobile;
            case 'tablet':
                return viewport.isTablet;
            case 'desktop':
                return viewport.isDesktop;
            default:
                return true;
        }
    };

    if (!shouldRender()) {
        return null;
    }

    return (
        <div
            className={getResponsiveClasses()}
            data-viewport-width={viewport.width}
            data-viewport-height={viewport.height}
            data-orientation={viewport.orientation}
            style={{
                '--viewport-width': `${viewport.width}px`,
                '--viewport-height': `${viewport.height}px`,
            } as React.CSSProperties}
        >
            {children}
        </div>
    );
};

// Hook for accessing viewport information
export const useViewport = (): ViewportInfo => {
    const [viewport, setViewport] = useState<ViewportInfo>({
        width: window.innerWidth,
        height: window.innerHeight,
        isMobile: window.innerWidth <= 768,
        isTablet: window.innerWidth > 768 && window.innerWidth <= 1024,
        isDesktop: window.innerWidth > 1024,
        orientation: window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
    });

    useEffect(() => {
        const updateViewport = () => {
            const width = window.innerWidth;
            const height = window.innerHeight;

            setViewport({
                width,
                height,
                isMobile: width <= 768,
                isTablet: width > 768 && width <= 1024,
                isDesktop: width > 1024,
                orientation: width > height ? 'landscape' : 'portrait'
            });
        };

        let timeoutId: number;
        const throttledResize = () => {
            clearTimeout(timeoutId);
            timeoutId = window.setTimeout(updateViewport, 100);
        };

        window.addEventListener('resize', throttledResize);
        window.addEventListener('orientationchange', updateViewport);

        return () => {
            window.removeEventListener('resize', throttledResize);
            window.removeEventListener('orientationchange', updateViewport);
            clearTimeout(timeoutId);
        };
    }, []);

    return viewport;
};

export default ResponsiveContainer;