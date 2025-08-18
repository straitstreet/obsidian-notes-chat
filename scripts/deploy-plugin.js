const fs = require('fs').promises;
const path = require('path');

class PluginDeployer {
    constructor() {
        this.pluginDir = path.join(__dirname, '..');
        this.releaseDir = path.join(this.pluginDir, 'releases');
    }

    async getVersion() {
        const manifestPath = path.join(this.pluginDir, 'manifest.json');
        const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
        return manifest.version;
    }

    async checkGitStatus() {
        const { execSync } = require('child_process');
        
        try {
            // Check if we're in a git repository
            execSync('git rev-parse --git-dir', { stdio: 'ignore' });
            
            // Check for uncommitted changes
            const status = execSync('git status --porcelain', { encoding: 'utf-8' }).trim();
            if (status) {
                throw new Error('You have uncommitted changes. Please commit or stash them before deploying.');
            }
            
            console.log('✅ Git status clean');
        } catch (error) {
            if (error.message.includes('not a git repository')) {
                console.warn('⚠️  Not in a git repository - skipping git checks');
            } else {
                throw error;
            }
        }
    }

    async createGitTag() {
        const { execSync } = require('child_process');
        const version = await this.getVersion();
        const tagName = `v${version}`;
        
        try {
            // Check if tag already exists
            try {
                execSync(`git rev-parse ${tagName}`, { stdio: 'ignore' });
                console.log(`⚠️  Tag ${tagName} already exists`);
                return tagName;
            } catch {
                // Tag doesn't exist, create it
            }
            
            execSync(`git tag -a ${tagName} -m "Release version ${version}"`, { stdio: 'inherit' });
            console.log(`✅ Created git tag: ${tagName}`);
            
            return tagName;
        } catch (error) {
            console.warn('⚠️  Failed to create git tag:', error.message);
            return null;
        }
    }

    async pushToRemote() {
        const { execSync } = require('child_process');
        
        try {
            // Push commits
            execSync('git push', { stdio: 'inherit' });
            console.log('✅ Pushed commits to remote');
            
            // Push tags
            execSync('git push --tags', { stdio: 'inherit' });
            console.log('✅ Pushed tags to remote');
            
        } catch (error) {
            console.warn('⚠️  Failed to push to remote:', error.message);
            console.log('You may need to push manually: git push && git push --tags');
        }
    }

    async generateDeploymentInfo() {
        const version = await this.getVersion();
        const infoPath = path.join(this.releaseDir, 'deployment-info.json');
        
        const deploymentInfo = {
            version,
            timestamp: new Date().toISOString(),
            plugin: {
                name: 'Chat with Notes',
                id: 'obsidian-notes-chat',
                description: 'Chat with your notes using AI - supports multiple LLM providers with budget tracking'
            },
            files: {
                plugin: `obsidian-notes-chat-${version}.zip`,
                checksums: `obsidian-notes-chat-${version}.checksums.txt`,
                releaseNotes: `release-notes-${version}.md`
            },
            installation: {
                manual: 'Extract zip to .obsidian/plugins/obsidian-notes-chat/',
                brat: 'Use BRAT plugin with repository URL',
                community: 'Install from Obsidian Community Plugins (pending approval)'
            },
            requirements: {
                obsidianVersion: '0.15.0',
                nodeVersion: '16+',
                platforms: ['desktop', 'mobile']
            }
        };
        
        await fs.writeFile(infoPath, JSON.stringify(deploymentInfo, null, 2));
        console.log(`✅ Deployment info written to: ${infoPath}`);
    }

    async generateBratInfo() {
        const version = await this.getVersion();
        const bratPath = path.join(this.releaseDir, 'brat-install.md');
        
        const bratInstructions = `# BRAT Installation for Chat with Notes

## Quick Install with BRAT

1. Install the [BRAT plugin](obsidian://show-plugin?id=obsidian42-brat)
2. In BRAT settings, click "Add Beta Plugin"
3. Enter: \`straitstreet/obsidian-notes-chat\`
4. Click "Add Plugin"
5. Enable "Chat with Notes" in Community Plugins

## Manual Installation

1. Download \`obsidian-notes-chat-${version}.zip\`
2. Extract to \`.obsidian/plugins/obsidian-notes-chat/\`
3. Reload Obsidian
4. Enable plugin in settings

## Repository Information

- **Repository**: https://github.com/straitstreet/obsidian-notes-chat
- **Latest Release**: v${version}
- **Plugin ID**: obsidian-notes-chat
- **Minimum Obsidian Version**: 0.15.0

## Support

- **Issues**: https://github.com/straitstreet/obsidian-notes-chat/issues
- **Discussions**: https://github.com/straitstreet/obsidian-notes-chat/discussions
- **Documentation**: See README.md
`;
        
        await fs.writeFile(bratPath, bratInstructions);
        console.log(`✅ BRAT installation guide written to: ${bratPath}`);
    }

    async deploy() {
        try {
            console.log('🚀 Deploying Chat with Notes plugin...');
            
            await this.checkGitStatus();
            
            const tag = await this.createGitTag();
            
            await this.generateDeploymentInfo();
            console.log('✅ Deployment info generated');
            
            await this.generateBratInfo();
            console.log('✅ BRAT installation guide generated');
            
            await this.pushToRemote();
            
            console.log('\n🎉 Deployment complete!');
            console.log('📋 Next steps:');
            console.log('1. Create GitHub release with the generated files');
            console.log('2. Submit to Obsidian Community Plugins');
            console.log('3. Update documentation');
            console.log('4. Announce to community');
            
            if (tag) {
                console.log(`\n🏷️  Git tag: ${tag}`);
                console.log(`🔗 GitHub release: https://github.com/straitstreet/obsidian-notes-chat/releases/new?tag=${tag}`);
            }
            
        } catch (error) {
            console.error('❌ Deployment failed:', error.message);
            process.exit(1);
        }
    }
}

// Run if called directly
if (require.main === module) {
    const deployer = new PluginDeployer();
    deployer.deploy();
}

module.exports = PluginDeployer;