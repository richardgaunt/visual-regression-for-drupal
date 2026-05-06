/**
 * Prompts for visual regression configuration
 */
import chalk from 'chalk';
import { input, confirm, checkbox, password } from '@inquirer/prompts';
import { VIEWPORT_PRESETS, isValidUrl, getUrlValidationError, DEFAULT_PATHS } from './config.mjs';

const CIVICTHEME_CONTENT_EXPORT_PATH = '/content-export.json';

function buildAuthHeaders(basicAuth) {
  if (!basicAuth || !basicAuth.username) {
    return {};
  }
  const token = Buffer.from(`${basicAuth.username}:${basicAuth.password ?? ''}`).toString('base64');
  return { Authorization: `Basic ${token}` };
}

/**
 * Fetch CivicTheme content export JSON from a site
 * @param {string} baseUrl - The base URL of the site
 * @param {{username: string, password: string}} [basicAuth] - Optional basic auth credentials
 * @returns {Promise<{paths: string[]|null, status: number|null, error: Error|null}>}
 */
async function fetchCivicThemeContentExport(baseUrl, basicAuth = null) {
  const exportUrl = baseUrl.replace(/\/$/, '') + CIVICTHEME_CONTENT_EXPORT_PATH;

  try {
    const response = await fetch(exportUrl, { headers: buildAuthHeaders(basicAuth) });

    if (!response.ok) {
      return { paths: null, status: response.status, error: null };
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      return { paths: null, status: response.status, error: null };
    }

    const paths = data
      .filter(item => item && typeof item.link === 'string')
      .map(item => item.link);

    if (paths.length === 0) {
      return { paths: null, status: response.status, error: null };
    }

    return { paths, status: response.status, error: null };
  } catch (error) {
    return { paths: null, status: null, error };
  }
}

/**
 * Prompt for CivicTheme paths with content export detection
 * @param {string} baseUrl - The base URL of the site
 * @param {{username: string, password: string}} [basicAuth] - Optional basic auth credentials
 * @returns {Promise<string[]|null>} - Array of paths from CivicTheme export or null to fall back to normal flow
 */
async function promptForCivicThemePaths(baseUrl, basicAuth = null) {
  console.log();
  console.log(chalk.cyan('Checking for CivicTheme content export...'));

  const { paths, status } = await fetchCivicThemeContentExport(baseUrl, basicAuth);

  if (paths) {
    console.log(chalk.green(`✓ Found ${paths.length} pages in CivicTheme content export`));

    const useCivicThemePaths = await confirm({
      message: `Use ${paths.length} paths from CivicTheme content export?`,
      default: true
    });

    if (useCivicThemePaths) {
      return paths;
    }

    return null; // Fall back to normal path selection
  }

  // Content export not found - show instructions
  const attemptedUrl = baseUrl.replace(/\/$/, '') + CIVICTHEME_CONTENT_EXPORT_PATH;
  console.log();
  if (status === 401 || status === 403) {
    console.log(chalk.yellow(`Could not locate the site content export at ${attemptedUrl} (HTTP ${status} — authentication required).`));
    console.log(chalk.yellow('The credentials supplied were rejected. You can re-enter them and retry.'));
  } else if (status) {
    console.log(chalk.yellow(`Could not locate the site content export at ${attemptedUrl} (HTTP ${status}).`));
  } else {
    console.log(chalk.yellow(`Could not locate the site content export at ${attemptedUrl}.`));
  }
  console.log();
  console.log('CivicTheme Visual Regression has a companion module that can be installed');
  console.log('on the Drupal website where you want to carry out the visual regression.');
  console.log();
  console.log(`This module is located at ${chalk.cyan(process.cwd() + '/modules/visual_regression_content_export')}`);
  console.log('- copy this file to your Drupal installation module directory and enable.');
  console.log();
  console.log('If you wish, load this module now.');
  console.log();

  if (status === 401 || status === 403) {
    const reauth = await confirm({
      message: 'Re-enter basic auth credentials and retry?',
      default: true
    });
    if (reauth) {
      const updated = await promptForBasicAuth({ force: true });
      return promptForCivicThemePaths(baseUrl, updated);
    }
  }

  const retry = await confirm({
    message: 'Do you wish to try and re-run the page fetch?',
    default: false
  });

  if (retry) {
    return promptForCivicThemePaths(baseUrl, basicAuth);
  }

  return null; // Fall back to normal path selection
}

/**
 * Prompt for HTTP basic auth credentials.
 * @param {Object} [opts]
 * @param {boolean} [opts.force] - If true, skip the yes/no confirm and ask for credentials directly
 * @returns {Promise<{username: string, password: string}|null>}
 */
export async function promptForBasicAuth({ force = false } = {}) {
  if (!force) {
    const required = await confirm({
      message: 'Does this site require HTTP basic authentication? (e.g. Lagoon/amazee.io dev environments)',
      default: false
    });
    if (!required) {
      return null;
    }
  }

  const username = await input({
    message: 'Basic auth username:',
    validate: (value) => value.trim() ? true : 'Username is required'
  });
  const pw = await password({
    message: 'Basic auth password:',
    mask: '*'
  });

  return { username, password: pw };
}

/**
 * Get base URL from user
 * @returns {Promise<string>} - Base URL
 */
export async function promptForBaseUrl() {
  console.log(chalk.blue('Visual Regression Configuration'));
  console.log(chalk.cyan('Configure the base URL for visual testing'));
  console.log();

  return input({
    message: 'Enter the base URL for the website (e.g., https://example.com):',
    validate: (value) => {
      if (!value.trim()) {
        return 'Base URL is required';
      }
      if (!isValidUrl(value)) {
        return getUrlValidationError();
      }
      return true;
    }
  });
}

/**
 * Prompt for paths to capture
 * @param {string[]} defaultPaths - Default paths to offer
 * @returns {Promise<string[]>} - Selected paths
 */
export async function promptForPaths(defaultPaths = DEFAULT_PATHS) {
  console.log();
  console.log(chalk.cyan('Select paths to capture for visual testing'));

  const useDefaultPaths = await confirm({
    message: `Use default paths (${defaultPaths.join(', ')})?`,
    default: true
  });

  if (useDefaultPaths) {
    return defaultPaths;
  }

  const customPaths = [];
  let addMorePaths = true;

  while (addMorePaths) {
    const path = await input({
      message: 'Enter a path to capture (e.g., /about):',
      validate: (value) => {
        if (!value.trim()) {
          return 'Path cannot be empty';
        }

        if (!value.startsWith('/')) {
          return 'Path must start with a / character';
        }

        if (customPaths.includes(value)) {
          return 'This path is already in the list';
        }

        return true;
      }
    });

    customPaths.push(path);

    addMorePaths = await confirm({
      message: 'Add another path?',
      default: customPaths.length < 3
    });
  }

  return customPaths;
}

/**
 * Prompt for viewport configurations
 * @returns {Promise<Object[]>} - Selected viewport configurations
 */
export async function promptForViewports() {
  console.log();
  console.log(chalk.cyan('Configure viewports for visual testing'));

  const presetChoices = Object.entries(VIEWPORT_PRESETS).map(([key, preset]) => ({
    name: `${preset.name} (${preset.windowWidth}x${preset.windowHeight})`,
    value: key
  }));

  const selectedPresets = await checkbox({
    message: 'Select viewport presets to use:',
    choices: presetChoices,
    default: Object.keys(VIEWPORT_PRESETS)
  });

  const selectedViewports = selectedPresets.map(key => VIEWPORT_PRESETS[key]);

  const addCustomViewport = await confirm({
    message: 'Add a custom viewport?',
    default: false
  });

  if (addCustomViewport) {
    const name = await input({
      message: 'Enter a name for this viewport:',
      default: 'Custom'
    });

    const width = parseInt(
      await input({
        message: 'Enter viewport width (in pixels):',
        validate: (value) => !Number.isNaN(value) || 'You must provide a number',
      }),
      10,
    );

    const height = parseInt(
      await input({
        message: 'Enter viewport height (in pixels):',
        validate: (value) => !Number.isNaN(value) || 'You must provide a number',
      }),
      10,
    );

    selectedViewports.push({
      name,
      windowWidth: width,
      windowHeight: height
    });
  }

  return selectedViewports;
}

/**
 * Complete prompt flow for visual regression configuration
 * @returns {Promise<Object>} - Visual regression configuration
 */
export async function promptForVisualRegressionConfig() {
  const baseUrl = await promptForBaseUrl();
  const basicAuth = await promptForBasicAuth();
  const viewports = await promptForViewports();

  // Try CivicTheme content export first, fall back to manual path selection
  let paths = await promptForCivicThemePaths(baseUrl, basicAuth);
  if (!paths) {
    paths = await promptForPaths();
  }
  const advanced = {
    'masking_selectors': [
      '.ct-iframe',
      '.ct-map--canvas',
      '.ct-video-player',
      '.ct-video',
      'video'
    ],
    'disable_css_transitions': true,
    'hide_mask_selectors': true,
    'replace_images_with_solid_color': true,
    'settle_delay_ms': 2000
  };

  const config = {
    base_path: baseUrl,
    paths,
    viewports,
    advanced
  };

  if (basicAuth) {
    config.basic_auth = basicAuth;
  }

  return config;
}
