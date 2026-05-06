/**
 * Shared "compare snapshots" operation.
 *
 * Single core invoked by the CLI compare subcommand, the main interactive menu,
 * and the external auto-detected project menu.
 */
import path from 'path';
import { existsSync } from 'fs';
import { exec } from 'child_process';
import { platform } from 'os';
import chalk from 'chalk';
import { select, confirm } from '@inquirer/prompts';
import { compareScreenshots, aggregateScreenshots } from '../lib/visual-regression/comparison.mjs';
import { ensureDirectory } from '../lib/visual-regression/screenshot-set-manager.mjs';
import { getAllSnapshots, writeComparisonMetadata } from '../lib/visual-regression/snapshot-manager.mjs';

class MissingInputError extends Error {
  constructor(message) {
    super(message);
    this.code = 'MISSING_INPUT';
  }
}

class NotEnoughSnapshotsError extends Error {
  constructor(message) {
    super(message);
    this.code = 'NOT_ENOUGH_SNAPSHOTS';
  }
}

export function openInBrowser(filePath) {
  const fileUrl = `file://${filePath}`;
  const osType = platform();
  let command;
  switch (osType) {
    case 'linux':  command = `xdg-open "${fileUrl}"`; break;
    case 'darwin': command = `open "${fileUrl}"`; break;
    case 'win32':  command = `start "" "${fileUrl}"`; break;
    default:
      console.log(chalk.yellow(`Cannot open browser on platform: ${osType}`));
      return;
  }
  exec(command, (error) => {
    if (error) console.log(chalk.yellow(`Could not open browser: ${error.message}`));
  });
}

/**
 * @param {Object} args
 * @param {string} args.projectPath - Absolute path to the project directory
 * @param {Object} args.projectConfig - Loaded project configuration
 * @param {Object} [args.options]
 * @param {string} [args.options.sourceId]
 * @param {string} [args.options.targetId]
 * @param {boolean} [args.options.open]
 * @param {boolean} [args.options.aggregate]
 * @param {string} [args.options.outputFormat] - 'html' | 'json'
 * @param {boolean} args.isInteractive
 * @returns {Promise<Object>} compare result
 */
export async function runCompare({ projectPath, projectConfig, options = {}, isInteractive }) {
  const snapshots = getAllSnapshots(projectPath);
  const snapshotIds = Object.keys(snapshots);
  if (snapshotIds.length < 2) {
    throw new NotEnoughSnapshotsError(`Need at least 2 snapshots to compare. Found: ${snapshotIds.length}`);
  }

  // Source
  let sourceId = options.sourceId;
  if (!sourceId) {
    if (isInteractive) {
      sourceId = await select({
        message: 'Select source (before) snapshot:',
        choices: snapshotIds.map(id => ({
          name: `${id} (${new Date(snapshots[id].date).toLocaleDateString()}, ${snapshots[id].count} screenshots)`,
          value: id
        }))
      });
    } else {
      throw new MissingInputError('--source required in non-interactive mode');
    }
  }
  if (!snapshots[sourceId]) {
    throw new MissingInputError(`Source snapshot "${sourceId}" not found`);
  }

  // Target
  let targetId = options.targetId;
  if (!targetId) {
    if (isInteractive) {
      targetId = await select({
        message: 'Select target (after) snapshot:',
        choices: snapshotIds.filter(id => id !== sourceId).map(id => ({
          name: `${id} (${new Date(snapshots[id].date).toLocaleDateString()}, ${snapshots[id].count} screenshots)`,
          value: id
        }))
      });
    } else {
      throw new MissingInputError('--target required in non-interactive mode');
    }
  }
  if (!snapshots[targetId]) {
    throw new MissingInputError(`Target snapshot "${targetId}" not found`);
  }

  const sourceDir = path.join(projectPath, snapshots[sourceId].directory);
  const targetDir = path.join(projectPath, snapshots[targetId].directory);
  const comparisonId = `${sourceId}--${targetId}`;
  const outputDir = path.join(projectPath, 'screenshot-sets', 'comparisons', comparisonId);

  if (!existsSync(sourceDir)) throw new MissingInputError(`Source directory not found: ${sourceDir}`);
  if (!existsSync(targetDir)) throw new MissingInputError(`Target directory not found: ${targetDir}`);

  console.log();
  console.log(chalk.cyan('Comparison settings:'));
  console.log(chalk.cyan(`  Project: ${projectConfig.name}`));
  console.log(chalk.cyan(`  Source: ${sourceId}`));
  console.log(chalk.cyan(`  Target: ${targetId}`));
  console.log();
  console.log(chalk.blue('Comparing screenshots...'));

  ensureDirectory(outputDir);
  const result = await compareScreenshots(sourceDir, targetDir, outputDir);

  if (options.aggregate) {
    aggregateScreenshots(sourceDir, targetDir, outputDir);
  }

  writeComparisonMetadata(projectPath, comparisonId, {
    source: sourceId,
    target: targetId,
    date: result.date || new Date().toISOString(),
    statistics: result.statistics
  });

  console.log();
  console.log(chalk.green('Comparison completed!'));
  if (result.statistics) {
    const s = result.statistics;
    console.log(chalk.cyan(`  Total: ${s.total}`));
    console.log(chalk.cyan(`  Passed: ${s.passed}`));
    console.log(s.changed > 0 ? chalk.yellow(`  Changed: ${s.changed}`) : chalk.cyan(`  Changed: ${s.changed}`));
    console.log(s.new > 0 ? chalk.yellow(`  New: ${s.new}`) : chalk.cyan(`  New: ${s.new}`));
    console.log(s.deleted > 0 ? chalk.yellow(`  Deleted: ${s.deleted}`) : chalk.cyan(`  Deleted: ${s.deleted}`));
  }

  const reportPath = path.join(outputDir, 'index.html');
  const jsonPath = path.join(outputDir, 'reg.json');
  console.log();
  console.log(chalk.cyan(`  HTML Report: ${reportPath}`));
  console.log(chalk.cyan(`  JSON Report: ${jsonPath}`));

  if (options.outputFormat === 'json') {
    console.log(JSON.stringify(result.statistics, null, 2));
  }

  if (options.open) {
    openInBrowser(reportPath);
  } else if (isInteractive) {
    const open = await confirm({ message: 'Open report in browser?', default: true });
    if (open) openInBrowser(reportPath);
  }

  return { ...result, comparisonId, reportPath, jsonPath };
}
