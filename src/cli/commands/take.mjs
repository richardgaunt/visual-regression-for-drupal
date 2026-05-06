/**
 * CLI command: vr-drupal take
 * Take visual regression screenshots
 */
import { Command } from 'commander';
import chalk from 'chalk';
import { join, resolve } from 'path';
import { select } from '@inquirer/prompts';
import { runTake } from '../../operations/take.mjs';
import {
  getAllProjects,
  loadProjectFromDirectory,
  resolveProjectDir,
  projectsDir
} from '../../utils/project-manager.mjs';

export const takeCommand = new Command('take')
  .description('Take visual regression screenshots')
  .argument('[project]', 'Project name (for built-in projects)')
  .option('--project-dir <dir>', 'Directory containing project.json')
  .option('--id <id>', 'Snapshot ID')
  .option('--auth-type <type>', 'Authentication type: none, basic, cookie')
  .option('--username <user>', 'Basic auth username')
  .option('--password <pass>', 'Basic auth password')
  .option('--cookies <string>', 'Cookie string: "name1=val1; name2=val2"')
  .option('--overwrite', 'Overwrite existing snapshot')
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
        choices: projects.map(p => ({
          name: p.name,
          value: p.directoryName,
          description: `Created: ${new Date(p.createdAt).toLocaleDateString()}`
        }))
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
      await runTake({
        projectPath: projectDir,
        projectConfig,
        options: {
          snapshotId: options.id,
          overwrite: options.overwrite,
          username: options.username,
          password: options.password,
          cookies: options.cookies,
          authType: options.authType
        },
        isInteractive
      });
    } catch (error) {
      if (error.code === 'MISSING_INPUT') {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(2);
      }
      console.error(chalk.red(`Error taking snapshot: ${error.message}`));
      process.exit(6);
    }
  });
