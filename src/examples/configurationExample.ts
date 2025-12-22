/**
 * Example usage of Configuration Manager
 * Demonstrates save/load, export/import, validation, and backup/restore functionality
 */

import { ConfigurationManager } from '../services/configurationManager';
// import type { Agent, Workflow, SystemSettings } from '../types';

async function demonstrateConfigurationManagement() {
    const configManager = new ConfigurationManager();

    try {
        // Example 1: Save current configuration
        console.log('1. Saving current configuration...');
        await configManager.saveConfiguration();
        console.log('✓ Configuration saved successfully');

        // Example 2: Load configuration
        console.log('\n2. Loading configuration...');
        const config = await configManager.loadConfiguration();
        console.log('✓ Configuration loaded:', {
            agentCount: config.agents.length,
            workflowCount: config.workflows.length,
            version: config.version
        });

        // Example 3: Export configuration to JSON
        console.log('\n3. Exporting configuration...');
        const exportedJson = await configManager.exportConfiguration();
        console.log('✓ Configuration exported (size:', exportedJson.length, 'characters)');

        // Example 4: Create a backup
        console.log('\n4. Creating backup...');
        const backup = await configManager.createBackup('Demo Backup');
        console.log('✓ Backup created:', {
            id: backup.id,
            name: backup.name,
            size: backup.size
        });

        // Example 5: List all backups
        console.log('\n5. Listing backups...');
        const backups = await configManager.listBackups();
        console.log('✓ Found', backups.length, 'backups');
        backups.forEach(b => {
            console.log(`  - ${b.name} (${b.createdAt})`);
        });

        // Example 6: Validate configuration
        console.log('\n6. Validating configuration...');
        const validationResult = configManager.validateConfiguration(config);
        console.log('✓ Validation result:', {
            isValid: validationResult.isValid,
            errors: validationResult.errors.length,
            warnings: validationResult.warnings.length,
            migrationRequired: validationResult.migrationRequired
        });

        // Example 7: Import configuration
        console.log('\n7. Testing import functionality...');
        const testConfig = {
            agents: [{
                id: 'demo-agent',
                name: 'Demo Agent',
                role: 'assistant',
                promptTemplate: 'You are a helpful demo assistant',
                status: 'idle' as const,
                config: {
                    maxTokens: 150,
                    temperature: 0.8,
                    model: 'xiaomi/mimo-v2-flash:free'
                },
                stats: {
                    tasksCompleted: 0,
                    averageResponseTime: 0,
                    errorCount: 0
                }
            }],
            workflows: [],
            settings: {
                maxAgents: 5,
                defaultModel: 'xiaomi/mimo-v2-flash:free',
                apiTimeout: 25000,
                autoSaveInterval: 45000,
                theme: 'dark' as const
            },
            usageStats: {
                totalTasksExecuted: 0,
                totalAgentsCreated: 1,
                totalWorkflowsRun: 0,
                averageTaskDuration: 0,
                lastActiveDate: new Date()
            },
            version: '1.0.0',
            exportedAt: new Date().toISOString()
        };

        await configManager.importConfiguration(JSON.stringify(testConfig));
        console.log('✓ Test configuration imported successfully');

        // Example 8: Restore from backup
        console.log('\n8. Restoring from backup...');
        await configManager.restoreFromBackup(backup.id);
        console.log('✓ Configuration restored from backup');

        // Example 9: Clean up - delete the demo backup
        console.log('\n9. Cleaning up demo backup...');
        await configManager.deleteBackup(backup.id);
        console.log('✓ Demo backup deleted');

        console.log('\n🎉 Configuration management demo completed successfully!');

    } catch (error) {
        console.error('❌ Error during configuration management demo:', error);
        throw error;
    }
}

// Example of error handling
async function demonstrateErrorHandling() {
    const configManager = new ConfigurationManager();

    try {
        console.log('\nDemonstrating error handling...');

        // Try to import invalid JSON
        try {
            await configManager.importConfiguration('{ invalid json }');
        } catch (error) {
            console.log('✓ Caught invalid JSON error:', (error as Error).message);
        }

        // Try to restore non-existent backup
        try {
            await configManager.restoreFromBackup('non-existent-backup-id');
        } catch (error) {
            console.log('✓ Caught non-existent backup error:', (error as Error).message);
        }

        // Try to validate invalid configuration
        const invalidConfig = {
            agents: 'not an array',
            workflows: [],
            settings: {}
        };

        const result = configManager.validateConfiguration(invalidConfig);
        console.log('✓ Invalid configuration detected:', result.errors);

    } catch (error) {
        console.error('❌ Unexpected error:', error);
    }
}

// Export functions for use in other examples or tests
export {
    demonstrateConfigurationManagement,
    demonstrateErrorHandling
};

// Run demo if this file is executed directly
if (require.main === module) {
    demonstrateConfigurationManagement()
        .then(() => demonstrateErrorHandling())
        .catch(console.error);
}