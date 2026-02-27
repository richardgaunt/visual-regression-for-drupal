/**
 * Screenshot Set Manager for Visual Regression Testing
 *
 * Provides utilities for working with screenshot sets, directories,
 * and comparisons.
 */
/**
 * Screenshot Set Manager for Visual Regression Testing
 */
import path from 'path';
import fs from 'fs';
import { projectsDir } from '../../utils/project-manager.mjs';

/**
 * Ensure a directory exists, creating it if necessary
 *
 * @param {string} directory - Directory to ensure
 * @returns {boolean} - Whether the directory was created or already existed
 */
export function ensureDirectory(directory) {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
    return true;
  }
  return false;
}

/**
 * Get the screenshot sets directory for a project
 *
 * @param {string} projectDir - Project directory name
 * @returns {string} - Path to the screenshot sets directory
 */
export function getScreenshotSetsDirectory(projectDir) {
  const projectPath = path.join(projectsDir, projectDir);
  return path.join(projectPath, 'screenshot-sets', 'sets');
}

/**
 * Get the comparisons directory for a project
 *
 * @param {string} projectDir - Project directory name
 * @returns {string} - Path to the comparisons directory
 */
export function getComparisonsDirectory(projectDir) {
  const projectPath = path.join(projectsDir, projectDir);
  return path.join(projectPath, 'screenshot-sets', 'comparisons');
}

/**
 * Get the path to a specific screenshot set directory
 *
 * @param {string} projectDir - Project directory name
 * @param {string} setId - Set identifier
 * @returns {string} - Path to the set directory
 */
export function getScreenshotSetPath(projectDir, setId) {
  return path.join(getScreenshotSetsDirectory(projectDir), setId);
}

/**
 * Get the path to a specific comparison directory
 *
 * @param {string} projectDir - Project directory name
 * @param {string} sourceId - Source set identifier
 * @param {string} targetId - Target set identifier
 * @returns {string} - Path to the comparison directory
 */
export function getComparisonPath(projectDir, sourceId, targetId) {
  return path.join(getComparisonsDirectory(projectDir), `${sourceId}--${targetId}`);
}

/**
 * Get all screenshot sets for a project by scanning set.json files
 *
 * @param {string} projectDir - Project directory name
 * @returns {Object} - Set information from set.json files
 */
export function getScreenshotSets(projectDir) {
  const projectPath = path.join(projectsDir, projectDir);
  const setsDir = path.join(projectPath, 'screenshot-sets', 'sets');
  if (!fs.existsSync(setsDir)) return {};

  const snapshots = {};
  try {
    const dirs = fs.readdirSync(setsDir, { withFileTypes: true });
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
  } catch (error) {
    console.error(`Error getting screenshot sets: ${error.message}`);
    return {};
  }

  return snapshots;
}

/**
 * Get a specific screenshot set by ID
 *
 * @param {string} projectDir - Project directory name
 * @param {string} setId - Set identifier
 * @returns {Object|null} - Set information or null if not found
 */
export function getScreenshotSetById(projectDir, setId) {
  const sets = getScreenshotSets(projectDir);
  return sets[setId] || null;
}

/**
 * Update project configuration with comparison information
 *
 * @param {string} projectDir - Project directory name
 * @param {string} sourceId - Source set identifier
 * @param {string} targetId - Target set identifier
 * @param {Object} comparisonInfo - Comparison information
 * @returns {boolean} - Success status
 */
export function updateProjectWithComparison(projectDir, sourceId, targetId, comparisonInfo) {
  const projectPath = path.join(projectsDir, projectDir);
  const configPath = path.join(projectPath, 'project.json');

  try {
    const configData = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData);

    if (!config.comparisons) {
      config.comparisons = {};
    }

    const comparisonId = `${sourceId}--${targetId}`;

    config.comparisons[comparisonId] = {
      source: sourceId,
      target: targetId,
      directory: comparisonInfo.directory,
      date: comparisonInfo.date,
      statistics: comparisonInfo.statistics
    };

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error(`Error updating project with comparison: ${error.message}`);
    return false;
  }
}

/**
 * Get all comparisons for a project
 *
 * @param {string} projectDir - Project directory name
 * @returns {Object} - Comparison information
 */
export function getProjectComparisons(projectDir) {
  const projectPath = path.join(projectsDir, projectDir);
  const configPath = path.join(projectPath, 'project.json');

  try {
    const configData = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData);

    return config.comparisons || {};
  } catch (error) {
    console.error(`Error getting project comparisons: ${error.message}`);
    return {};
  }
}

/**
 * Delete a comparison
 *
 * @param {string} projectDir - Project directory name
 * @param {string} comparisonId - Comparison identifier (format: source--target)
 * @returns {boolean} - Success status
 */
export function deleteComparison(projectDir, comparisonId) {
  const projectPath = path.join(projectsDir, projectDir);
  const configPath = path.join(projectPath, 'project.json');

  try {
    const configData = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData);

    if (!config.comparisons || !config.comparisons[comparisonId]) {
      return false;
    }

    const comparison = config.comparisons[comparisonId];

    const comparisonDir = path.join(projectPath, comparison.directory);
    if (fs.existsSync(comparisonDir)) {
      fs.rmSync(comparisonDir, { recursive: true, force: true });
    }

    delete config.comparisons[comparisonId];
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error(`Error deleting comparison: ${error.message}`);
    return false;
  }
}
