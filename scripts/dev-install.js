const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

/**
 * Development installer for Chat with Notes plugin
 * 
 * This script automates the development workflow by:
 * 1. Building the plugin from source
 * 2. Installing it to the test-vault for immediate testing
 * 3. Configuring Obsidian to enable the plugin automatically
 * 
 * Usage:
 * - Install: npm run dev-install
 * - Uninstall: npm run dev-uninstall
 */
class DevInstaller {
    constructor() {
        // Define all the paths we'll need for installation
        this.projectDir = path.join(__dirname, '..');
        this.testVaultDir = path.join(this.projectDir, 'test-vault');
        this.obsidianDir = path.join(this.testVaultDir, '.obsidian');
        this.pluginsDir = path.join(this.obsidianDir, 'plugins');
        this.pluginDir = path.join(this.pluginsDir, 'obsidian-notes-chat');
    }

    /**
     * Ensure a directory exists, creating it if necessary
     */
    async ensureDir(dir) {
        try {
            await fs.mkdir(dir, { recursive: true });
            console.log(`📁 Created directory: ${path.relative(this.projectDir, dir)}`);
        } catch (err) {
            if (err.code !== 'EEXIST') throw err;
        }
    }

    /**
     * Verify that the test vault exists before attempting installation
     */
    async checkTestVault() {
        try {
            await fs.access(this.testVaultDir);
            console.log('✅ Test vault found');
        } catch {
            throw new Error('Test vault not found. Run `npm run generate-vault` first.');
        }
    }

    /**
     * Build the plugin using the production build script
     * This ensures we're testing the same build that would be released
     */
    async buildPlugin() {
        console.log('🔨 Building plugin...');
        try {
            execSync('npm run build', { 
                cwd: this.projectDir, 
                stdio: 'pipe' 
            });
            console.log('✅ Plugin built successfully');
        } catch (error) {
            console.error('❌ Build failed:', error.message);
            throw error;
        }
    }

    /**
     * Copy the built plugin files to the test vault's plugin directory
     * This includes main.js, manifest.json, and styles.css (if it exists)
     */
    async copyPluginFiles() {
        // Ensure the full directory structure exists
        await this.ensureDir(this.obsidianDir);
        await this.ensureDir(this.pluginsDir);
        await this.ensureDir(this.pluginDir);

        // Files required for a functional Obsidian plugin
        const filesToCopy = [
            'main.js',        // The compiled plugin code
            'manifest.json',  // Plugin metadata for Obsidian
            'styles.css'      // Plugin-specific CSS (optional)
        ];

        for (const file of filesToCopy) {
            const sourcePath = path.join(this.projectDir, file);
            const destPath = path.join(this.pluginDir, file);
            
            try {
                await fs.copyFile(sourcePath, destPath);
                console.log(`📄 Copied: ${file}`);
            } catch (error) {
                if (file === 'styles.css') {
                    // styles.css is optional, create empty one if missing
                    await fs.writeFile(destPath, '/* Chat with Notes styles */\n');
                    console.log(`📄 Created empty: ${file}`);
                } else {
                    console.error(`❌ Failed to copy ${file}:`, error.message);
                    throw error;
                }
            }
        }
    }

    /**
     * Configure Obsidian to automatically enable the plugin
     * This modifies the plugins.json file to enable our plugin by default
     */
    async createPluginsConfig() {
        const pluginsConfigPath = path.join(this.obsidianDir, 'plugins.json');
        
        // Load existing plugins config or create new one
        let pluginsConfig = {};
        try {
            const configData = await fs.readFile(pluginsConfigPath, 'utf-8');
            pluginsConfig = JSON.parse(configData);
        } catch {
            // File doesn't exist, start with empty config
        }

        // Enable our plugin (true = enabled, false = disabled)
        pluginsConfig['obsidian-notes-chat'] = true;

        await fs.writeFile(pluginsConfigPath, JSON.stringify(pluginsConfig, null, 2));
        console.log('⚙️  Plugin enabled in test vault');
    }

    async createAppConfig() {
        // Create basic app.json if it doesn't exist
        const appConfigPath = path.join(this.obsidianDir, 'app.json');
        
        try {
            await fs.access(appConfigPath);
        } catch {
            const defaultConfig = {
                "legacyEditor": false,
                "livePreview": true,
                "theme": "obsidian",
                "cssTheme": ""
            };
            
            await fs.writeFile(appConfigPath, JSON.stringify(defaultConfig, null, 2));
            console.log('⚙️  Created basic app config');
        }
    }

    async getPluginInfo() {
        const manifestPath = path.join(this.projectDir, 'manifest.json');
        const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
        return {
            name: manifest.name,
            version: manifest.version,
            description: manifest.description
        };
    }

    async printInstructions() {
        const pluginInfo = await this.getPluginInfo();
        
        console.log('\n🎉 Development installation complete!');
        console.log(`📦 Plugin: ${pluginInfo.name} v${pluginInfo.version}`);
        console.log(`📝 Description: ${pluginInfo.description}`);
        console.log(`📁 Installed to: ${path.relative(this.projectDir, this.pluginDir)}`);
        console.log('\n📋 Next steps:');
        console.log('1. Open the test-vault in Obsidian');
        console.log('2. The plugin should already be enabled');
        console.log('3. Look for the chat icon in the ribbon');
        console.log('4. Configure your AI providers in plugin settings');
        console.log('\n💡 Tips:');
        console.log('- Run `npm run dev-install` again after making changes');
        console.log('- Check the Developer Console (Ctrl+Shift+I) for errors');
        console.log('- Use `npm run dev` for automatic rebuilding during development');
    }

    /**
     * Main installation workflow
     * Orchestrates the entire development installation process
     */
    async install() {
        try {
            console.log('🚀 Installing plugin for development testing...');
            
            await this.checkTestVault();      // Ensure test vault exists
            await this.buildPlugin();         // Build the latest code
            await this.copyPluginFiles();     // Copy files to plugin directory
            await this.createPluginsConfig(); // Enable plugin in Obsidian
            await this.createAppConfig();     // Ensure basic Obsidian config exists
            await this.printInstructions();   // Show next steps to user
            
        } catch (error) {
            console.error('❌ Development installation failed:', error.message);
            process.exit(1);
        }
    }

    /**
     * Clean uninstallation of the plugin from test vault
     * Removes all plugin files and disables it in Obsidian config
     */
    async uninstall() {
        try {
            console.log('🗑️  Uninstalling plugin from test vault...');
            
            // Remove the entire plugin directory
            try {
                await fs.rm(this.pluginDir, { recursive: true, force: true });
                console.log('📁 Removed plugin directory');
            } catch {
                console.log('📁 Plugin directory not found');
            }

            // Update plugins.json to disable the plugin
            const pluginsConfigPath = path.join(this.obsidianDir, 'plugins.json');
            try {
                const configData = await fs.readFile(pluginsConfigPath, 'utf-8');
                const pluginsConfig = JSON.parse(configData);
                delete pluginsConfig['obsidian-notes-chat']; // Remove our plugin entry
                await fs.writeFile(pluginsConfigPath, JSON.stringify(pluginsConfig, null, 2));
                console.log('⚙️  Plugin disabled in test vault');
            } catch {
                console.log('⚙️  No plugins config found');
            }

            console.log('✅ Plugin uninstalled from test vault');
            
        } catch (error) {
            console.error('❌ Uninstall failed:', error.message);
            process.exit(1);
        }
    }
}

// Command line interface for the development installer
// Usage: node dev-install.js [uninstall]
if (require.main === module) {
    const installer = new DevInstaller();
    const command = process.argv[2];
    
    if (command === 'uninstall') {
        installer.uninstall();
    } else {
        installer.install();
    }
}

module.exports = DevInstaller;