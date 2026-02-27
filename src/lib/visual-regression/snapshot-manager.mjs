/**
 * Snapshot manager for visual regression testing
 */
import path from 'path';
import fs from 'fs';
import { captureUrlScreenshots, determineOptimalConcurrency } from './screenshot.mjs';
import { ensureDirectory } from './screenshot-set-manager.mjs';
import { projectsDir } from '../../utils/project-manager.mjs';

/**
 * Write set.json metadata into a snapshot directory
 *
 * @param {string} projectPath - Absolute path to the project directory
 * @param {string} snapshotId - Snapshot identifier
 * @param {Object} metadata - Metadata to write (date, count)
 */
export function writeSetMetadata(projectPath, snapshotId, metadata) {
  const setJsonPath = path.join(projectPath, 'screenshot-sets', 'sets', snapshotId, 'set.json');
  const setData = {
    id: snapshotId,
    directory: `screenshot-sets/sets/${snapshotId}`,
    date: metadata.date,
    count: metadata.count
  };
  fs.writeFileSync(setJsonPath, JSON.stringify(setData, null, 2), 'utf8');
}

/**
 * Read set.json metadata from a specific snapshot directory
 *
 * @param {string} projectPath - Absolute path to the project directory
 * @param {string} snapshotId - Snapshot identifier
 * @returns {Object|null} - Set metadata or null if not found
 */
export function readSetMetadata(projectPath, snapshotId) {
  const setJsonPath = path.join(projectPath, 'screenshot-sets', 'sets', snapshotId, 'set.json');
  if (!fs.existsSync(setJsonPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(setJsonPath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Scan all snapshot directories and read their set.json files
 *
 * @param {string} projectPath - Absolute path to the project directory
 * @returns {Object} - Map of snapshot ID to metadata
 */
export function getAllSnapshots(projectPath) {
  const setsDir = path.join(projectPath, 'screenshot-sets', 'sets');
  if (!fs.existsSync(setsDir)) return {};

  const snapshots = {};
  let dirs;
  try {
    dirs = fs.readdirSync(setsDir, { withFileTypes: true });
  } catch {
    return {};
  }

  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    const setJsonPath = path.join(setsDir, dir.name, 'set.json');
    if (fs.existsSync(setJsonPath)) {
      try {
        snapshots[dir.name] = JSON.parse(fs.readFileSync(setJsonPath, 'utf8'));
      } catch {
        // skip invalid set.json files
      }
    }
  }

  return snapshots;
}

/**
 * Write comparison.json metadata into a comparison directory
 *
 * @param {string} projectPath - Absolute path to the project directory
 * @param {string} comparisonId - Comparison identifier (format: source--target)
 * @param {Object} metadata - Metadata to write (source, target, directory, date, statistics)
 */
export function writeComparisonMetadata(projectPath, comparisonId, metadata) {
  const comparisonJsonPath = path.join(projectPath, 'screenshot-sets', 'comparisons', comparisonId, 'comparison.json');
  const comparisonData = {
    id: comparisonId,
    source: metadata.source,
    target: metadata.target,
    directory: `screenshot-sets/comparisons/${comparisonId}`,
    date: metadata.date,
    statistics: metadata.statistics
  };
  fs.writeFileSync(comparisonJsonPath, JSON.stringify(comparisonData, null, 2), 'utf8');
}

/**
 * Read comparison.json metadata from a specific comparison directory
 *
 * @param {string} projectPath - Absolute path to the project directory
 * @param {string} comparisonId - Comparison identifier
 * @returns {Object|null} - Comparison metadata or null if not found
 */
export function readComparisonMetadata(projectPath, comparisonId) {
  const comparisonJsonPath = path.join(projectPath, 'screenshot-sets', 'comparisons', comparisonId, 'comparison.json');
  if (!fs.existsSync(comparisonJsonPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(comparisonJsonPath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Scan all comparison directories and read their comparison.json files
 *
 * @param {string} projectPath - Absolute path to the project directory
 * @returns {Object} - Map of comparison ID to metadata
 */
export function getAllComparisons(projectPath) {
  const comparisonsDir = path.join(projectPath, 'screenshot-sets', 'comparisons');
  if (!fs.existsSync(comparisonsDir)) return {};

  const comparisons = {};
  let dirs;
  try {
    dirs = fs.readdirSync(comparisonsDir, { withFileTypes: true });
  } catch {
    return {};
  }

  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    const comparisonJsonPath = path.join(comparisonsDir, dir.name, 'comparison.json');
    if (fs.existsSync(comparisonJsonPath)) {
      try {
        comparisons[dir.name] = JSON.parse(fs.readFileSync(comparisonJsonPath, 'utf8'));
      } catch {
        // skip invalid comparison.json files
      }
    }
  }

  return comparisons;
}

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
 * Update project with snapshot information by writing set.json
 *
 * @param {string} projectDir - Project directory name
 * @param {Object} snapshotInfo - Snapshot information
 * @returns {boolean} - Success status
 */
export function updateProjectWithSnapshot(projectDir, snapshotInfo) {
  const projectPath = path.join(projectsDir, projectDir);

  try {
    writeSetMetadata(projectPath, snapshotInfo.id, {
      date: snapshotInfo.date,
      count: snapshotInfo.count
    });
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
  return getAllSnapshots(projectPath);
}

/**
 * Get snapshot by ID
 *
 * @param {string} projectDir - Project directory name
 * @param {string} snapshotId - Snapshot identifier
 * @returns {Object|null} - Snapshot information
 */
export function getSnapshotById(projectDir, snapshotId) {
  const projectPath = path.join(projectsDir, projectDir);
  return readSetMetadata(projectPath, snapshotId);
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

  try {
    const snapshot = readSetMetadata(projectPath, snapshotId);
    if (!snapshot) {
      return false;
    }

    const snapshotDir = path.join(projectPath, snapshot.directory);
    if (fs.existsSync(snapshotDir)) {
      fs.rmSync(snapshotDir, { recursive: true, force: true });
    }

    return true;
  } catch (error) {
    console.error(`Error deleting snapshot: ${error.message}`);
    return false;
  }
}
