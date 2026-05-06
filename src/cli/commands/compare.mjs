/**
 * CLI command: vr-drupal compare
 * Compare visual regression screenshots
 */
import { Command } from 'commander';
import chalk from 'chalk';
import { join, resolve } from 'path';
import { select } from '@inquirer/prompts';
import { runCompare } from '../../operations/compare.mjs';
import {
  getAllProjects,
  loadProjectFromDirectory,
  resolveProjectDir,
  projectsDir
} from '../../utils/project-manager.mjs';

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

    let projectDir;
    const resolvedProjectDir = resolveProjectDir(options);
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
      const selected = await select({
        message: 'Select a project:',
        choices: projects.map(p => ({ name: p.name, value: p.directoryName }))
      });
      projectDir = join(projectsDir, selected);
    } else {
      console.error(chalk.red('Error: Project name or --project-dir required in non-interactive mode'));
      process.exit(2);
    }

    const projectConfig = loadProjectFromDirectory(projectDir);
    if (!projectConfig) {
      console.error(chalk.red(`Error: No project.json found in ${projectDir}`));
      process.exit(3);
    }

    try {
      await runCompare({
        projectPath: projectDir,
        projectConfig,
        options: {
          sourceId: options.source,
          targetId: options.target,
          open: options.open,
          aggregate: options.aggregateScreenshots,
          outputFormat: options.outputFormat
        },
        isInteractive
      });
    } catch (error) {
      if (error.code === 'NOT_ENOUGH_SNAPSHOTS' || error.code === 'MISSING_INPUT') {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(error.code === 'NOT_ENOUGH_SNAPSHOTS' ? 4 : 2);
      }
      console.error(chalk.red(`Error comparing snapshots: ${error.message}`));
      process.exit(7);
    }
  });
