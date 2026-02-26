/**
 * Visual regression testing configuration module
 */

/**
 * Viewport presets for visual regression testing
 */
export const VIEWPORT_PRESETS = {
  MOBILE: {
    name: 'Mobile',
    windowWidth: 375,
    windowHeight: 667
  },
  TABLET: {
    name: 'Tablet',
    windowWidth: 768,
    windowHeight: 1024
  },
  DESKTOP: {
    name: 'Desktop',
    windowWidth: 1600,
    windowHeight: 1000
  }
};

/**
 * Default paths to capture for visual regression testing
 */
export const DEFAULT_PATHS = [
  '/',
  '/about',
  '/contact',
  '/search'
];

/**
 * Create default visual diff configuration
 * @param {string} basePath - Base URL for the website
 * @param {Array} [paths] - Array of paths to capture (defaults to DEFAULT_PATHS)
 * @param {Array} [viewports] - Array of viewport configurations (defaults to all presets)
 * @returns {Object} - Visual diff configuration
 */
export function createDefaultVisualDiffConfig(basePath, paths = DEFAULT_PATHS, viewports = null) {
  return {
    base_path: basePath,
    paths: paths,
    viewports: viewports || Object.values(VIEWPORT_PRESETS)
  };
}

/**
 * Validate a URL string
 * @param {string} url - The URL to validate
 * @returns {boolean} - True if URL is valid
 */
export function isValidUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Get URL validation error message
 * @returns {string} - Error message
 */
export function getUrlValidationError() {
  return 'Invalid URL. Must be a valid HTTP or HTTPS URL (e.g., https://example.com).';
}

/**
 * Validate visual diff configuration
 * @param {Object} config - Visual diff configuration to validate
 * @returns {boolean} - True if configuration is valid
 */
export function validateVisualDiffConfig(config) {
  if (!config || !config.base_path || !config.paths || !config.viewports) {
    return false;
  }

  if (!isValidUrl(config.base_path)) {
    return false;
  }

  if (!Array.isArray(config.paths) || config.paths.length === 0) {
    return false;
  }

  if (!Array.isArray(config.viewports) || config.viewports.length === 0) {
    return false;
  }

  return config.viewports.every(viewport => {
    return viewport &&
           typeof viewport.windowWidth === 'number' &&
           typeof viewport.windowHeight === 'number';
  });
}
