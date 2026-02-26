#!/usr/bin/env node
/**
 * CivicTheme Visual Regression - Main entry point
 */
import { program } from 'commander';
import { showMainMenu } from './src/commands/index.mjs';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { exec } from 'child_process';
import { platform } from 'os';
import chalk from 'chalk';
import {
  initCommand,
  takeCommand,
  compareCommand,
  listCommand,
  showCommand,
  deleteCommand,
  generateActionsCommand
} from './src/cli/commands/index.mjs';

/**
 * Open report in browser
 * @param {string} filePath - Path to HTML file
 */
function openInBrowser(filePath) {
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

  exec(command, (error) => {
    if (error) {
      console.log(chalk.yellow(`Could not open browser: ${error.message}`));
    }
  });
}


/**
 * Registers all available commands with the Commander program
 * @param {import('commander').Command} prog - The Commander program instance
 */
export function registerCommands(prog) {
  prog
    .name('vr-drupal')
    .version('1.0.0')
    .description('CivicTheme Visual Regression Testing Tool')
    .enablePositionalOptions()
    .option('--project-dir <dir>', 'Load project from specified directory');

  // Register CLI commands
  prog.addCommand(initCommand);
  prog.addCommand(takeCommand);
  prog.addCommand(compareCommand);
  prog.addCommand(listCommand);
  prog.addCommand(showCommand);
  prog.addCommand(deleteCommand);
  prog.addCommand(generateActionsCommand);

  return prog;
}

/**
 * Show interactive menu for a specific external project
 * @param {string} projectDir - Path to the project directory
 */
async function showExternalProjectMenu(projectDir) {
  const { select, input } = await import('@inquirer/prompts');
  const { loadProjectFromDirectory, saveProjectToDirectory } = await import('./src/utils/project-manager.mjs');
  const { compareScreenshots } = await import('./src/lib/visual-regression/comparison.mjs');
  const { captureUrlScreenshots, determineOptimalConcurrency } = await import('./src/lib/visual-regression/screenshot.mjs');
  const { ensureDirectory } = await import('./src/lib/visual-regression/screenshot-set-manager.mjs');

  const absoluteProjectDir = resolve(projectDir);
  const projectConfig = loadProjectFromDirectory(absoluteProjectDir);

  if (!projectConfig) {
    console.error(chalk.red(`Error: No valid project.json found in ${absoluteProjectDir}`));
    process.exit(3);
  }

  console.clear();
  console.log(chalk.green(`Project: ${projectConfig.name}`));
  console.log(chalk.cyan('='.repeat(projectConfig.name.length + 9)));
  console.log();
  console.log(chalk.cyan(`Directory: ${absoluteProjectDir}`));
  console.log(chalk.cyan(`URL: ${projectConfig['visual-diff'].base_path}`));
  console.log(chalk.cyan(`Paths: ${projectConfig['visual-diff'].paths.length}`));
  console.log();

  const action = await select({
    message: 'What would you like to do?',
    choices: [
      { name: 'Take visual regression snapshot', value: 'snapshot' },
      { name: 'Compare visual regression screenshots', value: 'compare' },
      { name: 'Show project details', value: 'show' },
      { name: chalk.cyan('Exit'), value: 'exit' }
    ]
  });

  switch (action) {
    case 'snapshot': {
      // Show existing snapshots
      const existingSnapshots = projectConfig.snapshots || {};
      const snapshotCount = Object.keys(existingSnapshots).length;

      if (snapshotCount > 0) {
        console.log();
        console.log(chalk.cyan(`Project has ${snapshotCount} existing snapshot(s):`));
        Object.entries(existingSnapshots).forEach(([id, info]) => {
          console.log(chalk.cyan(`  ${id} (${new Date(info.date).toLocaleDateString()}, ${info.count} screenshots)`));
        });
        console.log();
      }

      const defaultSnapshotId = `snapshot-${new Date().toISOString().split('T')[0].replace(/-/g, '')}`;
      const snapshotId = await input({
        message: 'Enter snapshot ID:',
        default: defaultSnapshotId
      });

      const snapshotDir = join(absoluteProjectDir, 'screenshot-sets', 'sets', snapshotId);

      if (existsSync(snapshotDir)) {
        const { confirm } = await import('@inquirer/prompts');
        const overwrite = await confirm({
          message: `Snapshot "${snapshotId}" exists. Overwrite?`,
          default: false
        });
        if (!overwrite) {
          console.log(chalk.yellow('Snapshot cancelled.'));
          await showExternalProjectMenu(projectDir);
          return;
        }
      }

      console.log(chalk.blue('Taking screenshots...'));
      ensureDirectory(snapshotDir);
      const concurrency = await determineOptimalConcurrency();

      const result = await captureUrlScreenshots({
        baseUrl: projectConfig['visual-diff'].base_path,
        paths: projectConfig['visual-diff'].paths,
        viewports: projectConfig['visual-diff'].viewports,
        outputDir: snapshotDir,
        concurrency,
        advancedOptions: projectConfig['visual-diff'].advanced
      });

      if (!projectConfig.snapshots) {
        projectConfig.snapshots = {};
      }
      projectConfig.snapshots[snapshotId] = {
        directory: `screenshot-sets/sets/${snapshotId}`,
        date: new Date().toISOString(),
        count: result.count
      };
      saveProjectToDirectory(absoluteProjectDir, projectConfig);

      console.log(chalk.green(`Snapshot "${snapshotId}" created with ${result.count} screenshots.`));
      await input({ message: 'Press Enter to continue...', default: '' });
      await showExternalProjectMenu(projectDir);
      break;
    }

    case 'compare': {
      const snapshots = projectConfig.snapshots || {};
      const snapshotIds = Object.keys(snapshots);

      if (snapshotIds.length < 2) {
        console.log(chalk.yellow(`Need at least 2 snapshots to compare. Found: ${snapshotIds.length}`));
        await input({ message: 'Press Enter to continue...', default: '' });
        await showExternalProjectMenu(projectDir);
        return;
      }

      const sourceId = await select({
        message: 'Select source (before) snapshot:',
        choices: snapshotIds.map(id => ({
          name: `${id} (${new Date(snapshots[id].date).toLocaleDateString()}, ${snapshots[id].count} screenshots)`,
          value: id
        }))
      });

      const targetId = await select({
        message: 'Select target (after) snapshot:',
        choices: snapshotIds.filter(id => id !== sourceId).map(id => ({
          name: `${id} (${new Date(snapshots[id].date).toLocaleDateString()}, ${snapshots[id].count} screenshots)`,
          value: id
        }))
      });

      const sourceDir = join(absoluteProjectDir, snapshots[sourceId].directory);
      const targetDir = join(absoluteProjectDir, snapshots[targetId].directory);
      const comparisonId = `${sourceId}--${targetId}`;
      const outputDir = join(absoluteProjectDir, 'screenshot-sets', 'comparisons', comparisonId);

      console.log(chalk.blue('Comparing screenshots...'));
      ensureDirectory(outputDir);

      const result = await compareScreenshots(sourceDir, targetDir, outputDir);

      if (!projectConfig.comparisons) {
        projectConfig.comparisons = {};
      }
      projectConfig.comparisons[comparisonId] = {
        source: sourceId,
        target: targetId,
        directory: `screenshot-sets/comparisons/${comparisonId}`,
        date: new Date().toISOString(),
        statistics: result.statistics
      };
      saveProjectToDirectory(absoluteProjectDir, projectConfig);

      const reportPath = join(outputDir, 'index.html');

      console.log(chalk.green('Comparison completed!'));
      if (result.statistics) {
        console.log(chalk.cyan(`  Total: ${result.statistics.total}, Passed: ${result.statistics.passed}, Changed: ${result.statistics.changed}`));
      }
      console.log(chalk.cyan(`  Report: ${reportPath}`));

      const { confirm } = await import('@inquirer/prompts');
      const openReport = await confirm({
        message: 'Open report in browser?',
        default: true
      });
      if (openReport) {
        openInBrowser(reportPath);
      }

      await input({ message: 'Press Enter to continue...', default: '' });
      await showExternalProjectMenu(projectDir);
      break;
    }

    case 'show': {
      console.log();
      console.log(chalk.white.bold('Configuration:'));
      console.log(chalk.cyan(`  URL: ${projectConfig['visual-diff'].base_path}`));
      console.log(chalk.cyan(`  Paths: ${projectConfig['visual-diff'].paths.length}`));
      console.log(chalk.cyan(`  Viewports: ${projectConfig['visual-diff'].viewports.map(v => v.name).join(', ')}`));
      console.log();

      const snapshots = projectConfig.snapshots || {};
      console.log(chalk.white.bold(`Snapshots (${Object.keys(snapshots).length}):`));
      for (const [id, snapshot] of Object.entries(snapshots)) {
        console.log(chalk.cyan(`  ${id}: ${snapshot.count} screenshots (${new Date(snapshot.date).toLocaleDateString()})`));
      }
      console.log();

      const comparisons = projectConfig.comparisons || {};
      console.log(chalk.white.bold(`Comparisons (${Object.keys(comparisons).length}):`));
      for (const [id, comparison] of Object.entries(comparisons)) {
        console.log(chalk.cyan(`  ${id}: ${comparison.source} vs ${comparison.target}`));
      }

      await input({ message: 'Press Enter to continue...', default: '' });
      await showExternalProjectMenu(projectDir);
      break;
    }

    case 'exit':
      process.exit(0);
  }
}

/**
 * Check if a directory contains a valid vr-drupal project
 * @param {string} projectDir - Path to check
 * @returns {boolean} - True if valid vr-drupal project
 */
function isValidVrDrupalProject(projectDir) {
  const configPath = join(projectDir, 'project.json');

  if (!existsSync(configPath)) {
    return false;
  }

  try {
    const content = readFileSync(configPath, 'utf8');
    const config = JSON.parse(content);

    // Check for vr-drupal specific properties
    return config && config['visual-diff'] && config.name;
  } catch {
    return false;
  }
}

/**
 * Detect a vr-drupal project in the current directory
 * Checks ./project.json and scans .visual-regression/ for projects
 * @returns {string|null} - Path to project directory or null
 */
function detectProjectInCurrentDirectory() {
  const cwd = process.cwd();

  // Check current directory for project.json
  if (isValidVrDrupalProject(cwd)) {
    return cwd;
  }

  // Scan .visual-regression/ for projects
  const vrDir = join(cwd, '.visual-regression');
  if (existsSync(vrDir)) {
    try {
      const dirs = readdirSync(vrDir, { withFileTypes: true })
        .filter(d => d.isDirectory() && isValidVrDrupalProject(join(vrDir, d.name)));

      if (dirs.length === 1) {
        return join(vrDir, dirs[0].name);
      }
      // If multiple projects, return null (fall through to main menu)
    } catch {
      // ignore
    }
  }

  return null;
}

/**
 * Main entry point for the CLI application
 */
export async function main() {
  // Check for --project-dir without a subcommand (interactive mode with external project)
  const projectDirIndex = process.argv.indexOf('--project-dir');
  const hasSubcommand = process.argv.some((arg, index) =>
    index > 1 && !arg.startsWith('-') && process.argv[index - 1] !== '--project-dir'
  );

  if (projectDirIndex !== -1 && !hasSubcommand) {
    // --project-dir provided without subcommand - show interactive menu for that project
    const projectDir = process.argv[projectDirIndex + 1];
    if (!projectDir || projectDir.startsWith('-')) {
      console.error(chalk.red('Error: --project-dir requires a directory path'));
      process.exit(2);
    }
    await showExternalProjectMenu(projectDir);
    return;
  }

  if (process.argv.length <= 2) {
    // No arguments - check for project in current directory
    const detectedProject = detectProjectInCurrentDirectory();
    if (detectedProject) {
      // Auto-load detected project
      console.log(chalk.cyan(`Detected project in: ${detectedProject}`));
      await showExternalProjectMenu(detectedProject);
    } else {
      // No project found - show main menu
      await showMainMenu();
    }
  } else {
    // Arguments provided - parse CLI commands
    const cli = registerCommands(program);
    await cli.parseAsync(process.argv);
  }
}

main();
