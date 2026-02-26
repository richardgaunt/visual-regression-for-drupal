/**
 * CLI command: ct-vizdiff delete
 * Delete a visual regression project, snapshot, or comparison
 */
import { Command } from 'commander';
import chalk from 'chalk';
import { existsSync, rmSync } from 'fs';
import { join, resolve } from 'path';
import { select, confirm } from '@inquirer/prompts';
import {
  getAllProjects,
  loadProjectConfiguration,
  loadProjectFromDirectory,
  saveProjectToDirectory,
  resolveProjectDir,
  deleteProject
} from '../../utils/project-manager.mjs';

export const deleteCommand = new Command('delete')
  .description('Delete a project, snapshot, or comparison')
  .argument('[project]', 'Project name')
  .option('--project-dir <dir>', 'Directory containing project.json')
  .option('--snapshot <id>', 'Delete specific snapshot')
  .option('--comparison <id>', 'Delete specific comparison')
  .option('--force', 'Skip confirmation')
  .option('--no-interactive', 'Run non-interactively')
  .action(async (projectArg, options) => {
    const isInteractive = options.interactive !== false;
    let projectConfig = null;
    let projectDir = null;
    let projectIdentifier = null;
    let baseDir = null;
    let isExternalProject = false;

    // Check for project directory from option or environment variable
    const resolvedProjectDir = resolveProjectDir(options);

    // Determine project source
    if (resolvedProjectDir) {
      projectDir = resolve(resolvedProjectDir);
      projectConfig = loadProjectFromDirectory(projectDir);
      baseDir = projectDir;
      isExternalProject = true;

      if (!projectConfig) {
        console.error(chalk.red(`Error: No project.json found in ${projectDir}`));
        process.exit(3);
      }
      projectIdentifier = projectDir;
    } else if (projectArg) {
      projectConfig = loadProjectConfiguration(projectArg);
      if (!projectConfig) {
        console.error(chalk.red(`Error: Project "${projectArg}" not found`));
        process.exit(3);
      }
      projectIdentifier = projectArg;
      baseDir = join(process.cwd(), 'projects', projectArg);
    } else if (isInteractive) {
      const projects = getAllProjects();

      if (projects.length === 0) {
        console.error(chalk.red('No projects found.'));
        process.exit(3);
      }

      const choices = projects.map(p => ({
        name: p.name,
        value: p.directoryName
      }));

      projectIdentifier = await select({
        message: 'Select a project:',
        choices
      });

      projectConfig = loadProjectConfiguration(projectIdentifier);
      baseDir = join(process.cwd(), 'projects', projectIdentifier);
    } else {
      console.error(chalk.red('Error: Project name or --project-dir required in non-interactive mode'));
      process.exit(2);
    }

    // Delete specific snapshot
    if (options.snapshot) {
      const snapshotId = options.snapshot;
      const snapshots = projectConfig.snapshots || {};

      if (!snapshots[snapshotId]) {
        console.error(chalk.red(`Error: Snapshot "${snapshotId}" not found`));
        process.exit(4);
      }

      if (!options.force && isInteractive) {
        const confirmed = await confirm({
          message: `Delete snapshot "${snapshotId}"?`,
          default: false
        });
        if (!confirmed) {
          console.log(chalk.yellow('Deletion cancelled.'));
          return;
        }
      }

      // Delete snapshot directory
      const snapshotDir = join(baseDir, snapshots[snapshotId].directory);
      if (existsSync(snapshotDir)) {
        rmSync(snapshotDir, { recursive: true, force: true });
      }

      // Update config
      delete projectConfig.snapshots[snapshotId];

      if (isExternalProject) {
        saveProjectToDirectory(projectDir, projectConfig);
      } else {
        const { saveProjectConfiguration } = await import('../../utils/project-manager.mjs');
        saveProjectConfiguration(projectConfig);
      }

      console.log(chalk.green(`Snapshot "${snapshotId}" deleted.`));
      return;
    }

    // Delete specific comparison
    if (options.comparison) {
      const comparisonId = options.comparison;
      const comparisons = projectConfig.comparisons || {};

      if (!comparisons[comparisonId]) {
        console.error(chalk.red(`Error: Comparison "${comparisonId}" not found`));
        process.exit(4);
      }

      if (!options.force && isInteractive) {
        const confirmed = await confirm({
          message: `Delete comparison "${comparisonId}"?`,
          default: false
        });
        if (!confirmed) {
          console.log(chalk.yellow('Deletion cancelled.'));
          return;
        }
      }

      // Delete comparison directory
      const comparisonDir = join(baseDir, comparisons[comparisonId].directory);
      if (existsSync(comparisonDir)) {
        rmSync(comparisonDir, { recursive: true, force: true });
      }

      // Update config
      delete projectConfig.comparisons[comparisonId];

      if (isExternalProject) {
        saveProjectToDirectory(projectDir, projectConfig);
      } else {
        const { saveProjectConfiguration } = await import('../../utils/project-manager.mjs');
        saveProjectConfiguration(projectConfig);
      }

      console.log(chalk.green(`Comparison "${comparisonId}" deleted.`));
      return;
    }

    // Delete entire project
    if (!options.force) {
      if (isInteractive) {
        const snapshotCount = Object.keys(projectConfig.snapshots || {}).length;
        const comparisonCount = Object.keys(projectConfig.comparisons || {}).length;

        console.log(chalk.yellow(`This will delete project "${projectConfig.name}" including:`));
        console.log(chalk.yellow(`  - ${snapshotCount} snapshot(s)`));
        console.log(chalk.yellow(`  - ${comparisonCount} comparison(s)`));
        console.log();

        const confirmed = await confirm({
          message: 'Are you sure you want to delete this project?',
          default: false
        });

        if (!confirmed) {
          console.log(chalk.yellow('Deletion cancelled.'));
          return;
        }
      } else {
        console.error(chalk.red('Error: Use --force to delete without confirmation in non-interactive mode'));
        process.exit(2);
      }
    }

    // Perform deletion
    if (isExternalProject) {
      // Delete the entire project directory for external projects
      if (existsSync(projectDir)) {
        rmSync(projectDir, { recursive: true, force: true });
      }
    } else {
      // Use built-in delete for internal projects
      const success = deleteProject(projectIdentifier);
      if (!success) {
        console.error(chalk.red('Error: Failed to delete project'));
        process.exit(1);
      }
    }

    console.log(chalk.green(`Project "${projectConfig.name}" deleted.`));
  });
