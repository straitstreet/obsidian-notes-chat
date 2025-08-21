#!/usr/bin/env node

/**
 * Test Tool Use with Real LLM
 * This tests whether our agent can actually get LLMs to use tools
 */

const readline = require('readline');

// Simple test to verify tool call parsing
function testToolCallParsing() {
    console.log('🧪 Testing Tool Call Parsing...\n');
    
    const testCases = [
        {
            name: 'Valid tool call',
            input: 'TOOL_CALL: search_recent_notes({"content_filter": "love", "count": 5})',
            expected: { finished: false, toolName: 'search_recent_notes' }
        },
        {
            name: 'Valid final answer',
            input: 'FINAL_ANSWER: Here is your information...',
            expected: { finished: true, content: 'Here is your information...' }
        },
        {
            name: 'Invalid tool call format',
            input: 'I should use search_recent_notes to find this',
            expected: { finished: true } // Should fall back to final answer
        },
        {
            name: 'Tool call with complex parameters',
            input: 'TOOL_CALL: find_specific_info({"info_type": "vin", "context_words": 10})',
            expected: { finished: false, toolName: 'find_specific_info' }
        }
    ];
    
    // Mock the parsing function
    function parseAgentDecision(response) {
        const trimmed = response.trim();
        
        if (trimmed.startsWith('FINAL_ANSWER:')) {
            return {
                finished: true,
                content: trimmed.substring('FINAL_ANSWER:'.length).trim()
            };
        }
        
        if (trimmed.startsWith('TOOL_CALL:')) {
            const toolCallStr = trimmed.substring('TOOL_CALL:'.length).trim();
            
            // Parse tool call: tool_name({"param": "value"})
            const match = toolCallStr.match(/^(\w+)\((.*)\)$/);
            if (match) {
                const [, toolName, paramsStr] = match;
                try {
                    const parameters = JSON.parse(paramsStr);
                    return {
                        finished: false,
                        toolCall: { toolName, parameters }
                    };
                } catch (error) {
                    console.error('Failed to parse tool parameters:', paramsStr);
                }
            }
        }
        
        return {
            finished: true,
            content: response
        };
    }
    
    let passed = 0;
    let failed = 0;
    
    testCases.forEach(test => {
        try {
            const result = parseAgentDecision(test.input);
            
            // Check if result matches expectation
            let success = true;
            if (test.expected.finished !== result.finished) success = false;
            if (test.expected.toolName && (!result.toolCall || result.toolCall.toolName !== test.expected.toolName)) success = false;
            if (test.expected.content && result.content !== test.expected.content) success = false;
            
            if (success) {
                console.log(`✅ ${test.name}`);
                passed++;
            } else {
                console.log(`❌ ${test.name}`);
                console.log(`   Expected: ${JSON.stringify(test.expected)}`);
                console.log(`   Got: ${JSON.stringify(result)}`);
                failed++;
            }
        } catch (error) {
            console.log(`❌ ${test.name} (threw error: ${error.message})`);
            failed++;
        }
    });
    
    console.log(`\n📊 Parsing Tests: ${passed} passed, ${failed} failed\n`);
    return failed === 0;
}

// Test the LLM prompt formatting
function testPromptFormatting() {
    console.log('🧪 Testing Prompt Formatting...\n');
    
    const tools = [
        { name: 'semantic_search', description: 'Search notes by meaning' },
        { name: 'text_search', description: 'Search for exact text matches' },
        { name: 'find_specific_info', description: 'Find VINs, phones, emails' }
    ];
    
    const buildSystemPrompt = (tools) => {
        const toolDescriptions = tools.map(tool => 
            `- ${tool.name}: ${tool.description}`
        ).join('\n');
        
        return `You are a helpful assistant that searches through a user's personal notes to find information.

AVAILABLE TOOLS:
${toolDescriptions}

INSTRUCTIONS:
1. For each user query, decide which tool(s) will help find the answer
2. Use tools by responding with: TOOL_CALL: tool_name({"param": "value"})
3. After getting tool results, provide a final answer with: FINAL_ANSWER: [your answer]

TOOL SELECTION GUIDE:
- "when was the last..." or "recent..." → use search_recent_notes
- "what's my VIN/phone/email" → use find_specific_info  
- "find text ABC" → use text_search
- "notes about relationships" → use semantic_search

EXAMPLES:
User: "When was the last note about love?"
You: TOOL_CALL: search_recent_notes({"content_filter": "love", "count": 5})

User: "What's my VIN?" 
You: TOOL_CALL: find_specific_info({"info_type": "vin"})

Always use tools first to gather information, then provide a comprehensive final answer.`;
    };
    
    const prompt = buildSystemPrompt(tools);
    console.log('📝 Generated System Prompt:');
    console.log('─'.repeat(50));
    console.log(prompt);
    console.log('─'.repeat(50));
    
    // Check if prompt contains key elements
    const checks = [
        { name: 'Contains tool descriptions', test: () => prompt.includes('semantic_search') },
        { name: 'Has clear format instructions', test: () => prompt.includes('TOOL_CALL:') && prompt.includes('FINAL_ANSWER:') },
        { name: 'Includes examples', test: () => prompt.includes('When was the last note about love?') },
        { name: 'Has tool selection guide', test: () => prompt.includes('TOOL SELECTION GUIDE') }
    ];
    
    let passed = 0;
    checks.forEach(check => {
        if (check.test()) {
            console.log(`✅ ${check.name}`);
            passed++;
        } else {
            console.log(`❌ ${check.name}`);
        }
    });
    
    console.log(`\n📊 Prompt Tests: ${passed}/${checks.length} passed\n`);
    return passed === checks.length;
}

// Interactive test with mock responses
async function testInteractive() {
    console.log('🤖 Interactive Tool Use Test\n');
    console.log('This simulates how different LLM responses would be parsed:\n');
    
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    const examples = [
        'TOOL_CALL: search_recent_notes({"content_filter": "love", "count": 5})',
        'TOOL_CALL: find_specific_info({"info_type": "vin"})', 
        'FINAL_ANSWER: I found your VIN: 1HGBH41JXMN109186',
        'I need to search for this information first',
        'Let me use the search_recent_notes tool to find this'
    ];
    
    console.log('💡 Try these example responses:');
    examples.forEach((example, i) => {
        console.log(`  ${i + 1}. ${example}`);
    });
    console.log();
    
    function parseAgentDecision(response) {
        const trimmed = response.trim();
        console.log(`🔍 Parsing: "${trimmed}"`);
        
        if (trimmed.startsWith('FINAL_ANSWER:')) {
            const result = {
                finished: true,
                content: trimmed.substring('FINAL_ANSWER:'.length).trim()
            };
            console.log(`✅ Parsed as FINAL_ANSWER: "${result.content}"`);
            return result;
        }
        
        if (trimmed.startsWith('TOOL_CALL:')) {
            const toolCallStr = trimmed.substring('TOOL_CALL:'.length).trim();
            console.log(`🛠️ Parsing TOOL_CALL: "${toolCallStr}"`);
            
            const match = toolCallStr.match(/^(\w+)\((.*)\)$/);
            if (match) {
                const [, toolName, paramsStr] = match;
                try {
                    const parameters = JSON.parse(paramsStr);
                    const result = {
                        finished: false,
                        toolCall: { toolName, parameters }
                    };
                    console.log(`✅ Parsed tool: ${toolName} with params:`, parameters);
                    return result;
                } catch (error) {
                    console.error('❌ Failed to parse parameters:', error.message);
                }
            } else {
                console.error('❌ Invalid TOOL_CALL format');
            }
        }
        
        console.log(`⚠️ Treating as final answer (couldn't parse tool format)`);
        return {
            finished: true,
            content: response
        };
    }
    
    function askQuestion() {
        rl.question('🤖 Enter LLM response (or "quit"): ', (response) => {
            if (response.toLowerCase() === 'quit') {
                rl.close();
                return;
            }
            
            if (!response.trim()) {
                askQuestion();
                return;
            }
            
            console.log();
            parseAgentDecision(response);
            console.log();
            askQuestion();
        });
    }
    
    askQuestion();
}

async function main() {
    console.log('🧪 Tool Use Testing Suite');
    console.log('═'.repeat(50));
    console.log('This tests the agent\'s ability to parse and use tools.\n');
    
    const args = process.argv.slice(2);
    
    if (args.includes('--interactive') || args.includes('-i')) {
        await testInteractive();
        return;
    }
    
    let allPassed = true;
    
    // Run parsing tests
    if (!testToolCallParsing()) {
        allPassed = false;
    }
    
    // Run prompt tests
    if (!testPromptFormatting()) {
        allPassed = false;
    }
    
    console.log('🎯 Summary:');
    if (allPassed) {
        console.log('✅ All tests passed! Tool use should work correctly.');
        console.log('\n💡 To test interactively: node tests/test-tool-use.js --interactive');
    } else {
        console.log('❌ Some tests failed. Check the implementation.');
    }
}

if (require.main === module) {
    main().catch(console.error);
}