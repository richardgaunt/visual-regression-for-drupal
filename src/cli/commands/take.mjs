/**
 * CLI command: ct-vizdiff take
 * Take visual regression screenshots
 */
import { Command } from 'commander';
import chalk from 'chalk';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { input, confirm, select } from '@inquirer/prompts';
import { captureUrlScreenshots, determineOptimalConcurrency } from '../../lib/visual-regression/screenshot.mjs';
import { ensureDirectory } from '../../lib/visual-regression/screenshot-set-manager.mjs';
import {
  getAllProjects,
  loadProjectConfiguration,
  loadProjectFromDirectory,
  saveProjectToDirectory,
  resolveProjectDir
} from '../../utils/project-manager.mjs';
import {
  setSessionCookies,
  setBasicAuth,
  parseCookieString
} from '../../lib/session-store.mjs';

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
    let projectConfig = null;
    let projectDir = null;
    let projectIdentifier = null;

    // Check for project directory from option or environment variable
    const resolvedProjectDir = resolveProjectDir(options);

    // Determine project source
    if (resolvedProjectDir) {
      // Load from specified directory
      projectDir = resolve(resolvedProjectDir);
      projectConfig = loadProjectFromDirectory(projectDir);

      if (!projectConfig) {
        console.error(chalk.red(`Error: No project.json found in ${projectDir}`));
        process.exit(3);
      }
      projectIdentifier = projectDir;
    } else if (projectArg) {
      // Load from built-in projects
      projectConfig = loadProjectConfiguration(projectArg);
      if (!projectConfig) {
        console.error(chalk.red(`Error: Project "${projectArg}" not found`));
        process.exit(3);
      }
      projectIdentifier = projectArg;
    } else if (isInteractive) {
      // Interactive project selection
      const projects = getAllProjects();

      if (projects.length === 0) {
        console.error(chalk.red('No projects found. Create one with: ct-vizdiff init'));
        process.exit(3);
      }

      const choices = projects.map(p => ({
        name: p.name,
        value: p.directoryName,
        description: `Created: ${new Date(p.createdAt).toLocaleDateString()}`
      }));

      projectIdentifier = await select({
        message: 'Select a project:',
        choices
      });

      projectConfig = loadProjectConfiguration(projectIdentifier);
    } else {
      console.error(chalk.red('Error: Project name or --project-dir required in non-interactive mode'));
      process.exit(2);
    }

    // Show existing snapshots
    if (isInteractive && projectConfig.snapshots) {
      const snapshots = projectConfig.snapshots;
      const snapshotCount = Object.keys(snapshots).length;

      if (snapshotCount > 0) {
        console.log(chalk.cyan(`Project has ${snapshotCount} existing snapshot(s):`));
        Object.entries(snapshots).forEach(([id, info]) => {
          console.log(chalk.cyan(`  ${id} (${new Date(info.date).toLocaleDateString()}, ${info.count} screenshots)`));
        });
        console.log();
      }
    }

    // Get snapshot ID
    const defaultSnapshotId = `snapshot-${new Date().toISOString().split('T')[0].replace(/-/g, '')}`;
    let snapshotId = options.id;

    if (!snapshotId) {
      if (isInteractive) {
        snapshotId = await input({
          message: 'Enter snapshot ID:',
          default: defaultSnapshotId
        });
      } else {
        snapshotId = defaultSnapshotId;
      }
    }

    // Determine screenshot output directory
    let snapshotDir;
    if (projectDir) {
      // External project - store screenshots relative to project.json
      snapshotDir = join(projectDir, 'screenshot-sets', 'sets', snapshotId);
    } else {
      // Built-in project
      const rootProjectsDir = join(process.cwd(), 'projects');
      snapshotDir = join(rootProjectsDir, projectIdentifier, 'screenshot-sets', 'sets', snapshotId);
    }

    // Check if snapshot exists
    if (existsSync(snapshotDir)) {
      if (options.overwrite) {
        console.log(chalk.yellow(`Overwriting existing snapshot "${snapshotId}"...`));
      } else if (isInteractive) {
        const overwrite = await confirm({
          message: `Snapshot "${snapshotId}" exists. Overwrite?`,
          default: false
        });
        if (!overwrite) {
          console.log(chalk.yellow('Snapshot cancelled.'));
          process.exit(0);
        }
      } else {
        console.error(chalk.red(`Error: Snapshot "${snapshotId}" already exists. Use --overwrite to replace.`));
        process.exit(1);
      }
    }

    // Handle authentication
    let cookies = [];
    let basicAuth = null;

    if (options.authType === 'basic' || (options.username && options.password)) {
      if (!options.username || !options.password) {
        if (isInteractive) {
          const username = await input({ message: 'Enter username:' });
          const password = await input({ message: 'Enter password:', type: 'password' });
          basicAuth = { username, password };
        } else {
          console.error(chalk.red('Error: --username and --password required for basic auth'));
          process.exit(2);
        }
      } else {
        basicAuth = { username: options.username, password: options.password };
      }
      setBasicAuth(projectIdentifier, basicAuth);
    }

    if (options.authType === 'cookie' || options.cookies) {
      if (options.cookies) {
        const parsed = parseCookieString(options.cookies);
        if (parsed.errors.length > 0) {
          console.error(chalk.red('Error parsing cookies:'));
          parsed.errors.forEach(err => console.error(chalk.red(`  - ${err}`)));
          process.exit(2);
        }
        cookies = parsed.cookies;
        setSessionCookies(projectIdentifier, cookies);
      } else if (isInteractive) {
        const cookieStr = await input({
          message: 'Enter cookies (name1=val1; name2=val2):',
        });
        const parsed = parseCookieString(cookieStr);
        cookies = parsed.cookies;
        setSessionCookies(projectIdentifier, cookies);
      }
    }

    // Display settings
    console.log();
    console.log(chalk.cyan('Snapshot settings:'));
    console.log(chalk.cyan(`  Project: ${projectConfig.name}`));
    console.log(chalk.cyan(`  Base URL: ${projectConfig['visual-diff'].base_path}`));
    console.log(chalk.cyan(`  Paths: ${projectConfig['visual-diff'].paths.length}`));
    console.log(chalk.cyan(`  Viewports: ${projectConfig['visual-diff'].viewports.map(v => v.name).join(', ')}`));
    console.log(chalk.cyan(`  Snapshot ID: ${snapshotId}`));

    if (basicAuth) {
      console.log(chalk.green(`  Auth: Basic (${basicAuth.username})`));
    }
    if (cookies.length > 0) {
      console.log(chalk.green(`  Cookies: ${cookies.length} cookie(s)`));
    }

    console.log();
    console.log(chalk.blue('Taking screenshots...'));

    try {
      // Create snapshot directory
      ensureDirectory(snapshotDir);

      const concurrency = await determineOptimalConcurrency();

      const result = await captureUrlScreenshots({
        baseUrl: projectConfig['visual-diff'].base_path,
        paths: projectConfig['visual-diff'].paths,
        viewports: projectConfig['visual-diff'].viewports,
        outputDir: snapshotDir,
        concurrency,
        advancedOptions: projectConfig['visual-diff'].advanced,
        cookies,
        basicAuth
      });

      // Update project configuration with snapshot info
      const snapshotInfo = {
        directory: projectDir
          ? `screenshot-sets/sets/${snapshotId}`
          : `screenshot-sets/sets/${snapshotId}`,
        date: new Date().toISOString(),
        count: result.count
      };

      if (!projectConfig.snapshots) {
        projectConfig.snapshots = {};
      }
      projectConfig.snapshots[snapshotId] = snapshotInfo;

      // Save updated config
      if (projectDir) {
        saveProjectToDirectory(projectDir, projectConfig);
      } else {
        const { saveProjectConfiguration } = await import('../../utils/project-manager.mjs');
        saveProjectConfiguration(projectConfig);
      }

      console.log();
      console.log(chalk.green(`Snapshot "${snapshotId}" created successfully!`));
      console.log(chalk.cyan(`  Screenshots: ${result.count}`));
      console.log(chalk.cyan(`  Location: ${snapshotDir}`));
    } catch (error) {
      console.error(chalk.red(`Error taking snapshot: ${error.message}`));
      process.exit(6);
    }
  });
