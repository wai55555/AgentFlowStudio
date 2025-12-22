/**
 * Keyboard Shortcuts Service
 * Manages global keyboard shortcuts and accessibility features
 */

interface ShortcutConfig {
    key: string;
    ctrlKey?: boolean;
    altKey?: boolean;
    shiftKey?: boolean;
    metaKey?: boolean;
    description: string;
    action: () => void;
    category: string;
    enabled: boolean;
}

interface ShortcutCategory {
    name: string;
    shortcuts: ShortcutConfig[];
}

class KeyboardShortcutsService {
    private shortcuts: Map<string, ShortcutConfig> = new Map();
    private isEnabled = true;
    private helpModalVisible = false;

    constructor() {
        this.initialize();
        this.setupEventListeners();
    }

    private initialize(): void {
        // Register default shortcuts
        this.registerDefaultShortcuts();
    }

    private registerDefaultShortcuts(): void {
        // Navigation shortcuts
        this.register({
            key: '1',
            altKey: true,
            description: 'Go to Dashboard',
            action: () => this.triggerNavigation('dashboard'),
            category: 'Navigation',
            enabled: true
        });

        this.register({
            key: '2',
            altKey: true,
            description: 'Go to Agents',
            action: () => this.triggerNavigation('agents'),
            category: 'Navigation',
            enabled: true
        });

        this.register({
            key: '3',
            altKey: true,
            description: 'Go to Workflows',
            action: () => this.triggerNavigation('workflows'),
            category: 'Navigation',
            enabled: true
        });

        this.register({
            key: '4',
            altKey: true,
            description: 'Go to Monitor',
            action: () => this.triggerNavigation('monitor'),
            category: 'Navigation',
            enabled: true
        });

        // Action shortcuts
        this.register({
            key: 'n',
            ctrlKey: true,
            description: 'Create New Agent',
            action: () => this.triggerAction('create-agent'),
            category: 'Actions',
            enabled: true
        });

        this.register({
            key: 't',
            ctrlKey: true,
            description: 'Create New Task',
            action: () => this.triggerAction('create-task'),
            category: 'Actions',
            enabled: true
        });

        this.register({
            key: 'w',
            ctrlKey: true,
            description: 'Create New Workflow',
            action: () => this.triggerAction('create-workflow'),
            category: 'Actions',
            enabled: true
        });

        // Search and filter shortcuts
        this.register({
            key: 'f',
            ctrlKey: true,
            description: 'Focus Search',
            action: () => this.focusSearch(),
            category: 'Search',
            enabled: true
        });

        this.register({
            key: 'k',
            ctrlKey: true,
            description: 'Command Palette',
            action: () => this.showCommandPalette(),
            category: 'Search',
            enabled: true
        });

        // Accessibility shortcuts
        this.register({
            key: '?',
            description: 'Show Keyboard Shortcuts',
            action: () => this.showHelp(),
            category: 'Help',
            enabled: true
        });

        this.register({
            key: 'Escape',
            description: 'Close Modal/Return to Dashboard',
            action: () => this.handleEscape(),
            category: 'Navigation',
            enabled: true
        });

        // System shortcuts
        this.register({
            key: 'r',
            ctrlKey: true,
            shiftKey: true,
            description: 'Refresh Data',
            action: () => this.refreshData(),
            category: 'System',
            enabled: true
        });

        this.register({
            key: 's',
            ctrlKey: true,
            description: 'Save Configuration',
            action: () => this.saveConfiguration(),
            category: 'System',
            enabled: true
        });
    }

    private setupEventListeners(): void {
        document.addEventListener('keydown', this.handleKeyDown.bind(this));

        // Handle focus management
        document.addEventListener('focusin', this.handleFocusIn.bind(this));
        document.addEventListener('focusout', this.handleFocusOut.bind(this));
    }

    private handleKeyDown(event: KeyboardEvent): void {
        if (!this.isEnabled) return;

        // Don't handle shortcuts when typing in input fields
        if (this.isInputFocused(event.target)) return;

        const shortcutKey = this.getShortcutKey(event);
        const shortcut = this.shortcuts.get(shortcutKey);

        if (shortcut && shortcut.enabled) {
            event.preventDefault();
            event.stopPropagation();
            shortcut.action();
        }
    }

    private handleFocusIn(event: FocusEvent): void {
        const target = event.target as HTMLElement;

        // Add focus ring for keyboard navigation
        if (target && this.isKeyboardNavigation()) {
            target.classList.add('keyboard-focus');
        }
    }

    private handleFocusOut(event: FocusEvent): void {
        const target = event.target as HTMLElement;

        if (target) {
            target.classList.remove('keyboard-focus');
        }
    }

    private isInputFocused(target: EventTarget | null): boolean {
        if (!target) return false;

        const element = target as HTMLElement;
        const tagName = element.tagName.toLowerCase();

        return (
            tagName === 'input' ||
            tagName === 'textarea' ||
            tagName === 'select' ||
            element.contentEditable === 'true' ||
            element.getAttribute('role') === 'textbox'
        );
    }

    private isKeyboardNavigation(): boolean {
        // Simple heuristic to detect keyboard navigation
        return document.body.classList.contains('keyboard-navigation') ||
            !document.body.classList.contains('mouse-navigation');
    }

    private getShortcutKey(event: KeyboardEvent): string {
        const parts = [];

        if (event.ctrlKey) parts.push('ctrl');
        if (event.altKey) parts.push('alt');
        if (event.shiftKey) parts.push('shift');
        if (event.metaKey) parts.push('meta');

        parts.push(event.key.toLowerCase());

        return parts.join('+');
    }

    private triggerNavigation(view: string): void {
        // Dispatch custom event for navigation
        const event = new CustomEvent('navigate', { detail: { view } });
        document.dispatchEvent(event);
    }

    private triggerAction(action: string): void {
        // Dispatch custom event for actions
        const event = new CustomEvent('shortcut-action', { detail: { action } });
        document.dispatchEvent(event);
    }

    private focusSearch(): void {
        const searchInput = document.querySelector('.search-input') as HTMLInputElement;
        if (searchInput) {
            searchInput.focus();
            searchInput.select();
        }
    }

    private showCommandPalette(): void {
        // Create and show command palette
        this.createCommandPalette();
    }

    private createCommandPalette(): void {
        // Remove existing palette
        const existing = document.querySelector('.command-palette');
        if (existing) {
            existing.remove();
            return;
        }

        const palette = document.createElement('div');
        palette.className = 'command-palette';
        palette.innerHTML = `
            <div class="command-palette-backdrop"></div>
            <div class="command-palette-content">
                <div class="command-palette-header">
                    <input type="text" class="command-palette-input" placeholder="Type a command..." />
                    <button class="command-palette-close" aria-label="Close">×</button>
                </div>
                <div class="command-palette-results">
                    ${this.generateCommandList()}
                </div>
            </div>
        `;

        document.body.appendChild(palette);

        // Focus input
        const input = palette.querySelector('.command-palette-input') as HTMLInputElement;
        input.focus();

        // Setup event listeners
        this.setupCommandPaletteEvents(palette, input);
    }

    private generateCommandList(): string {
        const categories = this.getShortcutsByCategory();

        return categories.map(category => `
            <div class="command-category">
                <h3>${category.name}</h3>
                ${category.shortcuts.map(shortcut => `
                    <div class="command-item" data-action="${shortcut.description}">
                        <span class="command-description">${shortcut.description}</span>
                        <span class="command-shortcut">${this.formatShortcut(shortcut)}</span>
                    </div>
                `).join('')}
            </div>
        `).join('');
    }

    private setupCommandPaletteEvents(palette: HTMLElement, input: HTMLInputElement): void {
        const close = () => palette.remove();

        // Close on backdrop click
        palette.querySelector('.command-palette-backdrop')?.addEventListener('click', close);

        // Close on close button
        palette.querySelector('.command-palette-close')?.addEventListener('click', close);

        // Close on escape
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                close();
            }
        });

        // Filter commands
        input.addEventListener('input', (e) => {
            const query = (e.target as HTMLInputElement).value.toLowerCase();
            this.filterCommands(palette, query);
        });

        // Handle command selection
        palette.addEventListener('click', (e) => {
            const item = (e.target as HTMLElement).closest('.command-item');
            if (item) {
                const action = item.getAttribute('data-action');
                if (action) {
                    this.executeCommandByDescription(action);
                    close();
                }
            }
        });
    }

    private filterCommands(palette: HTMLElement, query: string): void {
        const items = palette.querySelectorAll('.command-item');
        items.forEach(item => {
            const description = item.querySelector('.command-description')?.textContent?.toLowerCase() || '';
            const visible = description.includes(query);
            (item as HTMLElement).style.display = visible ? 'flex' : 'none';
        });
    }

    private executeCommandByDescription(description: string): void {
        for (const [, shortcut] of this.shortcuts) {
            if (shortcut.description === description) {
                shortcut.action();
                break;
            }
        }
    }

    private showHelp(): void {
        if (this.helpModalVisible) {
            this.hideHelp();
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'shortcuts-help-modal';
        modal.innerHTML = `
            <div class="shortcuts-help-backdrop"></div>
            <div class="shortcuts-help-content">
                <div class="shortcuts-help-header">
                    <h2>Keyboard Shortcuts</h2>
                    <button class="shortcuts-help-close" aria-label="Close">×</button>
                </div>
                <div class="shortcuts-help-body">
                    ${this.generateHelpContent()}
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.helpModalVisible = true;

        // Setup close events
        modal.querySelector('.shortcuts-help-backdrop')?.addEventListener('click', () => this.hideHelp());
        modal.querySelector('.shortcuts-help-close')?.addEventListener('click', () => this.hideHelp());

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.helpModalVisible) {
                this.hideHelp();
            }
        });
    }

    private hideHelp(): void {
        const modal = document.querySelector('.shortcuts-help-modal');
        if (modal) {
            modal.remove();
            this.helpModalVisible = false;
        }
    }

    private generateHelpContent(): string {
        const categories = this.getShortcutsByCategory();

        return categories.map(category => `
            <div class="shortcuts-category">
                <h3>${category.name}</h3>
                <div class="shortcuts-list">
                    ${category.shortcuts.map(shortcut => `
                        <div class="shortcut-item">
                            <span class="shortcut-description">${shortcut.description}</span>
                            <kbd class="shortcut-keys">${this.formatShortcut(shortcut)}</kbd>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    }

    private formatShortcut(shortcut: ShortcutConfig): string {
        const parts = [];

        if (shortcut.ctrlKey) parts.push('Ctrl');
        if (shortcut.altKey) parts.push('Alt');
        if (shortcut.shiftKey) parts.push('Shift');
        if (shortcut.metaKey) parts.push('Cmd');

        parts.push(shortcut.key.toUpperCase());

        return parts.join(' + ');
    }

    private getShortcutsByCategory(): ShortcutCategory[] {
        const categories: { [key: string]: ShortcutConfig[] } = {};

        for (const [, shortcut] of this.shortcuts) {
            if (!categories[shortcut.category]) {
                categories[shortcut.category] = [];
            }
            categories[shortcut.category].push(shortcut);
        }

        return Object.entries(categories).map(([name, shortcuts]) => ({
            name,
            shortcuts: shortcuts.filter(s => s.enabled)
        }));
    }

    private handleEscape(): void {
        // Close any open modals
        const modals = document.querySelectorAll('.modal-overlay, .command-palette, .shortcuts-help-modal');
        if (modals.length > 0) {
            modals.forEach(modal => modal.remove());
        } else {
            // Return to dashboard
            this.triggerNavigation('dashboard');
        }
    }

    private refreshData(): void {
        const event = new CustomEvent('refresh-data');
        document.dispatchEvent(event);
    }

    private saveConfiguration(): void {
        const event = new CustomEvent('save-configuration');
        document.dispatchEvent(event);
    }

    // Public methods
    public register(config: Omit<ShortcutConfig, 'enabled'> & { enabled?: boolean }): void {
        const shortcutKey = this.getShortcutKeyFromConfig(config);
        this.shortcuts.set(shortcutKey, {
            ...config,
            enabled: config.enabled ?? true
        });
    }

    private getShortcutKeyFromConfig(config: Partial<ShortcutConfig>): string {
        const parts = [];

        if (config.ctrlKey) parts.push('ctrl');
        if (config.altKey) parts.push('alt');
        if (config.shiftKey) parts.push('shift');
        if (config.metaKey) parts.push('meta');

        parts.push(config.key?.toLowerCase() || '');

        return parts.join('+');
    }

    public unregister(key: string, modifiers: Partial<Pick<ShortcutConfig, 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'>> = {}): void {
        const shortcutKey = this.getShortcutKeyFromConfig({ key, ...modifiers });
        this.shortcuts.delete(shortcutKey);
    }

    public enable(): void {
        this.isEnabled = true;
    }

    public disable(): void {
        this.isEnabled = false;
    }

    public getShortcuts(): ShortcutConfig[] {
        return Array.from(this.shortcuts.values());
    }

    public destroy(): void {
        document.removeEventListener('keydown', this.handleKeyDown.bind(this));
        document.removeEventListener('focusin', this.handleFocusIn.bind(this));
        document.removeEventListener('focusout', this.handleFocusOut.bind(this));

        this.shortcuts.clear();
        this.hideHelp();

        // Remove command palette if open
        const palette = document.querySelector('.command-palette');
        if (palette) {
            palette.remove();
        }
    }
}

// Create singleton instance
export const keyboardShortcuts = new KeyboardShortcutsService();

// Export types and class for advanced usage
export type { ShortcutConfig, ShortcutCategory };
export { KeyboardShortcutsService };