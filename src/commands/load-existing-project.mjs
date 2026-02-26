/**
 * Load existing project command
 */
import chalk from 'chalk';
import { select, input } from '@inquirer/prompts';
import { getAllProjects, loadProjectConfiguration } from '../utils/project-manager.mjs';
import { compareScreenshotSets } from './compare-screenshots.mjs';
import { clearAllAuth } from '../lib/session-store.mjs';

/**
 * Handles the flow for loading an existing project
 */
export async function loadExistingProject() {
  console.clear();
  console.log(chalk.green('Load Existing Project'));
  console.log(chalk.cyan('====================='));
  console.log();

  const projects = getAllProjects();

  if (projects.length === 0) {
    console.log(chalk.yellow('No projects found.'));
    console.log(chalk.cyan('Please create a new project first.'));
    console.log();

    await input({
      message: 'Press Enter to return to main menu...',
      default: '',
    });

    const { showMainMenu } = await import('./main-menu.mjs');
    await showMainMenu();
    return;
  }

  const choices = projects.map(project => ({
    name: project.name,
    value: project.directoryName,
    description: `Created: ${new Date(project.createdAt).toLocaleDateString()}`
  }));

  choices.push({
    name: chalk.cyan('← Return to main menu'),
    value: 'return'
  });

  const selectedProject = await select({
    message: 'Select a project:',
    choices: choices
  });

  if (selectedProject !== 'return') {
    // Clear any existing auth when loading a new project
    clearAllAuth(selectedProject);
    await showProjectMenu(selectedProject);
  } else {
    const { showMainMenu } = await import('./main-menu.mjs');
    await showMainMenu();
  }
}

/**
 * Compare snapshot sets.
 */
async function compareScreenshotSetsMenu(selectedProject) {
  await compareScreenshotSets(selectedProject, false);

  await input({
    message: 'Press Enter to continue...',
    default: '',
  });
  await showProjectMenu(selectedProject);
}

/**
 * Shows the project menu for a loaded project
 * @param {string} selectedProject - The selected project directory name
 */
async function showProjectMenu(selectedProject) {
  const projectConfig = loadProjectConfiguration(selectedProject);

  if (!projectConfig) {
    console.log();
    console.log(chalk.red('Error loading project configuration.'));
    console.log();

    await input({
      message: 'Press Enter to return to project selection...',
      default: '',
    });

    await loadExistingProject();
    return;
  }


  console.log(chalk.green(`Project: ${projectConfig.name}`));
  console.log(chalk.cyan('='.repeat(projectConfig.name.length + 9)));
  console.log();
  console.log(chalk.cyan('Project details:'));
  console.log(chalk.cyan(`• Created: ${new Date(projectConfig.createdAt).toLocaleString()}`));
  console.log(chalk.cyan(`• Updated: ${new Date(projectConfig.updatedAt).toLocaleString()}`));

  const action = await select({
    message: 'What would you like to do with this project?',
    choices: [
      { name: 'Take visual regression snapshot', value: 'snapshot' },
      { name: 'Compare visual regression screenshots', value: 'compare' },
      { name: chalk.cyan('← Back to project selection'), value: 'back' },
      { name: chalk.cyan('← Return to main menu'), value: 'return' }
    ]
  });

  switch (action) {
    case 'snapshot': {
      const { takeSnapshot } = await import('./take-snapshot.mjs');
      await takeSnapshot(selectedProject, false);

      await input({
        message: 'Press Enter to continue...',
        default: '',
      });
      await showProjectMenu(selectedProject);
      break;
    }

    case 'compare':
      await compareScreenshotSetsMenu(selectedProject);
      break;

    case 'back':
      // Clear auth when going back to project selection
      clearAllAuth(selectedProject);
      await loadExistingProject();
      break;

    case 'return': {
      // Clear auth when returning to main menu
      clearAllAuth(selectedProject);
      const { showMainMenu } = await import('./main-menu.mjs');
      await showMainMenu();
      break;
    }
  }
}
