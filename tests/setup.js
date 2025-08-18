// Test setup file
global.console = {
  ...console,
  // Suppress logs during tests unless VERBOSE is set
  log: process.env.VERBOSE ? console.log : jest.fn(),
  debug: process.env.VERBOSE ? console.debug : jest.fn(),
  info: process.env.VERBOSE ? console.info : jest.fn(),
  warn: console.warn,
  error: console.error,
};

// Mock Obsidian API for tests
global.mockObsidianApp = {
  vault: {
    getFiles: jest.fn(() => [
      { path: 'test-note.md', stat: { mtime: Date.now() } },
      { path: 'another-note.md', stat: { mtime: Date.now() } }
    ]),
    read: jest.fn((file) => Promise.resolve(`# ${file.path}\n\nTest content for ${file.path}`)),
    adapter: {
      exists: jest.fn(() => Promise.resolve(true))
    }
  },
  workspace: {
    getActiveFile: jest.fn(() => ({ path: 'current-note.md' }))
  },
  metadataCache: {
    getCache: jest.fn(() => ({})),
    getLinks: jest.fn(() => [])
  }
};

// Set test environment variables
process.env.NODE_ENV = 'test';