/**
 * Main menu command for the CLI application
 */
import chalk from 'chalk';
import { select } from '@inquirer/prompts';
import { startNewProject } from './start-new-project.mjs';
import { loadExistingProject } from './load-existing-project.mjs';


/**
 * Shows the interactive main menu
 */
export async function showMainMenu() {
  console.clear();
  console.log(chalk.green('CivicTheme Update Helper'));
  console.log(chalk.cyan('version: 1.0'));
  console.log();

  const action = await select({
    message: 'What would you like to do?',
    choices: [
      { name: 'Start new project', value: 'new' },
      { name: 'Load existing project', value: 'load' },
      { name: 'Exit', value: 'exit' }
    ],
  });

  switch (action) {
    case 'new':
      await startNewProject();
      break;
    case 'load':
      await loadExistingProject();
      break;
    case 'exit':
      process.exit(0);
      break;
  }
}
