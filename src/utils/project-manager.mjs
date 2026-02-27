/**
 * Project manager utilities for managing CivicTheme update projects
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';
import { validateProjectConfiguration, formatValidationErrors } from './validator.mjs';

export const DEFAULT_PROJECT_DIR_NAME = '.visual-regression';

export const projectsDir = process.env.VR_DRUPAL_PROJECTS_DIR || join(process.cwd(), DEFAULT_PROJECT_DIR_NAME);

/**
 * Convert a human-readable project name to a valid directory name
 * @param {string} name - The human-readable project name
 * @returns {string} - The converted directory name
 */
export function convertProjectNameToDirectory(name) {
  // Replace non-alphanumeric characters with hyphens
  // Remove leading/trailing hyphens
  // Replace multiple hyphens with single hyphen
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')

    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

/**
 * Check if a project with the given directory name already exists
 * @param {string} directoryName - The directory name to check
 * @returns {boolean} - True if the project exists
 */
export function checkProjectExists(directoryName) {
  const projectPath = join(projectsDir, directoryName);
  return existsSync(projectPath);
}

/**
 * Ensure the projects directory exists
 */
export function ensureProjectsDirectory() {
  if (!existsSync(projectsDir)) {
    mkdirSync(projectsDir, { recursive: true });
  }
}

/**
 * Save project configuration to disk
 * @param {Object} config - The project configuration
 * @throws {Error} - If unable to save configuration or validation fails
 */
export function saveProjectConfiguration(config) {
  // Validate configuration before saving
  const validation = validateProjectConfiguration(config);
  if (!validation.valid) {
    const errorMessage = formatValidationErrors(validation.errors);
    throw new Error(`Invalid project configuration:\n${errorMessage}`);
  }

  ensureProjectsDirectory();

  const projectPath = join(projectsDir, config.directoryName);
  const configPath = join(projectPath, 'project.json');

  if (!existsSync(projectPath)) {
    mkdirSync(projectPath, { recursive: true });
  }

  writeFileSync(configPath, JSON.stringify(config, null, 2));
  return configPath;
}

/**
 * Load project configuration from disk
 * @param {string} directoryName - The project directory name
 * @returns {Object|null} - The project configuration or null if not found or invalid
 */
export function loadProjectConfiguration(directoryName) {
  const configPath = join(projectsDir, directoryName, 'project.json');

  try {
    const content = readFileSync(configPath, 'utf8');
    const config = JSON.parse(content);

    const validation = validateProjectConfiguration(config);
    if (!validation.valid) {
      console.error(`Error: Invalid project configuration for ${directoryName}`);
      console.error(formatValidationErrors(validation.errors));
      return null;
    }

    return config;
  } catch (error) { // eslint-disable-line no-unused-vars
    return null;
  }
}

/**
 * Get all saved projects
 * @returns {Array} - Array of project configurations
 */
export function getAllProjects() {
  ensureProjectsDirectory();

  const projects = [];

  try {
    const directories = readdirSync(projectsDir, { withFileTypes: true });

    for (const dir of directories) {
      if (dir.isDirectory()) {
        const config = loadProjectConfiguration(dir.name);
        if (config) {
          projects.push(config);
        }
      }
    }
  } catch (error) { // eslint-disable-line no-unused-vars
    return [];
  }

  return projects;
}

/**
 * Load project configuration from a specific directory path
 * @param {string} projectDir - The absolute or relative path to the project directory
 * @returns {Object|null} - The project configuration or null if not found or invalid
 */
export function loadProjectFromDirectory(projectDir) {
  const configPath = join(projectDir, 'project.json');

  try {
    if (!existsSync(configPath)) {
      return null;
    }

    const content = readFileSync(configPath, 'utf8');
    const config = JSON.parse(content);

    const validation = validateProjectConfiguration(config);
    if (!validation.valid) {
      console.error(`Error: Invalid project configuration in ${projectDir}`);
      console.error(formatValidationErrors(validation.errors));
      return null;
    }

    return config;
  } catch (error) { // eslint-disable-line no-unused-vars
    return null;
  }
}

/**
 * Save project configuration to a specific directory path
 * @param {string} projectDir - The absolute or relative path to the project directory
 * @param {Object} config - The project configuration
 * @throws {Error} - If unable to save configuration or validation fails
 */
export function saveProjectToDirectory(projectDir, config) {
  // Validate configuration before saving
  const validation = validateProjectConfiguration(config);
  if (!validation.valid) {
    const errorMessage = formatValidationErrors(validation.errors);
    throw new Error(`Invalid project configuration:\n${errorMessage}`);
  }

  const configPath = join(projectDir, 'project.json');

  if (!existsSync(projectDir)) {
    mkdirSync(projectDir, { recursive: true });
  }

  writeFileSync(configPath, JSON.stringify(config, null, 2));
  return configPath;
}

/**
 * Get the project directory from environment variable or default
 * @returns {string|null} - The project directory from VR_DRUPAL_PROJECT_DIR or null
 */
export function getProjectDirFromEnv() {
  return process.env.VR_DRUPAL_PROJECT_DIR || null;
}

/**
 * Resolve project directory from options, environment, or auto-discovery
 * Priority: 1. --project-dir flag, 2. VR_DRUPAL_PROJECT_DIR env, 3. Auto-discover single project in .visual-regression/
 * @param {Object} options - Command options with projectDir property
 * @returns {string|null} - Resolved project directory or null
 */
export function resolveProjectDir(options) {
  if (options?.projectDir) {
    return options.projectDir;
  }

  const envDir = getProjectDirFromEnv();
  if (envDir) {
    return envDir;
  }

  // Auto-discover: if exactly one project in .visual-regression/, use it
  if (existsSync(projectsDir)) {
    try {
      const dirs = readdirSync(projectsDir, { withFileTypes: true })
        .filter(d => d.isDirectory() && existsSync(join(projectsDir, d.name, 'project.json')));
      if (dirs.length === 1) {
        return join(projectsDir, dirs[0].name);
      }
    } catch {
      // ignore
    }
  }

  return null;
}

/**
 * Delete a project and its configuration
 * @param {string} directoryName - The project directory name
 * @returns {boolean} - True if project was deleted successfully
 */
export function deleteProject(directoryName) {
  const projectPath = join(projectsDir, directoryName);

  try {
    if (existsSync(projectPath)) {
      rmSync(projectPath, { recursive: true, force: true });
      return true;
    }
  } catch (error) { // eslint-disable-line no-unused-vars
    return false;
  }

  return false;
}

/**
 * Update visual regression configuration for a project
 * @param {string} directoryName - The project directory name
 * @param {Object} visualDiffConfig - Visual regression configuration to save
 * @returns {boolean} - True if configuration was updated successfully
 */
export function updateVisualRegressionConfig(directoryName, visualDiffConfig) {
  try {
    const projectConfig = loadProjectConfiguration(directoryName);

    if (!projectConfig) {
      return false;
    }

    projectConfig['visual-diff'] = visualDiffConfig;
    projectConfig.updatedAt = new Date().toISOString();

    saveProjectConfiguration(projectConfig);

    return true;
  } catch (error) { // eslint-disable-line no-unused-vars
    return false;
  }
}

/**
 * ProjectManager class for managing project operations
 */
export class ProjectManager {
  constructor() {
    this.projectsDir = projectsDir;
  }

  /**
   * Get the path to a specific project
   * @param {string} projectName - The project name
   * @returns {Promise<string>} Path to the project directory
   */
  async getProjectPath(projectName) {
    const dirName = convertProjectNameToDirectory(projectName);
    return join(this.projectsDir, dirName);
  }

  /**
   * List all available projects
   * @returns {Promise<string[]>} Array of project names
   */
  async listProjects() {
    return listProjects();
  }
}
