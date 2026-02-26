# Visual Diff Implementation Code Changes

This document outlines the specific code changes required to implement the visual diff integration as described in the integration plan.

## New Files to Create

### 1. `src/lib/visual-regression/screenshot.mjs`

```javascript
/**
 * URL-based screenshot module for visual regression testing
 */
import path from 'path';
import fs from 'fs';
import { Cluster } from 'puppeteer-cluster';
import { determineOptimalConcurrency } from '../../visual-diff/lib/utils.mjs';

/**
 * Capture screenshots for a list of URLs with different viewports
 * 
 * @param {Object} options
 * @param {string} options.baseUrl - Base URL for the website
 * @param {Array<string>} options.paths - Paths to capture
 * @param {Array<Object>} options.viewports - Viewport configurations
 * @param {string} options.outputDir - Output directory for screenshots
 * @returns {Promise<Object>} - Capture results
 */
export async function captureUrlScreenshots({
  baseUrl, 
  paths, 
  viewports, 
  outputDir,
  concurrency = determineOptimalConcurrency()
}) {
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`Starting screenshot capture for ${baseUrl}`);
  console.log(`Paths: ${paths.join(', ')}`);
  console.log(`Viewports: ${viewports.map(v => v.name).join(', ')}`);
  console.log(`Output directory: ${outputDir}`);

  try {
    // Create cluster
    const cluster = await Cluster.launch({
      concurrency: Cluster.CONCURRENCY_BROWSER,
      maxConcurrency: concurrency,
      puppeteerOptions: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true,
      },
    });

    // Process a task (URL and viewport combination)
    await cluster.task(async ({ page, data: { url, viewport, outputPath } }) => {
      console.log(`Capturing ${url} at ${viewport.name} (${viewport.windowWidth}x${viewport.windowHeight})`);

      // Set viewport size
      await page.setViewport({
        width: viewport.windowWidth,
        height: viewport.windowHeight,
      });

      // Navigate to URL and wait for network idle
      await page.goto(url, { 
        waitUntil: ['domcontentloaded', 'networkidle0'],
        timeout: 60000 // 1 minute timeout
      });

      // Ensure directory exists
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Take screenshot
      await page.screenshot({
        path: outputPath,
        fullPage: true,
      });
    });

    // Queue all URL and viewport combinations
    const tasks = [];
    for (const viewport of viewports) {
      // Create viewport directory
      const viewportDir = path.join(outputDir, viewport.name.toLowerCase());
      if (!fs.existsSync(viewportDir)) {
        fs.mkdirSync(viewportDir, { recursive: true });
      }

      for (const urlPath of paths) {
        const url = new URL(urlPath, baseUrl).href;
        const sanitizedPath = urlPath === '/' 
          ? 'homepage' 
          : urlPath.replace(/^\//, '').replace(/\//g, '-');
        const outputPath = path.join(viewportDir, `${sanitizedPath}.png`);

        tasks.push({ url, viewport, outputPath });
        cluster.queue({ url, viewport, outputPath });
      }
    }

    // Wait for all tasks to complete
    await cluster.idle();
    await cluster.close();

    console.log(`Screenshot capture completed for ${baseUrl}`);
    return { 
      baseUrl, 
      paths, 
      viewports: viewports.map(v => v.name),
      count: tasks.length,
      directory: outputDir
    };
  } catch (error) {
    console.error('Error capturing screenshots:', error);
    throw error;
  }
}
```

### 2. `src/lib/visual-regression/snapshot-manager.mjs`

```javascript
/**
 * Snapshot manager for visual regression testing
 */
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { captureUrlScreenshots } from './screenshot.mjs';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get the root directory of the project
const rootDir = join(__dirname, '..', '..', '..');
const projectsDir = join(rootDir, 'projects');

/**
 * Create a new snapshot for a project
 * 
 * @param {string} projectDir - Project directory name
 * @param {string} snapshotId - Snapshot identifier
 * @param {Object} config - Visual regression configuration
 * @returns {Promise<Object>} - Snapshot information
 */
export async function createSnapshot(projectDir, snapshotId, config) {
  const projectPath = path.join(projectsDir, projectDir);
  const screenshotSetsDir = path.join(projectPath, 'screenshot-sets');
  const snapshotDir = path.join(screenshotSetsDir, snapshotId);

  // Ensure directories exist
  if (!fs.existsSync(screenshotSetsDir)) {
    fs.mkdirSync(screenshotSetsDir, { recursive: true });
  }

  if (fs.existsSync(snapshotDir)) {
    throw new Error(`Snapshot "${snapshotId}" already exists for project "${projectDir}"`);
  }

  fs.mkdirSync(snapshotDir, { recursive: true });

  // Capture screenshots
  const result = await captureUrlScreenshots({
    baseUrl: config.base_path,
    paths: config.paths,
    viewports: config.viewports,
    outputDir: snapshotDir
  });

  // Create snapshot information
  const snapshotInfo = {
    id: snapshotId,
    directory: path.relative(projectPath, snapshotDir),
    date: new Date().toISOString(),
    baseUrl: config.base_path,
    paths: config.paths,
    viewports: config.viewports.map(v => v.name),
    count: result.count
  };

  return snapshotInfo;
}

/**
 * Update project configuration with snapshot information
 * 
 * @param {string} projectDir - Project directory name
 * @param {Object} snapshotInfo - Snapshot information
 * @returns {Promise<boolean>} - Success status
 */
export async function updateProjectWithSnapshot(projectDir, snapshotInfo) {
  const projectPath = path.join(projectsDir, projectDir);
  const configPath = path.join(projectPath, 'project.json');

  try {
    // Read project configuration
    const configData = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData);

    // Initialize snapshots object if it doesn't exist
    if (!config.snapshots) {
      config.snapshots = {};
    }

    // Add snapshot information
    config.snapshots[snapshotInfo.id] = {
      directory: snapshotInfo.directory,
      date: snapshotInfo.date,
      count: snapshotInfo.count
    };

    // Update configuration
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error(`Error updating project with snapshot: ${error.message}`);
    return false;
  }
}

/**
 * Get all snapshots for a project
 * 
 * @param {string} projectDir - Project directory name
 * @returns {Array<Object>} - Snapshot information
 */
export function getProjectSnapshots(projectDir) {
  const projectPath = path.join(projectsDir, projectDir);
  const configPath = path.join(projectPath, 'project.json');

  try {
    // Read project configuration
    const configData = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData);

    // Return snapshots or empty object
    return config.snapshots || {};
  } catch (error) {
    console.error(`Error getting project snapshots: ${error.message}`);
    return {};
  }
}
```

### 3. `src/commands/take-snapshot.mjs`

```javascript
/**
 * Command for taking a visual regression snapshot
 */
import chalk from 'chalk';
import { input, confirm } from '@inquirer/prompts';
import { 
  loadProjectConfiguration, 
  convertProjectNameToDirectory 
} from '../utils/project-manager.mjs';
import { 
  createSnapshot, 
  updateProjectWithSnapshot 
} from '../lib/visual-regression/snapshot-manager.mjs';

/**
 * Take a snapshot of a project
 * 
 * @param {string} projectName - Project name
 * @returns {Promise<void>}
 */
export async function takeSnapshot(projectName) {
  console.clear();
  console.log(chalk.green('Take Visual Regression Snapshot'));
  console.log(chalk.gray('=============================='));
  console.log();

  // Check if project exists
  const projectDir = convertProjectNameToDirectory(projectName);
  const projectConfig = loadProjectConfiguration(projectDir);

  if (!projectConfig) {
    console.log(chalk.red(`Project "${projectName}" not found.`));
    console.log();
    return;
  }

  // Check if visual regression is configured
  if (!projectConfig['visual-diff']) {
    console.log(chalk.yellow(`Visual regression is not configured for project "${projectName}".`));
    console.log(chalk.yellow('Please configure visual regression first.'));
    console.log();
    return;
  }

  // Get snapshot ID
  const defaultSnapshotId = `snapshot-${new Date().toISOString().split('T')[0].replace(/-/g, '')}`;
  let snapshotId = await input({
    message: 'Enter a snapshot ID:',
    default: defaultSnapshotId,
    validate: (value) => value.trim() ? true : 'Snapshot ID is required'
  });

  // Confirm settings
  console.log();
  console.log(chalk.gray('Snapshot settings:'));
  console.log(chalk.gray(`- Project: ${projectName}`));
  console.log(chalk.gray(`- Base URL: ${projectConfig['visual-diff'].base_path}`));
  console.log(chalk.gray(`- Paths: ${projectConfig['visual-diff'].paths.join(', ')}`));
  console.log(chalk.gray(`- Viewports: ${projectConfig['visual-diff'].viewports.map(v => v.name).join(', ')}`));
  console.log(chalk.gray(`- Snapshot ID: ${snapshotId}`));
  console.log();

  const confirmCapture = await confirm({
    message: 'Proceed with snapshot capture?',
    default: true
  });

  if (!confirmCapture) {
    console.log(chalk.yellow('Snapshot capture cancelled.'));
    console.log();
    return;
  }

  try {
    console.log(chalk.blue('Taking snapshot...'));
    console.log();

    // Take snapshot
    const snapshotInfo = await createSnapshot(
      projectDir, 
      snapshotId, 
      projectConfig['visual-diff']
    );

    // Update project configuration
    await updateProjectWithSnapshot(projectDir, snapshotInfo);

    console.log();
    console.log(chalk.green(`✓ Snapshot "${snapshotId}" created successfully!`));
    console.log(chalk.gray(`- Captured ${snapshotInfo.count} screenshots`));
    console.log(chalk.gray(`- Saved to ${snapshotInfo.directory}`));
    console.log();
  } catch (error) {
    console.log();
    console.log(chalk.red('Error taking snapshot:'), error.message);
    console.log();
  }

  await input({
    message: 'Press Enter to return to main menu...',
    default: '',
  });

  // Import here to avoid circular dependency
  const { showMainMenu } = await import('./main-menu.mjs');
  await showMainMenu();
}
```

### 4. Updates to `src/commands/main-menu.mjs`

```javascript
// Add this to the menu options:
{
  name: 'Take Visual Regression Snapshot',
  value: 'take-snapshot'
}

// And add this to the switch statement:
case 'take-snapshot':
  // Get active project name
  const projectName = await selectProject('Select a project to take a snapshot of:');
  if (projectName) {
    const { takeSnapshot } = await import('./take-snapshot.mjs');
    await takeSnapshot(projectName);
  } else {
    await showMainMenu();
  }
  break;
```

### 5. Updates to `src/commands/load-existing-project.mjs`

```javascript
// After loading a project, add an option to take a snapshot:
const projectConfig = loadProjectConfiguration(selectedProject);
console.log(chalk.green(`Project "${projectConfig.name}" loaded successfully!`));

// If visual regression is configured, offer to take a snapshot
if (projectConfig['visual-diff']) {
  console.log();
  const takeSnapshotNow = await confirm({
    message: 'Would you like to take a visual regression snapshot now?',
    default: false
  });

  if (takeSnapshotNow) {
    const { takeSnapshot } = await import('./take-snapshot.mjs');
    await takeSnapshot(projectConfig.name);
    return; // Skip returning to main menu as takeSnapshot will do it
  }
}
```

## Dependencies

Make sure the following dependencies are available:

- puppeteer-cluster: For efficient screenshot capturing
- @inquirer/prompts: For interactive command-line prompts

## Testing

After implementing these changes, test the functionality with the following workflow:

1. Create a new project with visual regression configuration
2. Load the project
3. Take a snapshot
4. Verify the screenshots are captured correctly
5. Check that the project.json file is updated with snapshot information

## Next Steps

After this implementation, consider enhancing the functionality with:

1. Snapshot comparison capabilities
2. Visual review interface for comparing snapshots
3. Reporting functionality for visual differences
4. Automated regression testing workflow