/**
 * In-memory session store for authentication
 * Credentials are stored per project in isolation
 */

// In-memory storage for session cookies, keyed by project directory
const sessionCookies = {};

// In-memory storage for basic auth credentials, keyed by project directory
const basicAuthCredentials = {};

/**
 * Set session cookies for a specific project
 * @param {string} projectDir - The project directory
 * @param {Array<{name: string, value: string}>} cookies - Array of cookie objects
 */
export function setSessionCookies(projectDir, cookies) {
  sessionCookies[projectDir] = cookies;
}

/**
 * Get session cookies for a specific project
 * @param {string} projectDir - The project directory
 * @returns {Array<{name: string, value: string}>} - Array of cookie objects
 */
export function getSessionCookies(projectDir) {
  return sessionCookies[projectDir] || [];
}

/**
 * Clear session cookies for a specific project
 * @param {string} projectDir - The project directory
 */
export function clearSessionCookies(projectDir) {
  delete sessionCookies[projectDir];
}

/**
 * Clear all session cookies (useful when exiting the app)
 */
export function clearAllSessionCookies() {
  Object.keys(sessionCookies).forEach(key => {
    delete sessionCookies[key];
  });
}

/**
 * Set basic auth credentials for a specific project
 * @param {string} projectDir - The project directory
 * @param {{username: string, password: string}} credentials - Basic auth credentials
 */
export function setBasicAuth(projectDir, credentials) {
  basicAuthCredentials[projectDir] = credentials;
}

/**
 * Get basic auth credentials for a specific project
 * @param {string} projectDir - The project directory
 * @returns {{username: string, password: string}|null} - Basic auth credentials or null
 */
export function getBasicAuth(projectDir) {
  return basicAuthCredentials[projectDir] || null;
}

/**
 * Clear basic auth credentials for a specific project
 * @param {string} projectDir - The project directory
 */
export function clearBasicAuth(projectDir) {
  delete basicAuthCredentials[projectDir];
}

/**
 * Check if basic auth is set for a project
 * @param {string} projectDir - The project directory
 * @returns {boolean}
 */
export function hasBasicAuth(projectDir) {
  return !!basicAuthCredentials[projectDir];
}

/**
 * Clear all authentication (cookies and basic auth) for a project
 * @param {string} projectDir - The project directory
 */
export function clearAllAuth(projectDir) {
  delete sessionCookies[projectDir];
  delete basicAuthCredentials[projectDir];
}

/**
 * Check if session cookies are set for a project
 * @param {string} projectDir - The project directory
 * @returns {boolean}
 */
export function hasSessionCookies(projectDir) {
  return sessionCookies[projectDir] && sessionCookies[projectDir].length > 0;
}

/**
 * Parse a single cookie string in format "name=value" into a cookie object
 * @param {string} cookieString - Cookie string like "SESS123=abc123"
 * @returns {{name: string, value: string}|null} - Cookie object or null if invalid
 */
export function parseSingleCookie(cookieString) {
  if (!cookieString || typeof cookieString !== 'string') {
    return null;
  }

  const trimmed = cookieString.trim();
  const equalsIndex = trimmed.indexOf('=');

  if (equalsIndex === -1 || equalsIndex === 0) {
    return null;
  }

  const name = trimmed.substring(0, equalsIndex);
  const value = trimmed.substring(equalsIndex + 1);

  if (!name) {
    return null;
  }

  return { name, value };
}

/**
 * Parse a cookie string that may contain multiple cookies separated by semicolons
 * Format: "name1=value1; name2=value2" or just "name=value"
 * @param {string} cookieString - Cookie string(s)
 * @returns {{cookies: Array<{name: string, value: string}>, errors: string[]}}}
 */
export function parseCookieString(cookieString) {
  if (!cookieString || typeof cookieString !== 'string') {
    return { cookies: [], errors: ['Cookie string is empty'] };
  }

  const parts = cookieString.split(';');
  const cookies = [];
  const errors = [];

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue; // Skip empty parts
    }

    const cookie = parseSingleCookie(trimmed);
    if (cookie) {
      cookies.push(cookie);
    } else {
      errors.push(`Invalid cookie format: "${trimmed}"`);
    }
  }

  return { cookies, errors };
}

/**
 * Format cookies for display
 * @param {Array<{name: string, value: string}>} cookies - Array of cookie objects
 * @returns {string} - Formatted string for display
 */
export function formatCookiesForDisplay(cookies) {
  if (!cookies || cookies.length === 0) {
    return 'None';
  }

  return cookies.map(c => `${c.name}=${c.value.substring(0, 20)}...`).join(', ');
}
