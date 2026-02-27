/**
 * CLI command: vr-drupal show
 * Show details of a visual regression project
 */
import { Command } from 'commander';
import chalk from 'chalk';
import { join, resolve } from 'path';
import { select } from '@inquirer/prompts';
import { getAllSnapshots, getAllComparisons } from '../../lib/visual-regression/snapshot-manager.mjs';
import {
  getAllProjects,
  loadProjectFromDirectory,
  resolveProjectDir,
  projectsDir
} from '../../utils/project-manager.mjs';

export const showCommand = new Command('show')
  .description('Show details of a visual regression project')
  .argument('[project]', 'Project name')
  .option('--project-dir <dir>', 'Directory containing project.json')
  .option('--snapshots', 'List snapshots')
  .option('--comparisons', 'List comparisons')
  .option('--config', 'Show full configuration')
  .option('--format <format>', 'Output format: text, json', 'text')
  .action(async (projectArg, options) => {
    let projectConfig = null;

    // Check for project directory from option or environment variable
    const resolvedProjectDir = resolveProjectDir(options);

    // Determine project source
    let projectDir;
    if (resolvedProjectDir) {
      projectDir = resolve(resolvedProjectDir);
    } else if (projectArg) {
      projectDir = join(projectsDir, projectArg);
    } else {
      // Interactive selection
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
    }

    projectConfig = loadProjectFromDirectory(projectDir);
    if (!projectConfig) {
      console.error(chalk.red(`Error: No project.json found in ${projectDir}`));
      process.exit(3);
    }

    // JSON output
    if (options.format === 'json') {
      let output = projectConfig;

      if (options.snapshots) {
        output = getAllSnapshots(projectDir);
      } else if (options.comparisons) {
        output = getAllComparisons(projectDir);
      } else if (options.config) {
        output = projectConfig['visual-diff'] || {};
      }

      console.log(JSON.stringify(output, null, 2));
      return;
    }

    // Text output
    console.log();
    console.log(chalk.green.bold(projectConfig.name));
    console.log(chalk.cyan('='.repeat(projectConfig.name.length)));
    console.log();

    // Show configuration if requested or no specific option
    if (options.config || (!options.snapshots && !options.comparisons)) {
      console.log(chalk.white.bold('Configuration:'));
      console.log(chalk.cyan(`  Directory: ${projectConfig.directoryName}`));
      console.log(chalk.cyan(`  Created: ${new Date(projectConfig.createdAt).toLocaleString()}`));
      console.log(chalk.cyan(`  Updated: ${new Date(projectConfig.updatedAt).toLocaleString()}`));
      console.log();

      if (projectConfig['visual-diff']) {
        const vd = projectConfig['visual-diff'];
        console.log(chalk.white.bold('Visual Regression Settings:'));
        console.log(chalk.cyan(`  Base URL: ${vd.base_path}`));
        console.log(chalk.cyan(`  Paths: ${vd.paths?.length || 0}`));

        if (vd.paths && vd.paths.length <= 10) {
          vd.paths.forEach(p => console.log(chalk.gray(`    - ${p}`)));
        } else if (vd.paths) {
          vd.paths.slice(0, 5).forEach(p => console.log(chalk.gray(`    - ${p}`)));
          console.log(chalk.gray(`    ... and ${vd.paths.length - 5} more`));
        }

        console.log(chalk.cyan(`  Viewports: ${vd.viewports?.map(v => `${v.name} (${v.windowWidth}x${v.windowHeight})`).join(', ') || 'None'}`));

        if (vd.advanced) {
          console.log(chalk.cyan('  Advanced:'));
          console.log(chalk.gray(`    - CSS transitions disabled: ${vd.advanced.disable_css_transitions}`));
          console.log(chalk.gray(`    - Hide mask selectors: ${vd.advanced.hide_mask_selectors}`));
          console.log(chalk.gray(`    - Replace images: ${vd.advanced.replace_images_with_solid_color}`));
          console.log(chalk.gray(`    - Settle delay: ${vd.advanced.settle_delay_ms}ms`));
        }
        console.log();
      }
    }

    // Show snapshots
    if (options.snapshots || (!options.config && !options.comparisons)) {
      const snapshots = getAllSnapshots(projectDir);
      const snapshotIds = Object.keys(snapshots);

      console.log(chalk.white.bold(`Snapshots (${snapshotIds.length}):`));

      if (snapshotIds.length === 0) {
        console.log(chalk.gray('  No snapshots yet'));
      } else {
        for (const id of snapshotIds) {
          const snapshot = snapshots[id];
          console.log(chalk.cyan(`  ${id}`));
          console.log(chalk.gray(`    Date: ${new Date(snapshot.date).toLocaleString()}`));
          console.log(chalk.gray(`    Screenshots: ${snapshot.count}`));
          console.log(chalk.gray(`    Directory: ${snapshot.directory}`));
        }
      }
      console.log();
    }

    // Show comparisons
    if (options.comparisons || (!options.config && !options.snapshots)) {
      const comparisons = getAllComparisons(projectDir);
      const comparisonIds = Object.keys(comparisons);

      console.log(chalk.white.bold(`Comparisons (${comparisonIds.length}):`));

      if (comparisonIds.length === 0) {
        console.log(chalk.gray('  No comparisons yet'));
      } else {
        for (const id of comparisonIds) {
          const comparison = comparisons[id];
          console.log(chalk.cyan(`  ${id}`));
          console.log(chalk.gray(`    Source: ${comparison.source}`));
          console.log(chalk.gray(`    Target: ${comparison.target}`));
          console.log(chalk.gray(`    Date: ${new Date(comparison.date).toLocaleString()}`));

          if (comparison.statistics) {
            const stats = comparison.statistics;
            const hasChanges = stats.changed > 0 || stats.new > 0 || stats.deleted > 0;
            console.log(chalk.gray(`    Results: ${stats.passed}/${stats.total} passed${hasChanges ? ` (${stats.changed} changed, ${stats.new} new, ${stats.deleted} deleted)` : ''}`));
          }
        }
      }
      console.log();
    }
  });
