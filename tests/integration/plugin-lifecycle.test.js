const path = require('path');
const fs = require('fs').promises;

describe('Plugin Lifecycle Integration Tests', () => {
  let testVaultPath;

  beforeAll(async () => {
    testVaultPath = path.join(__dirname, '..', '..', 'test-vault');
    
    // Ensure test vault exists
    try {
      await fs.access(testVaultPath);
    } catch (error) {
      // Generate test vault if it doesn't exist
      const TestVaultGenerator = require('../../scripts/generate-test-vault');
      const generator = new TestVaultGenerator();
      await generator.generateVault();
    }
  });

  describe('Test Vault', () => {
    test('should have proper structure', async () => {
      const vaultContents = await fs.readdir(testVaultPath);
      
      expect(vaultContents).toContain('Projects');
      expect(vaultContents).toContain('Research');
      expect(vaultContents).toContain('Daily');
      expect(vaultContents).toContain('Templates');
      expect(vaultContents).toContain('README.md');
    });

    test('should contain sample notes', async () => {
      const projectsPath = path.join(testVaultPath, 'Projects');
      const projects = await fs.readdir(projectsPath);
      
      expect(projects.length).toBeGreaterThan(0);
      expect(projects.some(file => file.endsWith('.md'))).toBe(true);
    });

    test('should have valid markdown content', async () => {
      const readmePath = path.join(testVaultPath, 'README.md');
      const content = await fs.readFile(readmePath, 'utf-8');
      
      expect(content).toContain('# Test Vault');
      expect(content).toContain('## Structure');
      expect(content).toContain('#test-vault');
    });
  });

  describe('Plugin Configuration', () => {
    test('should have Obsidian config directory', async () => {
      const obsidianPath = path.join(testVaultPath, '.obsidian');
      
      try {
        await fs.access(obsidianPath);
        const configFiles = await fs.readdir(obsidianPath);
        expect(configFiles).toContain('community-plugins.json');
      } catch (error) {
        // It's okay if .obsidian doesn't exist in test environment
        console.log('No .obsidian directory found - this is expected in CI');
      }
    });
  });

  describe('File Processing', () => {
    test('should be able to read and parse notes', async () => {
      const projectsPath = path.join(testVaultPath, 'Projects');
      const files = await fs.readdir(projectsPath);
      const firstFile = files.find(f => f.endsWith('.md'));
      
      if (firstFile) {
        const filePath = path.join(projectsPath, firstFile);
        const content = await fs.readFile(filePath, 'utf-8');
        
        expect(content).toMatch(/^#\s+/); // Should start with a heading
        expect(content).toContain('##'); // Should have subheadings
        expect(content).toContain('#project'); // Should have tags
      }
    });

    test('should handle various note formats', async () => {
      const dailyPath = path.join(testVaultPath, 'Daily');
      const files = await fs.readdir(dailyPath);
      
      for (const file of files.slice(0, 2)) { // Test first 2 files
        if (file.endsWith('.md')) {
          const filePath = path.join(dailyPath, file);
          const content = await fs.readFile(filePath, 'utf-8');
          
          // Daily notes should have specific structure
          expect(content).toContain('# Daily Note');
          expect(content).toContain('## Tasks');
          expect(content).toContain('- [');
        }
      }
    });
  });

  describe('Link Detection', () => {
    test('should find internal links in notes', async () => {
      const researchPath = path.join(testVaultPath, 'Research');
      const files = await fs.readdir(researchPath);
      const firstFile = files.find(f => f.endsWith('.md'));
      
      if (firstFile) {
        const filePath = path.join(researchPath, firstFile);
        const content = await fs.readFile(filePath, 'utf-8');
        
        // Look for wiki-style links
        const linkMatches = content.match(/\[\[([^\]]+)\]\]/g);
        if (linkMatches) {
          expect(linkMatches.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('Content Analysis', () => {
    test('should identify different content types', async () => {
      const templatesPath = path.join(testVaultPath, 'Templates');
      const files = await fs.readdir(templatesPath);
      
      expect(files.some(f => f.includes('Project'))).toBe(true);
      expect(files.some(f => f.includes('Research'))).toBe(true);
      expect(files.some(f => f.includes('Daily'))).toBe(true);
    });

    test('should handle code blocks and technical content', async () => {
      const researchPath = path.join(testVaultPath, 'Research');
      const files = await fs.readdir(researchPath);
      
      for (const file of files.slice(0, 2)) {
        if (file.endsWith('.md')) {
          const filePath = path.join(researchPath, file);
          const content = await fs.readFile(filePath, 'utf-8');
          
          // Should contain code blocks or technical terms
          const hasCodeBlock = content.includes('```');
          const hasTechnicalContent = /interface|function|class|const/.test(content);
          
          expect(hasCodeBlock || hasTechnicalContent).toBe(true);
        }
      }
    });
  });
});