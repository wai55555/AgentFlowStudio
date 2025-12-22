/**
 * Error Notifications Component
 * Displays user-friendly error notifications with actions
 */

import React, { useState, useEffect } from 'react';
import { errorHandler, UserNotification } from '../services/errorHandler';

interface ErrorNotificationsProps {
    className?: string;
    maxNotifications?: number;
}

export const ErrorNotifications: React.FC<ErrorNotificationsProps> = ({
    className = '',
    maxNotifications = 5
}) => {
    const [notifications, setNotifications] = useState<UserNotification[]>([]);

    useEffect(() => {
        // Load existing notifications
        setNotifications(errorHandler.getNotifications().slice(0, maxNotifications));

        // Subscribe to new notifications
        const unsubscribe = errorHandler.onNotification((notification) => {
            setNotifications(prev => {
                const updated = [notification, ...prev.filter(n => n.id !== notification.id)];
                return updated.slice(0, maxNotifications);
            });
        });

        return unsubscribe;
    }, [maxNotifications]);

    const handleDismiss = (notificationId: string) => {
        errorHandler.dismissNotification(notificationId);
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
    };

    const handleAction = (action: () => void, notificationId: string) => {
        action();
        handleDismiss(notificationId);
    };

    if (notifications.length === 0) {
        return null;
    }

    return (
        <div className={`error-notifications ${className}`}>
            {notifications.map(notification => (
                <div
                    key={notification.id}
                    className={`notification notification-${notification.level}`}
                    role="alert"
                    aria-live="polite"
                >
                    <div className="notification-content">
                        <div className="notification-header">
                            <h4 className="notification-title">{notification.title}</h4>
                            <button
                                className="notification-close"
                                onClick={() => handleDismiss(notification.id)}
                                aria-label="Dismiss notification"
                            >
                                ×
                            </button>
                        </div>
                        <p className="notification-message">{notification.message}</p>
                        <div className="notification-timestamp">
                            {notification.timestamp.toLocaleTimeString()}
                        </div>
                        {notification.actions && notification.actions.length > 0 && (
                            <div className="notification-actions">
                                {notification.actions.map((action, index) => (
                                    <button
                                        key={index}
                                        className="notification-action"
                                        onClick={() => handleAction(action.action, notification.id)}
                                    >
                                        {action.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ErrorNotifications;