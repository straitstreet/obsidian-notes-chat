const fs = require('fs').promises;
const path = require('path');

class TestVaultGenerator {
    constructor() {
        this.vaultPath = path.join(__dirname, '..', 'test-vault');
        this.categories = {
            'Projects': [
                'Machine Learning Pipeline',
                'React Component Library',
                'API Documentation',
                'Database Migration',
                'Testing Framework'
            ],
            'Research': [
                'Large Language Models',
                'Knowledge Graphs',
                'Vector Databases',
                'Obsidian Plugin Development',
                'Budget Tracking Systems'
            ],
            'Daily': [
                '2025-01-15',
                '2025-01-16',
                '2025-01-17',
                '2025-01-18',
                '2025-01-19'
            ]
        };
    }

    async ensureDir(dir) {
        try {
            await fs.mkdir(dir, { recursive: true });
        } catch (err) {
            if (err.code !== 'EEXIST') throw err;
        }
    }

    async generateNote(category, title, content) {
        const filename = `${title.replace(/[^a-zA-Z0-9 ]/g, '').replace(/ /g, '-')}.md`;
        const filepath = path.join(this.vaultPath, category, filename);
        
        await this.ensureDir(path.dirname(filepath));
        await fs.writeFile(filepath, content, 'utf-8');
        
        console.log(`Generated: ${category}/${filename}`);
    }

    generateProjectNote(title) {
        return `# ${title}

## Overview
This project focuses on ${title.toLowerCase()} and aims to deliver a comprehensive solution.

## Objectives
- [ ] Research current approaches
- [ ] Design architecture
- [ ] Implement core features
- [ ] Write tests
- [ ] Document APIs

## Technical Stack
- **Frontend**: React, TypeScript
- **Backend**: Node.js, Express
- **Database**: PostgreSQL
- **Testing**: Jest, Cypress

## Progress
Started: ${new Date().toISOString().split('T')[0]}
Status: Planning

## Notes
Key considerations for this project include scalability, maintainability, and user experience.

## Links
- [[Research Notes]]
- [[API Documentation]]
- [[Testing Strategy]]

## Tags
#project #${title.toLowerCase().replace(/ /g, '-')} #active
`;
    }

    generateResearchNote(title) {
        return `# ${title}

## Summary
Research notes on ${title.toLowerCase()} covering current state, trends, and applications.

## Key Concepts
- **Definition**: ${title} refers to...
- **Applications**: Used in various domains including...
- **Challenges**: Current limitations include...

## Recent Developments
- New algorithms showing promise
- Industry adoption increasing
- Open source tools emerging

## Implementation Examples
\`\`\`typescript
// Example code snippet
interface ${title.replace(/ /g, '')}Config {
    enabled: boolean;
    options: Record<string, any>;
}
\`\`\`

## Resources
- [Academic Papers](https://example.com)
- [GitHub Repositories](https://github.com)
- [Documentation](https://docs.example.com)

## Questions
- How does this compare to alternative approaches?
- What are the performance implications?
- How can we measure effectiveness?

## Related
- [[Technology Trends]]
- [[Implementation Strategies]]
- [[Performance Analysis]]

## Tags
#research #${title.toLowerCase().replace(/ /g, '-')} #technology
`;
    }

    generateDailyNote(date) {
        return `# Daily Note - ${date}

## Today's Focus
- Working on MindBridge plugin
- Testing provider integrations
- Reviewing documentation

## Tasks
- [x] Update model configurations
- [ ] Implement budget tracking
- [ ] Add test coverage
- [ ] Update documentation

## Notes
### Meeting Notes
- Discussed MindBridge architecture
- Reviewed API integration patterns
- Planned testing strategy

### Ideas
- Consider adding voice input
- Explore mobile compatibility
- Look into plugin marketplace

### Code Snippets
\`\`\`typescript
const response = await llmProvider.generateResponse(
    'openai',
    'gpt-4.1',
    messages
);
\`\`\`

## Weather
Partly cloudy, 72°F

## Reflection
Good progress on the MindBridge plugin architecture. Need to focus more on testing tomorrow.

## Tomorrow
- [ ] Implement knowledge graph indexing
- [ ] Add hotkey system
- [ ] Write comprehensive tests

## Tags
#daily #${date} #development #mindbridge
`;
    }

    generateTemplateNote(title, content) {
        return `# ${title}

${content}

## Usage
This template can be used for ${title.toLowerCase()}.

## Tags
#template #${title.toLowerCase().replace(/ /g, '-')}
`;
    }

    async generateVault() {
        console.log('Generating test vault...');
        
        // Ensure base directory exists
        await this.ensureDir(this.vaultPath);

        // Generate category notes
        for (const [category, items] of Object.entries(this.categories)) {
            for (const item of items) {
                let content;
                switch (category) {
                    case 'Projects':
                        content = this.generateProjectNote(item);
                        break;
                    case 'Research':
                        content = this.generateResearchNote(item);
                        break;
                    case 'Daily':
                        content = this.generateDailyNote(item);
                        break;
                    default:
                        content = `# ${item}\n\nContent for ${item}`;
                }
                
                await this.generateNote(category, item, content);
            }
        }

        // Generate templates
        const templates = [
            ['Project Template', this.generateProjectNote('{{title}}')],
            ['Research Template', this.generateResearchNote('{{title}}')],
            ['Daily Template', this.generateDailyNote('{{date}}')],
            ['Meeting Notes', '# Meeting: {{title}}\n\n## Attendees\n- \n\n## Agenda\n- \n\n## Notes\n\n## Action Items\n- [ ] \n\n## Next Steps\n\n#meeting #{{date}}']
        ];

        for (const [title, content] of templates) {
            await this.generateNote('Templates', title, content);
        }

        // Generate index file
        const indexContent = `# Test Vault

This is a test vault for the MindBridge plugin.

## Structure
- **Projects/**: Active project documentation
- **Research/**: Research notes and findings  
- **Daily/**: Daily notes and logs
- **Templates/**: Note templates

## Usage
This vault contains sample content for testing:
- Link detection and analysis
- Knowledge graph building
- LLM query context
- Budget tracking scenarios

## MindBridge Testing
Use this vault to test:
- Hotkey functionality
- LLM provider integrations
- Knowledge graph search
- Budget limits and tracking

Generated: ${new Date().toISOString()}

#index #test-vault #mindbridge
`;

        await fs.writeFile(path.join(this.vaultPath, 'README.md'), indexContent, 'utf-8');

        // Generate .obsidian config for the test vault
        const obsidianConfig = {
            plugins: {
                'obsidian-mindbridge': {
                    enabled: true,
                    settings: {
                        providers: {
                            openai: { enabled: false, apiKey: '' },
                            anthropic: { enabled: false, apiKey: '' }
                        },
                        budget: {
                            monthlyLimit: 25.00,
                            warningThreshold: 0.8
                        },
                        hotkeys: {
                            quickQuery: 'Ctrl+Shift+L',
                            searchKnowledge: 'Ctrl+Shift+K'
                        }
                    }
                }
            }
        };

        await this.ensureDir(path.join(this.vaultPath, '.obsidian'));
        await fs.writeFile(
            path.join(this.vaultPath, '.obsidian', 'community-plugins.json'),
            JSON.stringify(['obsidian-mindbridge'], null, 2),
            'utf-8'
        );

        console.log(`Test vault generated at: ${this.vaultPath}`);
        console.log('Contains sample notes across multiple categories for comprehensive testing.');
    }
}

// Run if called directly
if (require.main === module) {
    const generator = new TestVaultGenerator();
    generator.generateVault().catch(console.error);
}

module.exports = TestVaultGenerator;