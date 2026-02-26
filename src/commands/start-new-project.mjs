/**
 * Start new project command
 */
import chalk from 'chalk';
import { input } from '@inquirer/prompts';
import {
  convertProjectNameToDirectory,
  checkProjectExists,
  saveProjectConfiguration
} from '../utils/project-manager.mjs';
import { promptForVisualRegressionConfig } from '../lib/visual-regression/prompts.mjs';

/**
 * Handles the flow for starting a new project
 */
export async function startNewProject() {
  console.clear();
  console.log(chalk.green('Start New Project'));
  console.log(chalk.cyan('================='));
  console.log();

  let projectName = await input({
    message: 'What is the name of the project?',
    validate: (value) => value.trim() ? true : 'Project name is required'
  });

  let directoryName = convertProjectNameToDirectory(projectName);
  while (checkProjectExists(directoryName)) {
    console.log(chalk.yellow(`A project named "${projectName}" already exists.`));
    projectName = await input({
      message: 'Please enter a different project name:',
      validate: (value) => value.trim() ? true : 'Project name is required'
    });
    directoryName = convertProjectNameToDirectory(projectName);
  }

  try {
    const visualDiffConfig = await promptForVisualRegressionConfig();
    const projectConfig = {
      name: projectName,
      directoryName: directoryName,
      'visual-diff': visualDiffConfig,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const filePath = saveProjectConfiguration(projectConfig);

    console.log(chalk.green('✅ Project created successfully!'));
    console.log(chalk.cyan(`📋 Name: ${projectName}`));
    console.log(chalk.cyan('📸 Visual Regression Testing:'));
    console.log(chalk.cyan(`  • Base URL: ${visualDiffConfig.base_path}`));
    console.log(chalk.cyan(`  • Viewports: ${visualDiffConfig.viewports.length} configured`));
    console.log(chalk.cyan(`  • Paths: ${visualDiffConfig.paths.join(', ')}`));
    console.log(chalk.cyan(`  • Advanced snapshot settings: ${JSON.stringify(visualDiffConfig.advanced)}`));
    console.log(chalk.yellowBright(`• Configuration file saved and can be edited at: ${filePath}`));
  } catch (error) {
    console.log(chalk.red('Error creating project:'), error.message);
  }

  await input({
    message: 'Press Enter to return to main menu...',
    default: '',
  });

  const { showMainMenu } = await import('./main-menu.mjs');
  await showMainMenu();
}
