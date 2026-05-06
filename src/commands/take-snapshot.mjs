/**
 * Interactive-menu shell over the shared runTake operation.
 */
import path from 'path';
import chalk from 'chalk';
import { input, select } from '@inquirer/prompts';
import {
  loadProjectConfiguration,
  convertProjectNameToDirectory,
  getAllProjects,
  projectsDir
} from '../utils/project-manager.mjs';
import { runTake } from '../operations/take.mjs';

/**
 * Project picker used by other menu commands too.
 */
export async function selectProject(message = 'Select a project:') {
  const projects = getAllProjects();
  if (projects.length === 0) {
    console.log(chalk.yellow('No projects found.'));
    console.log(chalk.cyan('Please create a new project first.'));
    console.log();
    return null;
  }

  const choices = projects.map(project => ({
    name: project.name,
    value: project.directoryName,
    description: `Created: ${new Date(project.createdAt).toLocaleDateString()}`
  }));
  choices.push({ name: chalk.cyan('← Cancel'), value: 'cancel' });

  const selected = await select({ message, choices });
  return selected !== 'cancel' ? selected : null;
}

/**
 * Take a snapshot of a project (interactive menu entry point).
 */
export async function takeSnapshot(projectName, returnToMainMenu = true) {
  console.clear();
  console.log(chalk.green('Take Visual Regression Snapshot'));
  console.log(chalk.cyan('=============================='));
  console.log();

  let projectDir = projectName;
  if (!projectDir) {
    projectDir = await selectProject('Select a project to take a snapshot of:');
    if (!projectDir) return;
  } else if (!projectDir.includes('-')) {
    projectDir = convertProjectNameToDirectory(projectName);
  }

  const projectConfig = loadProjectConfiguration(projectDir);
  if (!projectConfig) {
    console.log(chalk.red(`Project "${projectName}" not found.`));
    console.log();
    if (returnToMainMenu) {
      await input({ message: 'Press Enter to return to main menu...', default: '' });
      const { showMainMenu } = await import('./main-menu.mjs');
      await showMainMenu();
    }
    return;
  }

  const projectPath = path.join(projectsDir, projectDir);

  try {
    await runTake({ projectPath, projectConfig, options: {}, isInteractive: true });
  } catch (error) {
    console.log();
    console.log(chalk.red('Error taking snapshot:'), error.message);
    console.log();
  }

  if (returnToMainMenu) {
    await input({ message: 'Press Enter to return to main menu...', default: '' });
    const { showMainMenu } = await import('./main-menu.mjs');
    await showMainMenu();
  }
}
