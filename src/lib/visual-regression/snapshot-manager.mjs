/**
 * Snapshot manager for visual regression testing
 */
import path from 'path';
import fs from 'fs';
import { captureUrlScreenshots, determineOptimalConcurrency } from './screenshot.mjs';
import { ensureDirectory } from './screenshot-set-manager.mjs';
import { projectsDir } from '../../utils/project-manager.mjs';

/**
 * Create a new snapshot for a project
 *
 * @param {string} projectDir - Project directory name
 * @param {string} snapshotId - Snapshot identifier
 * @param {Object} config - Visual regression configuration
 * @param {boolean} [overwrite=false] - Whether to overwrite an existing snapshot
 * @param {Array<{name: string, value: string}>} [cookies=[]] - Session cookies for authenticated access
 * @param {{username: string, password: string}} [basicAuth=null] - Basic auth credentials
 * @returns {Promise<Object>} - Snapshot information
 */
// eslint-disable-next-line max-len
export async function createSnapshot(projectDir, snapshotId, config, overwrite = false, cookies = [], basicAuth = null) {
  const projectPath = path.join(projectsDir, projectDir);
  const screenshotSetsBaseDir = path.join(projectPath, 'screenshot-sets');
  const screenshotSetsDir = path.join(screenshotSetsBaseDir, 'sets');
  const snapshotDir = path.join(screenshotSetsDir, snapshotId);

  ensureDirectory(screenshotSetsBaseDir);
  ensureDirectory(screenshotSetsDir);

  const snapshotExists = fs.existsSync(snapshotDir);

  if (snapshotExists && !overwrite) {
    throw new Error(`Snapshot "${snapshotId}" already exists for project "${projectDir}"`);
  }

  if (snapshotExists && overwrite) {
    console.log(`Removing existing snapshot "${snapshotId}"...`);
    fs.rmSync(snapshotDir, { recursive: true, force: true });
  }

  ensureDirectory(snapshotDir);

  const concurrency = await determineOptimalConcurrency();

  const result = await captureUrlScreenshots({
    baseUrl: config.base_path,
    paths: config.paths,
    viewports: config.viewports,
    outputDir: snapshotDir,
    concurrency: concurrency,
    advancedOptions: config.advanced,
    cookies: cookies,
    basicAuth: basicAuth
  });

  const snapshotInfo = {
    id: snapshotId,
    directory: path.relative(projectPath, snapshotDir),
    date: new Date().toISOString(),
    baseUrl: config.base_path,
    paths: config.paths,
    viewports: config.viewports.map(v => v.name),
    count: result.count
  };

  return snapshotInfo;
}

/**
 * Update project configuration with snapshot information
 *
 * @param {string} projectDir - Project directory name
 * @param {Object} snapshotInfo - Snapshot information
 * @returns {Promise<boolean>} - Success status
 */
export async function updateProjectWithSnapshot(projectDir, snapshotInfo) {
  const projectPath = path.join(projectsDir, projectDir);
  const configPath = path.join(projectPath, 'project.json');

  try {
    const configData = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData);

    if (!config.snapshots) {
      config.snapshots = {};
    }

    config.snapshots[snapshotInfo.id] = {
      directory: snapshotInfo.directory,
      date: snapshotInfo.date,
      count: snapshotInfo.count
    };

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error(`Error updating project with snapshot: ${error.message}`);
    return false;
  }
}

/**
 * Get all snapshots for a project
 *
 * @param {string} projectDir - Project directory name
 * @returns {Object} - Snapshot information
 */
export function getProjectSnapshots(projectDir) {
  const projectPath = path.join(projectsDir, projectDir);
  const configPath = path.join(projectPath, 'project.json');

  try {
    const configData = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData);

    return config.snapshots || {};
  } catch (error) {
    console.error(`Error getting project snapshots: ${error.message}`);
    return {};
  }
}

/**
 * Get snapshot by ID
 *
 * @param {string} projectDir - Project directory name
 * @param {string} snapshotId - Snapshot identifier
 * @returns {Object|null} - Snapshot information
 */
export function getSnapshotById(projectDir, snapshotId) {
  const snapshots = getProjectSnapshots(projectDir);
  return snapshots[snapshotId] || null;
}

/**
 * Delete a snapshot
 *
 * @param {string} projectDir - Project directory name
 * @param {string} snapshotId - Snapshot identifier
 * @returns {boolean} - Success status
 */
export function deleteSnapshot(projectDir, snapshotId) {
  const projectPath = path.join(projectsDir, projectDir);
  const configPath = path.join(projectPath, 'project.json');

  try {
    const snapshot = getSnapshotById(projectDir, snapshotId);
    if (!snapshot) {
      return false;
    }

    const snapshotDir = path.join(projectPath, snapshot.directory);
    if (fs.existsSync(snapshotDir)) {
      fs.rmSync(snapshotDir, { recursive: true, force: true });
    }

    const configData = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData);

    if (config.snapshots && config.snapshots[snapshotId]) {
      delete config.snapshots[snapshotId];
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    }

    return true;
  } catch (error) {
    console.error(`Error deleting snapshot: ${error.message}`);
    return false;
  }
}
