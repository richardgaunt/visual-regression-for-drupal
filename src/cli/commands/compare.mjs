/**
 * CLI command: vr-drupal compare
 * Compare visual regression screenshots
 */
import { Command } from 'commander';
import chalk from 'chalk';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { select, confirm } from '@inquirer/prompts';
import { exec } from 'child_process';
import { platform } from 'os';
import { compareScreenshots, aggregateScreenshots } from '../../lib/visual-regression/comparison.mjs';
import { ensureDirectory } from '../../lib/visual-regression/screenshot-set-manager.mjs';
import { getAllSnapshots } from '../../lib/visual-regression/snapshot-manager.mjs';
import {
  getAllProjects,
  loadProjectFromDirectory,
  saveProjectToDirectory,
  resolveProjectDir,
  projectsDir
} from '../../utils/project-manager.mjs';

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

export const compareCommand = new Command('compare')
  .description('Compare visual regression screenshots')
  .argument('[project]', 'Project name (for built-in projects)')
  .option('--project-dir <dir>', 'Directory containing project.json')
  .option('--source <id>', 'Source (before) snapshot ID')
  .option('--target <id>', 'Target (after) snapshot ID')
  .option('--open', 'Open report in browser')
  .option('--aggregate-screenshots', 'Copy screenshot sets into comparison directory for self-contained static hosting')
  .option('--output-format <format>', 'Output format: html, json', 'html')
  .option('--no-interactive', 'Run non-interactively')
  .action(async (projectArg, options) => {
    const isInteractive = options.interactive !== false;
    let projectConfig = null;
    let projectDir = null;

    // Check for project directory from option or environment variable
    const resolvedProjectDir = resolveProjectDir(options);

    // Determine project source
    if (resolvedProjectDir) {
      projectDir = resolve(resolvedProjectDir);
    } else if (projectArg) {
      projectDir = join(projectsDir, projectArg);
    } else if (isInteractive) {
      const projects = getAllProjects();

      if (projects.length === 0) {
        console.error(chalk.red('No projects found. Create one with: vr-drupal init'));
        process.exit(3);
      }

      const choices = projects.map(p => ({
        name: p.name,
        value: p.directoryName
      }));

      const selected = await select({
        message: 'Select a project:',
        choices
      });

      projectDir = join(projectsDir, selected);
    } else {
      console.error(chalk.red('Error: Project name or --project-dir required in non-interactive mode'));
      process.exit(2);
    }

    projectConfig = loadProjectFromDirectory(projectDir);
    if (!projectConfig) {
      console.error(chalk.red(`Error: No project.json found in ${projectDir}`));
      process.exit(3);
    }

    // Get snapshots from set.json files
    const snapshots = getAllSnapshots(projectDir);
    const snapshotIds = Object.keys(snapshots);

    if (snapshotIds.length < 2) {
      console.error(chalk.red(`Error: Need at least 2 snapshots to compare. Found: ${snapshotIds.length} at ${projectDir} project directory`));
      process.exit(4);
    }

    // Get source snapshot
    let sourceId = options.source;
    if (!sourceId) {
      if (isInteractive) {
        const choices = snapshotIds.map(id => ({
          name: `${id} (${new Date(snapshots[id].date).toLocaleDateString()}, ${snapshots[id].count} screenshots)`,
          value: id
        }));

        sourceId = await select({
          message: 'Select source (before) snapshot:',
          choices
        });
      } else {
        console.error(chalk.red('Error: --source required in non-interactive mode'));
        process.exit(2);
      }
    }

    if (!snapshots[sourceId]) {
      console.error(chalk.red(`Error: Source snapshot "${sourceId}" not found`));
      process.exit(4);
    }

    // Get target snapshot
    let targetId = options.target;
    if (!targetId) {
      if (isInteractive) {
        const choices = snapshotIds
          .filter(id => id !== sourceId)
          .map(id => ({
            name: `${id} (${new Date(snapshots[id].date).toLocaleDateString()}, ${snapshots[id].count} screenshots)`,
            value: id
          }));

        targetId = await select({
          message: 'Select target (after) snapshot:',
          choices
        });
      } else {
        console.error(chalk.red('Error: --target required in non-interactive mode'));
        process.exit(2);
      }
    }

    if (!snapshots[targetId]) {
      console.error(chalk.red(`Error: Target snapshot "${targetId}" not found`));
      process.exit(4);
    }

    // Set up paths
    const sourceDir = join(projectDir, snapshots[sourceId].directory);
    const targetDir = join(projectDir, snapshots[targetId].directory);
    const comparisonId = `${sourceId}--${targetId}`;
    const outputDir = join(projectDir, 'screenshot-sets', 'comparisons', comparisonId);

    if (!existsSync(sourceDir)) {
      console.error(chalk.red(`Error: Source directory not found: ${sourceDir}`));
      process.exit(4);
    }

    if (!existsSync(targetDir)) {
      console.error(chalk.red(`Error: Target directory not found: ${targetDir}`));
      process.exit(4);
    }

    console.log();
    console.log(chalk.cyan('Comparison settings:'));
    console.log(chalk.cyan(`  Project: ${projectConfig.name}`));
    console.log(chalk.cyan(`  Source: ${sourceId}`));
    console.log(chalk.cyan(`  Target: ${targetId}`));
    console.log();
    console.log(chalk.blue('Comparing screenshots...'));

    try {
      ensureDirectory(outputDir);

      const result = await compareScreenshots(sourceDir, targetDir, outputDir);

      if (options.aggregateScreenshots) {
        aggregateScreenshots(sourceDir, targetDir, outputDir);
      }

      // Update project with comparison info
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

      saveProjectToDirectory(projectDir, projectConfig);

      console.log();
      console.log(chalk.green('Comparison completed!'));

      if (result.statistics) {
        const stats = result.statistics;
        console.log(chalk.cyan(`  Total: ${stats.total}`));
        console.log(chalk.cyan(`  Passed: ${stats.passed}`));
        console.log(stats.changed > 0 ? chalk.yellow(`  Changed: ${stats.changed}`) : chalk.cyan(`  Changed: ${stats.changed}`));
        console.log(stats.new > 0 ? chalk.yellow(`  New: ${stats.new}`) : chalk.cyan(`  New: ${stats.new}`));
        console.log(stats.deleted > 0 ? chalk.yellow(`  Deleted: ${stats.deleted}`) : chalk.cyan(`  Deleted: ${stats.deleted}`));
      }

      const reportPath = join(outputDir, 'index.html');
      const jsonPath = join(outputDir, 'reg.json');

      console.log();
      console.log(chalk.cyan(`  HTML Report: ${reportPath}`));
      console.log(chalk.cyan(`  JSON Report: ${jsonPath}`));

      // Output JSON for scripting
      if (options.outputFormat === 'json') {
        console.log(JSON.stringify(result.statistics, null, 2));
      }

      // Open in browser
      if (options.open) {
        openInBrowser(reportPath);
      } else if (isInteractive) {
        const open = await confirm({
          message: 'Open report in browser?',
          default: true
        });
        if (open) {
          openInBrowser(reportPath);
        }
      }
    } catch (error) {
      console.error(chalk.red(`Error comparing snapshots: ${error.message}`));
      process.exit(7);
    }
  });
