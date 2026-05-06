#!/usr/bin/env node
/**
 * CivicTheme Visual Regression - Main entry point
 */
import { program } from 'commander';
import { showMainMenu } from './src/commands/index.mjs';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
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
  const { loadProjectFromDirectory } = await import('./src/utils/project-manager.mjs');
  const { runTake } = await import('./src/operations/take.mjs');
  const { runCompare } = await import('./src/operations/compare.mjs');
  const { runShow } = await import('./src/operations/show.mjs');

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

  const ctx = { projectPath: absoluteProjectDir, projectConfig, options: {}, isInteractive: true };

  try {
    if (action === 'snapshot') {
      await runTake(ctx);
    } else if (action === 'compare') {
      await runCompare(ctx);
    } else if (action === 'show') {
      runShow(ctx);
    } else if (action === 'exit') {
      process.exit(0);
    }
  } catch (error) {
    if (error.code === 'NOT_ENOUGH_SNAPSHOTS') {
      console.log(chalk.yellow(error.message));
    } else {
      console.log(chalk.red(`Error: ${error.message}`));
    }
  }

  await input({ message: 'Press Enter to continue...', default: '' });
  await showExternalProjectMenu(projectDir);
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
