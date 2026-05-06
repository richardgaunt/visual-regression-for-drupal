/**
 * CLI command: vr-drupal show
 * Show details of a visual regression project
 */
import { Command } from 'commander';
import chalk from 'chalk';
import { join, resolve } from 'path';
import { select } from '@inquirer/prompts';
import { runShow } from '../../operations/show.mjs';
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
    let projectDir;
    const resolvedProjectDir = resolveProjectDir(options);
    if (resolvedProjectDir) {
      projectDir = resolve(resolvedProjectDir);
    } else if (projectArg) {
      projectDir = join(projectsDir, projectArg);
    } else {
      const projects = getAllProjects();
      if (projects.length === 0) {
        console.error(chalk.red('No projects found. Create one with: vr-drupal init'));
        process.exit(3);
      }
      const selected = await select({
        message: 'Select a project:',
        choices: projects.map(p => ({ name: p.name, value: p.directoryName }))
      });
      projectDir = join(projectsDir, selected);
    }

    const projectConfig = loadProjectFromDirectory(projectDir);
    if (!projectConfig) {
      console.error(chalk.red(`Error: No project.json found in ${projectDir}`));
      process.exit(3);
    }

    runShow({
      projectPath: projectDir,
      projectConfig,
      options: {
        snapshots: options.snapshots,
        comparisons: options.comparisons,
        config: options.config,
        format: options.format
      }
    });
  });
