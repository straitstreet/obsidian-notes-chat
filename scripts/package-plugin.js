const fs = require('fs').promises;
const path = require('path');
const archiver = require('archiver');

class PluginPackager {
    constructor() {
        this.pluginDir = path.join(__dirname, '..');
        this.distDir = path.join(this.pluginDir, 'dist');
        this.releaseDir = path.join(this.pluginDir, 'releases');
    }

    async ensureDir(dir) {
        try {
            await fs.mkdir(dir, { recursive: true });
        } catch (err) {
            if (err.code !== 'EEXIST') throw err;
        }
    }

    async getVersion() {
        const manifestPath = path.join(this.pluginDir, 'manifest.json');
        const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
        return manifest.version;
    }

    async validateFiles() {
        const requiredFiles = ['main.js', 'manifest.json'];
        const missingFiles = [];

        for (const file of requiredFiles) {
            const filePath = path.join(this.pluginDir, file);
            try {
                await fs.access(filePath);
            } catch {
                missingFiles.push(file);
            }
        }

        if (missingFiles.length > 0) {
            throw new Error(`Missing required files: ${missingFiles.join(', ')}`);
        }
    }

    async copyAssets() {
        await this.ensureDir(this.distDir);

        // Copy required files
        const filesToCopy = [
            'main.js',
            'manifest.json',
            'styles.css'
        ];

        for (const file of filesToCopy) {
            const sourcePath = path.join(this.pluginDir, file);
            const destPath = path.join(this.distDir, file);
            
            try {
                await fs.copyFile(sourcePath, destPath);
                console.log(`Copied: ${file}`);
            } catch (error) {
                if (file !== 'styles.css') { // styles.css is optional
                    console.error(`Failed to copy ${file}:`, error.message);
                }
            }
        }

        // Copy documentation if it exists
        const docsToInclude = ['README.md', 'CHANGELOG.md'];
        for (const doc of docsToInclude) {
            const sourcePath = path.join(this.pluginDir, doc);
            const destPath = path.join(this.distDir, doc);
            
            try {
                await fs.copyFile(sourcePath, destPath);
                console.log(`Copied: ${doc}`);
            } catch {
                // Optional files, ignore if missing
            }
        }
    }

    async createZip() {
        const version = await this.getVersion();
        await this.ensureDir(this.releaseDir);

        const zipPath = path.join(this.releaseDir, `obsidian-notes-chat-${version}.zip`);
        
        return new Promise((resolve, reject) => {
            const output = require('fs').createWriteStream(zipPath);
            const archive = archiver('zip', {
                zlib: { level: 9 } // Maximum compression
            });

            output.on('close', () => {
                console.log(`Package created: ${zipPath} (${archive.pointer()} bytes)`);
                resolve(zipPath);
            });

            archive.on('error', reject);
            archive.pipe(output);

            // Add files from dist directory
            archive.directory(this.distDir, false);
            archive.finalize();
        });
    }

    async generateChecksums(zipPath) {
        const crypto = require('crypto');
        const zipData = await fs.readFile(zipPath);
        
        const sha256 = crypto.createHash('sha256').update(zipData).digest('hex');
        const md5 = crypto.createHash('md5').update(zipData).digest('hex');
        
        const checksumPath = zipPath.replace('.zip', '.checksums.txt');
        const checksumData = `SHA256: ${sha256}\nMD5: ${md5}\n`;
        
        await fs.writeFile(checksumPath, checksumData);
        console.log(`Checksums written to: ${checksumPath}`);
        
        return { sha256, md5 };
    }

    async generateReleaseNotes() {
        const version = await this.getVersion();
        const releaseNotesPath = path.join(this.releaseDir, `release-notes-${version}.md`);
        
        const releaseNotes = `# Chat with Notes v${version}

## 🚀 Features
- Multi-provider LLM support (OpenAI, Anthropic, Google, Local)
- Budget tracking and limits
- Hotkey-driven interface
- Knowledge graph integration

## 📦 Installation
1. Download the plugin zip file
2. Extract to your Obsidian plugins folder
3. Enable the plugin in settings
4. Configure your LLM providers

## 🔧 Configuration
See README.md for detailed setup instructions.

## 📋 Changelog
- Added latest 2025 LLM models
- Implemented comprehensive testing
- Enhanced provider management
- Added budget tracking system

Generated: ${new Date().toISOString()}
`;

        await fs.writeFile(releaseNotesPath, releaseNotes);
        console.log(`Release notes generated: ${releaseNotesPath}`);
    }

    async package() {
        try {
            console.log('🔨 Packaging Chat with Notes plugin...');
            
            await this.validateFiles();
            console.log('✅ Required files validated');
            
            await this.copyAssets();
            console.log('✅ Assets copied to dist/');
            
            const zipPath = await this.createZip();
            console.log('✅ Plugin packaged');
            
            const checksums = await this.generateChecksums(zipPath);
            console.log('✅ Checksums generated');
            
            await this.generateReleaseNotes();
            console.log('✅ Release notes generated');
            
            console.log('\n🎉 Package complete!');
            console.log(`📦 Package: ${path.basename(zipPath)}`);
            console.log(`📁 Location: ${this.releaseDir}`);
            console.log(`🔒 SHA256: ${checksums.sha256.substring(0, 16)}...`);
            
        } catch (error) {
            console.error('❌ Packaging failed:', error.message);
            process.exit(1);
        }
    }
}

// Run if called directly
if (require.main === module) {
    const packager = new PluginPackager();
    packager.package();
}

module.exports = PluginPackager;