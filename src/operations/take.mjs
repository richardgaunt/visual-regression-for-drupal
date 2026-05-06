/**
 * Shared "take snapshot" operation.
 *
 * Single core invoked by all three shells (CLI subcommand, main interactive menu,
 * external auto-detected project menu). Each shell resolves the project path and
 * config, then calls runTake — keeping snapshot/auth/prompt logic in one place.
 */
import path from 'path';
import { existsSync } from 'fs';
import chalk from 'chalk';
import { input, confirm } from '@inquirer/prompts';
import { createSnapshot, getAllSnapshots } from '../lib/visual-regression/snapshot-manager.mjs';
import {
  setBasicAuth,
  setSessionCookies,
  getBasicAuth,
  getSessionCookies,
  parseCookieString
} from '../lib/session-store.mjs';
import { promptForAuthentication } from '../lib/cookie-prompts.mjs';

class MissingInputError extends Error {
  constructor(message) {
    super(message);
    this.code = 'MISSING_INPUT';
  }
}

/**
 * @param {Object} args
 * @param {string} args.projectPath - Absolute path to the project directory
 * @param {Object} args.projectConfig - Loaded project configuration
 * @param {Object} [args.options] - Caller-supplied inputs (typically CLI flags)
 * @param {string} [args.options.snapshotId]
 * @param {boolean} [args.options.overwrite]
 * @param {string} [args.options.username]
 * @param {string} [args.options.password]
 * @param {string} [args.options.cookies] - Raw cookie string ("a=1; b=2")
 * @param {string} [args.options.authType] - 'basic' | 'cookie' | 'none'
 * @param {boolean} args.isInteractive - Prompt for missing inputs when true
 * @returns {Promise<Object>} snapshotInfo
 */
export async function runTake({ projectPath, projectConfig, options = {}, isInteractive }) {
  const visualDiff = projectConfig['visual-diff'];

  // Snapshot listing — always show in interactive mode.
  const existingSnapshots = getAllSnapshots(projectPath);
  if (isInteractive && Object.keys(existingSnapshots).length > 0) {
    console.log();
    console.log(chalk.cyan(`Project has ${Object.keys(existingSnapshots).length} existing snapshot(s):`));
    Object.entries(existingSnapshots).forEach(([id, info]) => {
      console.log(chalk.cyan(`  ${id} (${new Date(info.date).toLocaleDateString()}, ${info.count} screenshots)`));
    });
    console.log();
  }

  // Snapshot ID
  let snapshotId = options.snapshotId;
  const defaultSnapshotId = `snapshot-${new Date().toISOString().split('T')[0].replace(/-/g, '')}`;
  if (!snapshotId) {
    if (isInteractive) {
      snapshotId = await input({
        message: 'Enter snapshot ID:',
        default: defaultSnapshotId,
        validate: (v) => v.trim() ? true : 'Snapshot ID is required'
      });
    } else {
      snapshotId = defaultSnapshotId;
    }
  }

  // Overwrite resolution
  const snapshotDir = path.join(projectPath, 'screenshot-sets', 'sets', snapshotId);
  let overwrite = !!options.overwrite;
  if (existsSync(snapshotDir)) {
    if (overwrite) {
      console.log(chalk.yellow(`Overwriting existing snapshot "${snapshotId}"...`));
    } else if (isInteractive) {
      overwrite = await confirm({
        message: `Snapshot "${snapshotId}" exists. Overwrite?`,
        default: false
      });
      if (!overwrite) {
        console.log(chalk.yellow('Snapshot cancelled.'));
        return null;
      }
    } else {
      throw new MissingInputError(`Snapshot "${snapshotId}" already exists. Use --overwrite to replace.`);
    }
  }

  // Auth resolution: explicit options > stored config > interactive prompt fallback.
  let basicAuth = null;
  let cookies = [];
  const stored = visualDiff.basic_auth;

  if (options.authType === 'none') {
    // explicit skip
  } else if (options.username && options.password) {
    basicAuth = { username: options.username, password: options.password };
  } else if (options.authType === 'basic') {
    if (isInteractive) {
      const username = await input({ message: 'Enter username:' });
      const password = await input({ message: 'Enter password:', type: 'password' });
      basicAuth = { username, password };
    } else {
      throw new MissingInputError('--username and --password required for --auth-type basic');
    }
  } else if (stored && stored.username) {
    basicAuth = { username: stored.username, password: stored.password };
    if (isInteractive) {
      console.log(chalk.cyan(`Using stored basic auth credentials for user: ${stored.username}`));
    }
  }

  if (options.cookies) {
    const parsed = parseCookieString(options.cookies);
    if (parsed.errors.length > 0) {
      throw new MissingInputError(`Invalid cookies: ${parsed.errors.join('; ')}`);
    }
    cookies = parsed.cookies;
  } else if (options.authType === 'cookie' && isInteractive) {
    const cookieStr = await input({ message: 'Enter cookies (name1=val1; name2=val2):' });
    const parsed = parseCookieString(cookieStr);
    cookies = parsed.cookies;
  }

  // Persist to session store so callers who read from it (e.g. tests) see the same view.
  if (basicAuth) setBasicAuth(projectPath, basicAuth);
  if (cookies.length > 0) setSessionCookies(projectPath, cookies);

  // Interactive fallback: if no auth resolved at all, offer the verification flow.
  if (!basicAuth && cookies.length === 0 && isInteractive && options.authType !== 'none') {
    await promptForAuthentication(projectPath, visualDiff.base_path);
    basicAuth = getBasicAuth(projectPath);
    cookies = getSessionCookies(projectPath);
  }

  // Settings echo
  console.log();
  console.log(chalk.cyan('Snapshot settings:'));
  console.log(chalk.cyan(`  Project: ${projectConfig.name}`));
  console.log(chalk.cyan(`  Base URL: ${visualDiff.base_path}`));
  console.log(chalk.cyan(`  Paths: ${visualDiff.paths.length}`));
  console.log(chalk.cyan(`  Viewports: ${visualDiff.viewports.map(v => v.name).join(', ')}`));
  console.log(chalk.cyan(`  Snapshot ID: ${snapshotId}`));
  if (basicAuth) console.log(chalk.green(`  Auth: Basic (${basicAuth.username})`));
  if (cookies.length > 0) console.log(chalk.green(`  Cookies: ${cookies.length}`));
  console.log();
  console.log(chalk.blue('Taking screenshots...'));

  const snapshotInfo = await createSnapshot(
    projectPath,
    snapshotId,
    visualDiff,
    { overwrite, cookies, basicAuth }
  );

  console.log();
  console.log(chalk.green(`Snapshot "${snapshotId}" created with ${snapshotInfo.count} screenshots.`));
  console.log(chalk.cyan(`  Location: ${snapshotDir}`));

  return snapshotInfo;
}
