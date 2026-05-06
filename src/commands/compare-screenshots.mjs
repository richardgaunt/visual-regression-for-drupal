/**
 * Interactive-menu shell over the shared runCompare operation.
 */
import path from 'path';
import chalk from 'chalk';
import { input } from '@inquirer/prompts';
import {
  loadProjectConfiguration,
  convertProjectNameToDirectory,
  projectsDir
} from '../utils/project-manager.mjs';
import { selectProject } from './take-snapshot.mjs';
import { runCompare } from '../operations/compare.mjs';

export async function compareScreenshotSets(projectName, returnToMainMenu = true) {
  console.clear();
  console.log(chalk.green('Compare Visual Regression Screenshots'));
  console.log(chalk.cyan('===================================='));
  console.log();

  let projectDir = projectName;
  if (!projectDir) {
    projectDir = await selectProject('Select a project to compare screenshots for:');
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

  if (!projectConfig['visual-diff']) {
    console.log(chalk.yellow(`Visual regression is not configured for project "${projectConfig.name}".`));
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
    await runCompare({ projectPath, projectConfig, options: {}, isInteractive: true });
  } catch (error) {
    if (error.code === 'NOT_ENOUGH_SNAPSHOTS') {
      console.log(chalk.yellow(error.message));
      console.log(chalk.yellow('You need at least 2 snapshot sets to perform a comparison.'));
    } else {
      console.log();
      console.log(chalk.red('Error comparing snapshots:'), error.message);
    }
    console.log();
  }

  if (returnToMainMenu) {
    await input({ message: 'Press Enter to return to main menu...', default: '' });
    const { showMainMenu } = await import('./main-menu.mjs');
    await showMainMenu();
  }
}
