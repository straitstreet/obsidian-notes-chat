#!/usr/bin/env node

/**
 * Simple Agent Test Runner
 * Tests the knowledge agent functionality with built modules
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Test data
const testNotes = {
    'Personal/Car-Info.md': `# Car Information

## Vehicle Details
- **Make**: Toyota
- **Model**: Camry  
- **Year**: 2020
- **Color**: Silver
- **VIN**: 1HGBH41JXMN109186

## Insurance Information
- **Provider**: State Farm
- **Policy Number**: SF-12345678
- **Phone**: (555) 123-4567

## Maintenance Records
Last oil change: March 15, 2024
Next service due: June 15, 2024

#car #vehicle #important`,

    'Personal/Love-Letters.md': `# Love Letters and Memories

## Valentine's Day 2024
Received the most beautiful love letter from Sarah today. She wrote about how our relationship has grown and how much she appreciates our time together.

## Anniversary Reflections
June 12, 2023 - Our 5th anniversary. We talked about love, commitment, and what the future holds for us.

## Random Thoughts on Love
Love isn't just a feeling, it's a choice we make every day. The little moments matter more than the grand gestures.

## Song Lyrics That Remind Me of Love
"All you need is love, love
Love is all you need"

#love #relationships #memories #personal`,

    'Personal/Recent-Thoughts.md': `# Recent Thoughts About Love and Life

*Created: January 20, 2025*

Been thinking a lot about love lately. How it changes, evolves, and deepens over time. The conversation with Mom about her 40-year marriage really got me thinking.

Love isn't just butterflies and excitement - it's also about choosing to be kind when you're tired, choosing to listen when you'd rather be heard, and choosing to grow together instead of apart.

## Questions I'm Pondering
- What does sustainable love look like?
- How do we maintain intimacy through life's challenges?
- Is love really enough to make a relationship work?

#love #philosophy #personal #recent`,

    'Projects/Machine-Learning-Pipeline.md': `# Machine Learning Pipeline

## Overview
Building a comprehensive ML pipeline for data processing and model training.

## Components
- Data ingestion
- Feature engineering
- Model training
- Model evaluation
- Deployment

## Technologies
- Python
- TensorFlow
- Apache Airflow
- Docker

VIN numbers for test vehicles: 1HGBH41JXMN109186, 2HGBH41JXMN109187

#projects #machine-learning #data-science`,

    'Daily/20250120.md': `# Daily Note - January 20, 2025

## What I did today
- Worked on the ML pipeline
- Had lunch with Sarah
- Thought about love and relationships (see [[Recent-Thoughts]])

## Phone calls
- Mom: (555) 987-6543
- Work: (555) 555-1234

## Tomorrow
- Finish ML documentation
- Car maintenance appointment

#daily #personal`
};

// Mock agent that simulates tool usage
class MockKnowledgeAgent {
    constructor() {
        this.documents = this.parseDocuments();
    }

    parseDocuments() {
        const docs = [];
        const now = Date.now();
        
        Object.entries(testNotes).forEach(([path, content], index) => {
            // Simulate different creation times
            const daysAgo = Math.floor(Math.random() * 30);
            const created = now - (daysAgo * 24 * 60 * 60 * 1000);
            const modified = created + (Math.random() * 24 * 60 * 60 * 1000);

            docs.push({
                path,
                title: path.split('/').pop().replace('.md', ''),
                content,
                created,
                modified,
                tags: (content.match(/#[\w\-]+/g) || []).map(tag => tag.slice(1))
            });
        });

        return docs;
    }

    async processQuery(userQuery) {
        console.log(`🤖 Processing: "${userQuery}"`);
        const query = userQuery.toLowerCase();
        const toolCalls = [];
        let response = '';

        // Simulate different tool usage based on query
        if (query.includes('last') && query.includes('love')) {
            // Use search_recent_notes with content filter
            const loveNotes = this.documents
                .filter(doc => doc.content.toLowerCase().includes('love'))
                .sort((a, b) => b.modified - a.modified)
                .slice(0, 3);

            toolCalls.push({
                toolName: 'search_recent_notes',
                parameters: { content_filter: 'love', count: 5, date_type: 'modified' },
                result: {
                    found: loveNotes.length,
                    results: loveNotes.map(doc => ({
                        title: doc.title,
                        path: doc.path,
                        modified: new Date(doc.modified).toISOString(),
                        content_preview: doc.content.substring(0, 200) + '...'
                    }))
                }
            });

            const mostRecent = loveNotes[0];
            response = `The most recent note about love is **${mostRecent.title}** (${mostRecent.path}), last modified on ${new Date(mostRecent.modified).toLocaleDateString()}. 

In this note, you reflected on how love changes and evolves over time, noting that "Love isn't just butterflies and excitement - it's also about choosing to be kind when you're tired, choosing to listen when you'd rather be heard."`;

        } else if (query.includes('vin')) {
            // Use find_specific_info for VIN
            const vinMatches = [];
            this.documents.forEach(doc => {
                const vinRegex = /\b[A-HJ-NPR-Z0-9]{17}\b/g;
                let match;
                while ((match = vinRegex.exec(doc.content)) !== null) {
                    vinMatches.push({
                        value: match[0],
                        context: doc.content.substring(Math.max(0, match.index - 50), match.index + match[0].length + 50),
                        document: doc.title,
                        path: doc.path
                    });
                }
            });

            toolCalls.push({
                toolName: 'find_specific_info',
                parameters: { info_type: 'vin', context_words: 10 },
                result: {
                    found: vinMatches.length > 0 ? 1 : 0,
                    total_matches: vinMatches.length,
                    results: vinMatches.map(match => ({
                        title: match.document,
                        path: match.path,
                        matches: [{ value: match.value, context: match.context }]
                    }))
                }
            });

            if (vinMatches.length > 0) {
                const primaryVin = vinMatches[0];
                response = `I found your VIN: **${primaryVin.value}**

This VIN is stored in **${primaryVin.document}** (${primaryVin.path}). It belongs to your 2020 Toyota Camry.`;
            } else {
                response = `I couldn't find any VIN numbers in your notes.`;
            }

        } else if (query.includes('phone')) {
            // Use find_specific_info for phone numbers
            const phoneMatches = [];
            this.documents.forEach(doc => {
                const phoneRegex = /(\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g;
                let match;
                while ((match = phoneRegex.exec(doc.content)) !== null) {
                    phoneMatches.push({
                        value: match[0],
                        context: doc.content.substring(Math.max(0, match.index - 30), match.index + match[0].length + 30),
                        document: doc.title,
                        path: doc.path
                    });
                }
            });

            toolCalls.push({
                toolName: 'find_specific_info',
                parameters: { info_type: 'phone', context_words: 5 },
                result: {
                    found: phoneMatches.length > 0 ? phoneMatches.length : 0,
                    total_matches: phoneMatches.length,
                    results: phoneMatches.map(match => ({
                        title: match.document,
                        path: match.path,
                        matches: [{ value: match.value, context: match.context }]
                    }))
                }
            });

            if (phoneMatches.length > 0) {
                response = `I found ${phoneMatches.length} phone number${phoneMatches.length > 1 ? 's' : ''} in your notes:

${phoneMatches.map(match => `• **${match.value}** - from ${match.document}`).join('\n')}`;
            } else {
                response = `I couldn't find any phone numbers in your notes.`;
            }

        } else if (query.includes('toyota') || query.includes('camry')) {
            // Use text_search for exact matches
            const searchTerm = query.includes('toyota') ? 'Toyota' : 'Camry';
            const matches = this.documents
                .filter(doc => doc.content.includes(searchTerm))
                .map(doc => {
                    const index = doc.content.toLowerCase().indexOf(searchTerm.toLowerCase());
                    const context = doc.content.substring(Math.max(0, index - 50), index + searchTerm.length + 50);
                    return {
                        doc,
                        context: index > 50 ? '...' + context : context
                    };
                });

            toolCalls.push({
                toolName: 'text_search',
                parameters: { query: searchTerm, case_sensitive: false, max_results: 10 },
                result: {
                    found: matches.length,
                    results: matches.map(match => ({
                        title: match.doc.title,
                        path: match.doc.path,
                        matches: 1,
                        contexts: [match.context],
                        modified: new Date(match.doc.modified).toISOString()
                    }))
                }
            });

            if (matches.length > 0) {
                response = `I found ${matches.length} note${matches.length > 1 ? 's' : ''} mentioning "${searchTerm}":

${matches.map(match => `• **${match.doc.title}** (${match.doc.path})`).join('\n')}

The main reference is in your Car Information note, where you've documented your 2020 Toyota Camry with VIN 1HGBH41JXMN109186.`;
            }

        } else if (query.includes('recent')) {
            // Use search_recent_notes
            const recentNotes = this.documents
                .sort((a, b) => b.modified - a.modified)
                .slice(0, 5);

            toolCalls.push({
                toolName: 'search_recent_notes',
                parameters: { count: 5, date_type: 'modified' },
                result: {
                    found: recentNotes.length,
                    results: recentNotes.map(doc => ({
                        title: doc.title,
                        path: doc.path,
                        modified: new Date(doc.modified).toISOString(),
                        content_preview: doc.content.substring(0, 200) + '...'
                    }))
                }
            });

            response = `Here are your ${recentNotes.length} most recently modified notes:

${recentNotes.map((doc, i) => `${i + 1}. **${doc.title}** - ${new Date(doc.modified).toLocaleDateString()}`).join('\n')}`;

        } else {
            // Default semantic search
            const relevantDocs = this.documents.slice(0, 3);
            toolCalls.push({
                toolName: 'semantic_search',
                parameters: { query: userQuery, topK: 5, threshold: 0.3 },
                result: {
                    found: relevantDocs.length,
                    results: relevantDocs.map(doc => ({
                        title: doc.title,
                        path: doc.path,
                        similarity: 0.8,
                        content_preview: doc.content.substring(0, 200) + '...'
                    }))
                }
            });

            response = `I found ${relevantDocs.length} relevant notes for your query. Here are the most relevant matches:

${relevantDocs.map((doc, i) => `${i + 1}. **${doc.title}** (${doc.path})`).join('\n')}`;
        }

        return {
            content: response,
            toolCalls,
            finished: true
        };
    }
}

async function runInteractiveTest() {
    const agent = new MockKnowledgeAgent();
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    console.log('🤖 Knowledge Agent Test CLI (Standalone)');
    console.log('═'.repeat(60));
    console.log('This is a simplified test without actual LLM calls.');
    console.log('It simulates how the agent would use different tools based on your queries.');
    console.log('');
    console.log('💡 Try these example queries:');
    console.log('  • "When was the last note about love?"');
    console.log('  • "What\'s my VIN?"');
    console.log('  • "Find my phone numbers"');  
    console.log('  • "Show me notes about Toyota Camry"');
    console.log('  • "Show me recent notes"');
    console.log('');
    console.log('📊 Test data: 5 sample notes loaded');
    console.log('Type "quit" to exit.\n');

    function askQuestion() {
        rl.question('🔍 Query: ', async (query) => {
            if (query.toLowerCase() === 'quit' || query.toLowerCase() === 'exit') {
                console.log('\n👋 Goodbye!');
                rl.close();
                return;
            }

            if (!query.trim()) {
                askQuestion();
                return;
            }

            console.log('');
            
            try {
                const startTime = Date.now();
                const response = await agent.processQuery(query);
                const endTime = Date.now();

                console.log('🎯 Response:');
                console.log('─'.repeat(50));
                console.log(response.content);

                if (response.toolCalls && response.toolCalls.length > 0) {
                    console.log('\n🛠️  Tools Used:');
                    response.toolCalls.forEach((call, i) => {
                        console.log(`  ${i + 1}. ${call.toolName}`);
                        console.log(`     Parameters: ${JSON.stringify(call.parameters)}`);
                        if (call.result && call.result.found !== undefined) {
                            console.log(`     Found: ${call.result.found} result${call.result.found !== 1 ? 's' : ''}`);
                        }
                    });
                }

                console.log(`\n⚡ Completed in ${endTime - startTime}ms\n`);

            } catch (error) {
                console.error('❌ Error:', error.message);
                console.log('');
            }

            askQuestion();
        });
    }

    askQuestion();
}

async function runTestSuite() {
    console.log('🧪 Running Knowledge Agent Test Suite\n');

    const agent = new MockKnowledgeAgent();
    const testQueries = [
        "When was the last note about love?",
        "What's my VIN?",
        "Find my phone numbers", 
        "Show me notes about Toyota Camry",
        "Show me recent notes",
        "Find notes about relationships",
        "Search for machine learning"
    ];

    console.log(`📊 Testing ${testQueries.length} queries against ${agent.documents.length} sample notes\n`);

    for (const query of testQueries) {
        console.log(`🔍 Testing: "${query}"`);
        console.log('─'.repeat(50));

        try {
            const response = await agent.processQuery(query);
            console.log(`✅ Response: ${response.content.substring(0, 100)}...`);
            console.log(`🛠️  Tools: ${response.toolCalls.map(c => c.toolName).join(', ') || 'none'}`);

            if (response.toolCalls.length > 0) {
                const foundResults = response.toolCalls
                    .filter(call => call.result && call.result.found !== undefined)
                    .reduce((sum, call) => sum + call.result.found, 0);
                if (foundResults > 0) {
                    console.log(`📊 Found: ${foundResults} results`);
                }
            }

        } catch (error) {
            console.log(`❌ Error: ${error.message}`);
        }

        console.log('');
    }

    console.log('🎉 Test suite completed!');
}

// Main execution
async function main() {
    const args = process.argv.slice(2);

    if (args.includes('--test') || args.includes('-t')) {
        await runTestSuite();
    } else {
        await runInteractiveTest();
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { MockKnowledgeAgent, testNotes };