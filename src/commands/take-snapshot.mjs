/**
 * Take snapshot command for visual regression testing
 */
import chalk from 'chalk';
import { input, confirm, select } from '@inquirer/prompts';
import {
  loadProjectConfiguration,
  convertProjectNameToDirectory,
  getAllProjects
} from '../utils/project-manager.mjs';
import {
  createSnapshot,
  updateProjectWithSnapshot,
  getProjectSnapshots
} from '../lib/visual-regression/snapshot-manager.mjs';
import { getSessionCookies, getBasicAuth } from '../lib/session-store.mjs';
import { promptForAuthentication } from '../lib/cookie-prompts.mjs';

/**
 * Select a project from the available projects
 *
 * @param {string} message - Prompt message
 * @returns {Promise<string|null>} - Selected project directory name or null if canceled
 */
export async function selectProject(message = 'Select a project:') {
  // Get all saved projects
  const projects = getAllProjects();

  if (projects.length === 0) {
    console.log(chalk.yellow('No projects found.'));
    console.log(chalk.cyan('Please create a new project first.'));
    console.log();
    return null;
  }

  // Create choices for select prompt
  const choices = projects.map(project => ({
    name: project.name,
    value: project.directoryName,
    description: `Created: ${new Date(project.createdAt).toLocaleDateString()}`
  }));

  choices.push({
    name: chalk.cyan('← Cancel'),
    value: 'cancel'
  });

  // Show project selection
  const selectedProject = await select({
    message: message,
    choices: choices
  });

  return selectedProject !== 'cancel' ? selectedProject : null;
}

/**
 * Take a snapshot of a project
 *
 * @param {string} projectName - Project name or directory
 * @param {boolean} returnToMainMenu - Whether to return to main menu after completion (default: true)
 * @returns {Promise<void>}
 */
export async function takeSnapshot(projectName, returnToMainMenu = true) {
  console.clear();
  console.log(chalk.green('Take Visual Regression Snapshot'));
  console.log(chalk.cyan('=============================='));
  console.log();

  let projectDir = projectName;

  if (!projectDir) {
    projectDir = await selectProject('Select a project to take a snapshot of:');
    if (!projectDir) {
      return;
    }
  } else if (!projectDir.includes('-')) {
    projectDir = convertProjectNameToDirectory(projectName);
  }

  const projectConfig = loadProjectConfiguration(projectDir);

  if (!projectConfig) {
    console.log(chalk.red(`Project "${projectName}" not found.`));
    console.log();

    if (returnToMainMenu) {
      await input({
        message: 'Press Enter to return to main menu...',
        default: '',
      });

      const { showMainMenu } = await import('./main-menu.mjs');
      await showMainMenu();
    }
    return;
  }

  const snapshots = getProjectSnapshots(projectDir);
  const snapshotCount = Object.keys(snapshots).length;

  if (snapshotCount > 0) {
    console.log(chalk.cyan(`Project has ${snapshotCount} existing snapshot(s):`));

    Object.entries(snapshots).forEach(([id, info]) => {
      console.log(chalk.cyan(`• ${id} (${new Date(info.date).toLocaleDateString()}, ${info.count} screenshots)`));
    });

    console.log();
  }

  const defaultSnapshotId = `snapshot-${new Date().toISOString().split('T')[0].replace(/-/g, '')}`;
  const snapshotId = await input({
    message: 'Enter a snapshot ID:',
    default: defaultSnapshotId,
    validate: (value) => {
      if (!value.trim()) {
        return 'Snapshot ID is required';
      }

      return true;
    }
  });

  console.log();
  console.log(chalk.cyan('⚙️  Snapshot settings:'));
  console.log(chalk.cyan(`• Project: ${projectConfig.name}`));
  console.log(chalk.cyan(`• Base URL: ${projectConfig['visual-diff'].base_path}`));
  console.log(chalk.cyan(`• Paths: ${projectConfig['visual-diff'].paths.join(', ')}`));
  console.log(chalk.cyan(`• Viewports: ${projectConfig['visual-diff'].viewports.map(v => v.name).join(', ')}`));
  console.log(chalk.cyan(`• Snapshot ID: ${snapshotId}`));

  // Prompt for authentication
  const baseUrl = projectConfig['visual-diff'].base_path;
  await promptForAuthentication(projectDir, baseUrl);

  console.log();

  try {
    let overwrite = false;
    if (snapshots[snapshotId]) {
      console.log(chalk.yellow(`Snapshot "${snapshotId}" already exists.`));
      overwrite = await confirm({
        message: 'Do you want to overwrite the existing snapshot?',
        default: false
      });

      if (!overwrite) {
        console.log(chalk.yellow('Snapshot capture cancelled.'));
        console.log();

        await input({
          message: 'Press Enter to return to main menu...',
          default: '',
        });

        const { showMainMenu } = await import('./main-menu.mjs');
        await showMainMenu();
        return;
      }

      console.log(chalk.yellow(`Existing snapshot "${snapshotId}" will be overwritten.`));
    }

    console.log(chalk.blue('Taking snapshot...'));

    // Get authentication if available
    const cookies = getSessionCookies(projectDir);
    const basicAuth = getBasicAuth(projectDir);

    if (basicAuth) {
      console.log(chalk.green(`Using basic authentication for user: ${basicAuth.username}`));
    }
    if (cookies.length > 0) {
      console.log(chalk.green(`Using ${cookies.length} session cookie(s) for authenticated access.`));
    }
    console.log();

    const snapshotInfo = await createSnapshot(
      projectDir,
      snapshotId,
      projectConfig['visual-diff'],
      overwrite,
      cookies,
      basicAuth
    );

    await updateProjectWithSnapshot(projectDir, snapshotInfo);

    console.log();
    console.log(chalk.green(`✅ Snapshot "${snapshotId}" created successfully!`));
    console.log(chalk.cyan(`📷 Captured ${snapshotInfo.count} screenshots`));
    console.log(chalk.cyan(`📁 Saved to ${snapshotInfo.directory}`));
    console.log();
  } catch (error) {
    console.log();
    console.log(chalk.red('Error taking snapshot:'), error.message);
    console.log();
  }

  if (returnToMainMenu) {
    await input({
      message: 'Press Enter to return to main menu...',
      default: '',
    });

    const { showMainMenu } = await import('./main-menu.mjs');
    await showMainMenu();
  }
}
