/**
 * Compare screenshots command for visual regression testing
 */
import path from 'path';
import chalk from 'chalk';
import { input, select, confirm } from '@inquirer/prompts';
import { exec } from 'child_process';
import { platform } from 'os';
import {
  loadProjectConfiguration,
  convertProjectNameToDirectory,
  projectsDir
} from '../utils/project-manager.mjs';
import { selectProject } from './take-snapshot.mjs';
import { getProjectSnapshots, writeComparisonMetadata } from '../lib/visual-regression/snapshot-manager.mjs';
import {
  getScreenshotSetPath,
  getComparisonPath,
} from '../lib/visual-regression/screenshot-set-manager.mjs';
import { compareScreenshots } from '../lib/visual-regression/comparison.mjs';

/**
 * Select a screenshot set from available sets
 *
 * @param {Object} snapshots - Available snapshot sets
 * @param {string} message - Prompt message
 * @param {string} [excludeId] - Optional ID to exclude from choices
 * @returns {Promise<string|null>} - Selected snapshot ID or null if cancelled
 */
async function selectSnapshotSet(snapshots, message, excludeId = null) {
  const snapshotIds = Object.keys(snapshots);
  const filteredIds = excludeId ? snapshotIds.filter(id => id !== excludeId) : snapshotIds;

  if (filteredIds.length === 0) {
    console.log(chalk.yellow('No snapshot sets available.'));
    return null;
  }

  const choices = filteredIds.map(id => {
    const snapshot = snapshots[id];
    return {
      name: id,
      value: id,
      description: `Created: ${new Date(snapshot.date).toLocaleDateString()}, ${snapshot.count} screenshots`
    };
  });

  choices.push({
    name: chalk.cyan('← Cancel'),
    value: 'cancel'
  });

  const selectedSet = await select({
    message: message,
    choices: choices
  });

  return selectedSet !== 'cancel' ? selectedSet : null;
}

/**
 * Compare screenshot sets for a project
 *
 * @param {string} projectName - Project name or directory
 * @param {boolean} returnToMainMenu - Whether to return to main menu after completion (default: true)
 * @returns {Promise<void>}
 */
export async function compareScreenshotSets(projectName, returnToMainMenu = true) {
  console.clear();
  console.log(chalk.green('Compare Visual Regression Screenshots'));
  console.log(chalk.cyan('===================================='));
  console.log();

  let projectDir = projectName;

  if (!projectDir) {
    projectDir = await selectProject('Select a project to compare screenshots for:');
    if (!projectDir) {
      return;
    }
  } else if (!projectDir.includes('-')) {
    projectDir = convertProjectNameToDirectory(projectName);
  }

  const projectConfig = loadProjectConfiguration(projectDir);

  if (!projectConfig) {
    console.log(chalk.red(`Project "${projectName}" not found.`));
    console.log();

    if (returnToMainMenu) {
      await input({
        message: 'Press Enter to return to main menu...',
        default: '',
      });

      const { showMainMenu } = await import('./main-menu.mjs');
      await showMainMenu();
    }
    return;
  }

  if (!projectConfig['visual-diff']) {
    console.log(chalk.yellow(`Visual regression is not configured for project "${projectConfig.name}".`));
    console.log(chalk.yellow('Please configure visual regression first.'));
    console.log();

    if (returnToMainMenu) {
      await input({
        message: 'Press Enter to return to main menu...',
        default: '',
      });

      const { showMainMenu } = await import('./main-menu.mjs');
      await showMainMenu();
    }
    return;
  }

  const snapshots = getProjectSnapshots(projectDir);
  const snapshotCount = Object.keys(snapshots).length;

  if (snapshotCount < 2) {
    console.log(chalk.yellow(`Project has ${snapshotCount} snapshot set(s).`));
    console.log(chalk.yellow('You need at least 2 snapshot sets to perform a comparison.'));
    console.log();

    if (returnToMainMenu) {
      await input({
        message: 'Press Enter to return to main menu...',
        default: '',
      });

      const { showMainMenu } = await import('./main-menu.mjs');
      await showMainMenu();
    }
    return;
  }

  console.log(chalk.cyan(`Project has ${snapshotCount} snapshot sets available for comparison:`));
  Object.entries(snapshots).forEach(([id, info]) => {
    console.log(chalk.cyan(`• ${id} (${new Date(info.date).toLocaleDateString()}, ${info.count} screenshots)`));
  });
  console.log();

  console.log(chalk.cyan('Select the source (before) snapshot set:'));
  const sourceId = await selectSnapshotSet(snapshots, 'Source snapshot set:');
  if (!sourceId) {
    if (returnToMainMenu) {
      await input({
        message: 'Press Enter to return to main menu...',
        default: '',
      });

      const { showMainMenu } = await import('./main-menu.mjs');
      await showMainMenu();
    }
    return;
  }

  console.log(chalk.cyan('Select the target (after) snapshot set:'));
  const targetId = await selectSnapshotSet(snapshots, 'Target snapshot set:', sourceId);
  if (!targetId) {
    if (returnToMainMenu) {
      await input({
        message: 'Press Enter to return to main menu...',
        default: '',
      });

      const { showMainMenu } = await import('./main-menu.mjs');
      await showMainMenu();
    }
    return;
  }

  const sourceDir = getScreenshotSetPath(projectDir, sourceId);
  const targetDir = getScreenshotSetPath(projectDir, targetId);
  const comparisonId = `${sourceId}--${targetId}`;
  const outputDir = getComparisonPath(projectDir, sourceId, targetId);

  console.log();
  console.log(chalk.cyan('⚙️  Comparison settings:'));
  console.log(chalk.cyan(`• Project: ${projectConfig.name}`));
  console.log(chalk.cyan(`• Source: ${sourceId}`));
  console.log(chalk.cyan(`• Target: ${targetId}`));
  console.log(chalk.cyan(`• Output: ${comparisonId}`));
  console.log();

  try {
    console.log(chalk.blue('Comparing screenshot sets...'));
    console.log();

    const comparisonResult = await compareScreenshots(sourceDir, targetDir, outputDir);

    const projectPath = path.join(projectsDir, projectDir);
    writeComparisonMetadata(projectPath, comparisonId, {
      source: sourceId,
      target: targetId,
      date: comparisonResult.date || new Date().toISOString(),
      statistics: comparisonResult.statistics
    });

    console.log();
    console.log(chalk.green(`✅ Comparison completed successfully!`));
    console.log(chalk.cyan(`🆔 Comparison ID: ${comparisonId}`));
    console.log(chalk.cyan(`📄 HTML Report: ${outputDir}/index.html`));
    console.log(chalk.cyan(`📈 JSON Report: ${outputDir}/reg.json`));


    if (comparisonResult.statistics) {
      const stats = comparisonResult.statistics;
      console.log(chalk.cyan(`🖼️ Total images: ${stats.total}`));
      console.log(chalk.cyan(`✅ Passed: ${stats.passed}`));
      console.log(chalk.cyan(`⚠️ Changed: ${stats.changed}`));
      console.log(chalk.cyan(`🆕 New: ${stats.new}`));
      console.log(chalk.cyan(`🗑️ Deleted: ${stats.deleted}`));
    }

    const openInBrowser = await confirm({
      message: 'Open comparison report in browser?',
      default: true
    });

    if (openInBrowser) {
      await openReportInBrowser(`${outputDir}/index.html`);
    }

    console.log();
  } catch (error) {
    console.log();
    console.log(chalk.red('Error comparing snapshots:'), error.message);
    console.log();
  }

  if (returnToMainMenu) {
    await input({
      message: 'Press Enter to return to main menu...',
      default: '',
    });

    const { showMainMenu } = await import('./main-menu.mjs');
    await showMainMenu();
  }
}

/**
 * Open a file in the default system browser
 *
 * @param {string} filePath - Path to the file to open
 * @returns {Promise<void>}
 */
async function openReportInBrowser(filePath) {
  const fileUrl = `file://${filePath}`;
  const osType = platform();
  let command;

  switch (osType) {
    case 'linux':
      command = `xdg-open "${fileUrl}"`;
      break;
    case 'darwin':
      command = `open "${fileUrl}"`;
      break;
    case 'win32':
      command = `start "" "${fileUrl}"`;
      break;
    default:
      console.log(chalk.yellow(`Cannot open browser on platform: ${osType}`));
      return;
  }

  try {
    console.log(chalk.cyan(`Opening report in browser...`));
    exec(command, (error) => {
      if (error) {
        console.log(chalk.yellow(`Could not open browser: ${error.message}`));
      }
    });
  } catch (error) {
    console.log(chalk.yellow(`Error opening browser: ${error.message}`));
  }
}
