/**
 * Smoke tests for menu functionality
 * Tests main menu, create project, and load project flows using real application interaction
 */
import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { spawn } from 'child_process';
import { existsSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

// Test timeout for interactive tests
const TEST_TIMEOUT = 15000;

// Helper to create a child process and interact with it
class AppInteraction {
  constructor() {
    this.process = null;
    this.output = '';
    this.currentPrompt = '';
  }

  async start() {
    return new Promise((resolve) => {
      this.process = spawn('node', ['index.mjs'], {
        cwd: process.cwd(),
        env: { ...process.env }
      });

      this.process.stdout.on('data', (data) => {
        const text = data.toString();
        this.output += text;
        this.currentPrompt = text;
      });

      this.process.stderr.on('data', (data) => {
        this.output += data.toString();
      });

      // Wait for initial output
      setTimeout(() => resolve(), 500);
    });
  }

  async sendKey(key) {
    return new Promise((resolve) => {
      if (key === 'ENTER') {
        this.process.stdin.write('\n');
      } else if (key === 'DOWN') {
        this.process.stdin.write('\x1B[B');
      } else if (key === 'UP') {
        this.process.stdin.write('\x1B[A');
      } else if (key === 'ESCAPE') {
        this.process.stdin.write('\x1B');
      } else {
        this.process.stdin.write(key);
      }
      setTimeout(() => resolve(), 200);
    });
  }

  async sendText(text) {
    return new Promise((resolve) => {
      this.process.stdin.write(text);
      setTimeout(() => resolve(), 200);
    });
  }

  async waitForText(text, timeout = 5000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (this.output.includes(text)) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Timeout waiting for text: "${text}"\nCurrent output:\n${this.output}`);
  }

  async stop() {
    return new Promise((resolve) => {
      if (this.process) {
        this.process.kill('SIGTERM');
        this.process.on('exit', () => {
          resolve();
        });
        // Force kill after 2 seconds if not terminated
        setTimeout(() => {
          if (this.process && !this.process.killed) {
            this.process.kill('SIGKILL');
          }
          resolve();
        }, 2000);
      } else {
        resolve();
      }
    });
  }

  getOutput() {
    return this.output;
  }

  clearOutput() {
    this.output = '';
  }
}

describe('Menu Smoke Tests', () => {
  let app;
  const testProjectsDir = join(process.cwd(), '.test-projects');
  const testProjectName = 'test-smoke-project';
  const testProjectDir = join(testProjectsDir, 'test-smoke-project');

  beforeAll(() => {
    // Set environment variable so project-manager uses test directory
    process.env.CT_VIZDIFF_PROJECTS_DIR = testProjectsDir;

    // Clean up any existing test projects directory
    if (existsSync(testProjectsDir)) {
      rmSync(testProjectsDir, { recursive: true, force: true });
    }

    // Create fresh test projects directory
    mkdirSync(testProjectsDir, { recursive: true });
  });

  beforeEach(() => {
    // Clean up any existing test project
    if (existsSync(testProjectDir)) {
      rmSync(testProjectDir, { recursive: true, force: true });
    }
    app = new AppInteraction();
  });

  afterAll(() => {
    // Clean up test projects directory
    if (existsSync(testProjectsDir)) {
      rmSync(testProjectsDir, { recursive: true, force: true });
    }

    // Clean up environment variable
    delete process.env.CT_VIZDIFF_PROJECTS_DIR;
  });

  describe('Main Menu Display', () => {
    test('should display main menu with title and correct menu items', async () => {
      await app.start();

      // Wait for main menu to appear
      await app.waitForText('CivicTheme Update Helper');
      await app.waitForText('version: 1.0');
      await app.waitForText('What would you like to do?');

      const output = app.getOutput();

      // Check that all menu items are present
      expect(output).toContain('Start new project');
      expect(output).toContain('Load existing project');
      expect(output).toContain('Exit');

      // Exit the application
      await app.sendKey('DOWN'); // Move to Load existing project
      await app.sendKey('DOWN'); // Move to Exit
      await app.sendKey('ENTER');

      await app.stop();
    }, TEST_TIMEOUT);

    test('should navigate through menu items with arrow keys', async () => {
      await app.start();

      await app.waitForText('What would you like to do?');

      // Navigate down through menu
      await app.sendKey('DOWN');
      await new Promise(resolve => setTimeout(resolve, 100));

      await app.sendKey('DOWN');
      await new Promise(resolve => setTimeout(resolve, 100));

      // Navigate back up
      await app.sendKey('UP');
      await new Promise(resolve => setTimeout(resolve, 100));

      // Select Exit (should be at position 2)
      await app.sendKey('DOWN');
      await app.sendKey('DOWN');
      await app.sendKey('ENTER');

      await app.stop();
    }, TEST_TIMEOUT);
  });

  describe('Start New Project Flow', () => {
    test('should navigate to create project when "Start new project" is selected', async () => {
      await app.start();

      // Wait for main menu
      await app.waitForText('What would you like to do?');

      // Select "Start new project" (first option, just press enter)
      await app.sendKey('ENTER');

      // Wait for the new project screen
      await app.waitForText('Start New Project');
      await app.waitForText('What is the name of the project?');

      const output = app.getOutput();
      expect(output).toContain('Start New Project');
      expect(output).toContain('=================');

      await app.stop();
    }, TEST_TIMEOUT);

    test('should create a project and return to main menu', async () => {
      await app.start();

      // Wait for main menu and select "Start new project"
      await app.waitForText('What would you like to do?');
      await app.sendKey('ENTER');

      // Enter project name
      await app.waitForText('What is the name of the project?');
      await app.sendText('Test Smoke Project');
      await app.sendKey('ENTER');

      // Visual regression configuration - use defaults
      // Base URL
      await app.waitForText('Enter the base URL for the website');
      await app.sendText('http://localhost:3000');
      await app.sendKey('ENTER');

      // Viewports - select and continue
      await app.waitForText('Select viewport presets to use:');
      await app.sendKey(' '); // Select first viewport (should be selected by default)
      await app.sendKey('ENTER');

      // Custom viewport question
      await app.waitForText('Add a custom viewport?');
      await app.sendKey('ENTER'); // No

      // CivicTheme content export check - say no to retry
      await app.waitForText('Do you wish to try and re-run the page fetch?');
      await app.sendKey('ENTER'); // No (default)

      // Paths - use default
      await app.waitForText('Use default paths');
      await app.sendKey('ENTER'); // Yes

      // Wait for success message
      await app.waitForText('Project created successfully!');

      const output = app.getOutput();
      expect(output).toContain('✅ Project created successfully!');
      expect(output).toContain('Name: Test Smoke Project');
      expect(output).toContain('Visual Regression Testing:');

      // Press enter to return to main menu
      await app.waitForText('Press Enter to return to main menu');
      await app.sendKey('ENTER');

      // Should be back at main menu
      await app.waitForText('What would you like to do?');

      // Exit
      await app.sendKey('DOWN');
      await app.sendKey('DOWN');
      await app.sendKey('ENTER');

      await app.stop();

      // Clean up any test project that might have been created
      if (existsSync(join(testProjectsDir, 'test-smoke-project'))) {
        rmSync(join(testProjectsDir, 'test-smoke-project'), { recursive: true, force: true });
      }
    }, TEST_TIMEOUT);

    test('should handle going back to main menu from create project', async () => {
      await app.start();

      // Navigate to create project
      await app.waitForText('What would you like to do?');
      await app.sendKey('ENTER');

      // At project name prompt, we'll create a project then return
      await app.waitForText('What is the name of the project?');
      await app.sendText('Quick Test');
      await app.sendKey('ENTER');

      // Handle visual regression config with defaults
      await app.waitForText('Enter the base URL for the website');
      await app.sendText('http://localhost:3000');
      await app.sendKey('ENTER');

      await app.waitForText('Select viewport presets to use:');
      await app.sendKey(' ');
      await app.sendKey('ENTER');

      await app.waitForText('Add a custom viewport?');
      await app.sendKey('ENTER'); // No

      // CivicTheme content export check - say no to retry
      await app.waitForText('Do you wish to try and re-run the page fetch?');
      await app.sendKey('ENTER'); // No (default)

      await app.waitForText('Use default paths');
      await app.sendKey('ENTER'); // Yes

      // Return to main menu
      await app.waitForText('Press Enter to return to main menu');
      await app.sendKey('ENTER');

      // Verify we're back at main menu
      await app.waitForText('What would you like to do?');

      const output = app.getOutput();
      expect(output).toContain('Start new project');
      expect(output).toContain('Load existing project');

      // Exit
      await app.sendKey('DOWN');
      await app.sendKey('DOWN');
      await app.sendKey('ENTER');

      await app.stop();

      // Clean up
      if (existsSync(join(testProjectsDir, 'quick-test'))) {
        rmSync(join(testProjectsDir, 'quick-test'), { recursive: true, force: true });
      }
    }, TEST_TIMEOUT);
  });

  describe('Load Existing Project Flow', () => {
    test('should show "create new project first" message when no projects exist', async () => {
      await app.start();

      // Wait for main menu
      await app.waitForText('What would you like to do?');

      // Select "Load existing project" (second option)
      await app.sendKey('DOWN');
      await app.sendKey('ENTER');

      // Should show the no projects message
      await app.waitForText('Load Existing Project');
      await app.waitForText('No projects found');
      await app.waitForText('Please create a new project first');

      const output = app.getOutput();
      expect(output).toContain('No projects found');
      expect(output).toContain('Please create a new project first');

      // Press Enter to return to main menu
      await app.waitForText('Press Enter to return to main menu');
      await app.sendKey('ENTER');

      // Should be back at main menu
      await app.waitForText('What would you like to do?');

      // Exit
      await app.sendKey('DOWN');
      await app.sendKey('DOWN');
      await app.sendKey('ENTER');

      await app.stop();
    }, TEST_TIMEOUT);

    test('should select an existing project and show project menu when project exists', async () => {
      // First create a test project
      const testProjectConfig = {
        name: 'Test Project',
        directoryName: 'test-project',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        'visual-diff': {
          base_path: 'http://localhost:3000',
          viewports: [{ name: 'Desktop', windowWidth: 1920, windowHeight: 1080 }],
          paths: ['/', '/about']
        }
      };

      // Create the test project directory and config
      const testProjDir = join(testProjectsDir, 'test-project');
      mkdirSync(testProjDir, { recursive: true });
      writeFileSync(
        join(testProjDir, 'project.json'),
        JSON.stringify(testProjectConfig, null, 2)
      );

      await app.start();

      // Wait for main menu
      await app.waitForText('What would you like to do?');

      // Select "Load existing project"
      await app.sendKey('DOWN');
      await app.sendKey('ENTER');

      // Should show project selection screen
      await app.waitForText('Load Existing Project');
      await app.waitForText('Select a project:');

      // Select the first project (just press enter)
      await app.sendKey('ENTER');

      // Should show project menu
      await app.waitForText('What would you like to do with this project?');

      const output = app.getOutput();
      expect(output).toContain('Take visual regression snapshot');
      expect(output).toContain('Compare visual regression screenshots');
      expect(output).toContain('Back to project selection');
      expect(output).toContain('Return to main menu');

      // Return to main menu
      await app.sendKey('DOWN'); // Move to Compare
      await app.sendKey('DOWN'); // Move to Back
      await app.sendKey('DOWN'); // Move to Return to main menu
      await app.sendKey('ENTER');

      // Should be back at main menu
      await app.waitForText('What would you like to do?');

      // Exit
      await app.sendKey('DOWN');
      await app.sendKey('DOWN');
      await app.sendKey('ENTER');

      await app.stop();
    }, TEST_TIMEOUT);

    test('should navigate back to project selection from project menu', async () => {
      // First create a test project
      const testProjectConfig = {
        name: 'Test Navigation Project',
        directoryName: 'test-nav-project',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        'visual-diff': {
          base_path: 'http://localhost:3000',
          viewports: [{ name: 'Desktop', windowWidth: 1920, windowHeight: 1080 }],
          paths: ['/']
        }
      };

      // Create the test project directory and config
      const testProjDir = join(testProjectsDir, 'test-nav-project');
      mkdirSync(testProjDir, { recursive: true });
      writeFileSync(
        join(testProjDir, 'project.json'),
        JSON.stringify(testProjectConfig, null, 2)
      );

      await app.start();

      // Navigate to load project
      await app.waitForText('What would you like to do?');
      await app.sendKey('DOWN'); // Load existing project
      await app.sendKey('ENTER');

      await app.waitForText('Select a project:');
      await app.sendKey('ENTER'); // Select first project

      // In project menu, go back to project selection
      await app.waitForText('What would you like to do with this project?');
      await app.sendKey('DOWN'); // Move to Compare
      await app.sendKey('DOWN'); // Move to Back to project selection
      await app.sendKey('ENTER');

      // Should be back at project selection
      await app.waitForText('Select a project:');

      const output = app.getOutput();
      expect(output).toContain('Return to main menu');

      // Return to main menu
      // Navigate down to the last option
      for (let i = 0; i < 10; i++) {
        await app.sendKey('DOWN');
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      await app.sendKey('ENTER');

      // Exit
      await app.waitForText('What would you like to do?');
      await app.sendKey('DOWN');
      await app.sendKey('DOWN');
      await app.sendKey('ENTER');

      await app.stop();
    }, TEST_TIMEOUT);
  });
});
