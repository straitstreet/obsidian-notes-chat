const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');

class ObsidianDocsLoader {
    constructor() {
        this.baseUrl = 'https://docs.obsidian.md';
        this.docsDir = path.join(__dirname, '..', 'docs', 'obsidian-docs');
        this.visited = new Set();
        this.maxDepth = 3;
    }

    async ensureDir(dir) {
        try {
            await fs.mkdir(dir, { recursive: true });
        } catch (err) {
            if (err.code !== 'EEXIST') throw err;
        }
    }

    async loadPage(url, depth = 0) {
        if (this.visited.has(url) || depth > this.maxDepth) return;
        this.visited.add(url);

        console.log(`Loading: ${url} (depth: ${depth})`);

        try {
            const response = await axios.get(url, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; ObsidianDocsLoader/1.0)'
                }
            });

            const $ = cheerio.load(response.data);
            
            // Extract main content
            const content = this.extractContent($);
            
            // Save to file
            const filename = this.urlToFilename(url);
            const filepath = path.join(this.docsDir, filename);
            await this.ensureDir(path.dirname(filepath));
            await fs.writeFile(filepath, content, 'utf-8');

            // Find and process links
            const links = this.extractLinks($, url);
            for (const link of links) {
                await this.loadPage(link, depth + 1);
            }

        } catch (error) {
            console.error(`Error loading ${url}:`, error.message);
        }
    }

    extractContent($) {
        // Remove scripts, styles, navigation, and other non-content elements
        $('script, style, nav, header, footer, .sidebar, .navigation').remove();
        
        // Get the main content area
        const mainContent = $('main, .content, .docs-content, article').first();
        const content = mainContent.length ? mainContent : $('body');
        
        // Convert to markdown-like format
        let text = '';
        
        // Extract title
        const title = $('h1').first().text() || $('title').text();
        if (title) {
            text += `# ${title}\n\n`;
        }

        // Extract text content while preserving structure
        content.find('h1, h2, h3, h4, h5, h6').each((i, el) => {
            const level = el.tagName.slice(1);
            const headingText = $(el).text().trim();
            if (headingText && !text.includes(headingText)) {
                text += `${'#'.repeat(level)} ${headingText}\n\n`;
            }
        });

        content.find('p, li, code, pre').each((i, el) => {
            const elementText = $(el).text().trim();
            if (elementText) {
                if (el.tagName === 'li') {
                    text += `- ${elementText}\n`;
                } else if (el.tagName === 'code' || el.tagName === 'pre') {
                    text += `\`${elementText}\`\n\n`;
                } else {
                    text += `${elementText}\n\n`;
                }
            }
        });

        return text;
    }

    extractLinks($, currentUrl) {
        const links = new Set();
        
        $('a[href]').each((i, el) => {
            let href = $(el).attr('href');
            if (!href) return;

            // Convert relative URLs to absolute
            if (href.startsWith('/')) {
                href = this.baseUrl + href;
            } else if (!href.startsWith('http')) {
                const baseUrl = currentUrl.substring(0, currentUrl.lastIndexOf('/'));
                href = baseUrl + '/' + href;
            }

            // Only include docs.obsidian.md links
            if (href.startsWith(this.baseUrl) && !href.includes('#')) {
                links.add(href);
            }
        });

        return Array.from(links);
    }

    urlToFilename(url) {
        let filename = url.replace(this.baseUrl, '').replace(/^\//, '');
        if (!filename || filename === '') {
            filename = 'index';
        }
        
        // Replace invalid filename characters
        filename = filename.replace(/[^a-zA-Z0-9\-_\/]/g, '-');
        
        // Ensure .md extension
        if (!filename.endsWith('.md')) {
            filename += '.md';
        }

        return filename;
    }

    async generateIndex() {
        const indexContent = `# Obsidian Documentation Index

This directory contains documentation loaded from https://docs.obsidian.md/

## Purpose
This documentation serves as a style and engineering guide for the LLM Knowledge Base plugin.

## Key Areas
- Plugin development patterns
- UI/UX conventions
- API usage examples
- Best practices

Generated on: ${new Date().toISOString()}
`;

        await fs.writeFile(path.join(this.docsDir, 'README.md'), indexContent, 'utf-8');
    }

    async load() {
        console.log('Starting Obsidian docs loading...');
        await this.ensureDir(this.docsDir);
        
        // Start with main documentation pages
        const startUrls = [
            'https://docs.obsidian.md/',
            'https://docs.obsidian.md/Plugins/Getting+started',
            'https://docs.obsidian.md/Plugins/User+interface',
            'https://docs.obsidian.md/Reference/TypeScript+API',
            'https://docs.obsidian.md/Plugins/Releasing'
        ];

        for (const url of startUrls) {
            await this.loadPage(url);
        }

        await this.generateIndex();
        console.log(`Loaded ${this.visited.size} pages to ${this.docsDir}`);
    }
}

// Run if called directly
if (require.main === module) {
    const loader = new ObsidianDocsLoader();
    loader.load().catch(console.error);
}

module.exports = ObsidianDocsLoader;