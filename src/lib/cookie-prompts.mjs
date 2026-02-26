/**
 * Authentication prompting flow for basic auth and session cookies
 */
import chalk from 'chalk';
import { confirm, input, select, password } from '@inquirer/prompts';
import {
  setSessionCookies,
  clearAllAuth,
  parseCookieString,
  setBasicAuth
} from './session-store.mjs';

/**
 * Test if authentication works by fetching a test page
 * @param {string} baseUrl - The base URL of the site
 * @param {string} testPath - The path to test (e.g., "/admin")
 * @param {Object} options - Authentication options
 * @param {Array<{name: string, value: string}>} [options.cookies] - Cookies to send
 * @param {{username: string, password: string}} [options.basicAuth] - Basic auth credentials
 * @returns {Promise<{success: boolean, statusCode: number, error?: string}>}
 */
async function testAuthAccess(baseUrl, testPath, { cookies = [], basicAuth = null }) {
  try {
    const url = new URL(testPath, baseUrl).href;
    const headers = {};

    // Build cookie header string
    if (cookies.length > 0) {
      headers['Cookie'] = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    }

    // Add basic auth header
    if (basicAuth) {
      const credentials = Buffer.from(`${basicAuth.username}:${basicAuth.password}`).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
      redirect: 'manual' // Don't follow redirects, as login pages often redirect
    });

    // Consider 2xx status codes as success
    // 3xx redirects might indicate being redirected to login page
    const success = response.status >= 200 && response.status < 300;

    return {
      success,
      statusCode: response.status
    };
  } catch (error) {
    return {
      success: false,
      statusCode: 0,
      error: error.message
    };
  }
}

/**
 * Prompt for basic auth credentials
 * @returns {Promise<{username: string, password: string}>}
 */
async function promptForBasicAuthCredentials() {
  console.log();
  console.log(chalk.cyan('Enter your basic authentication credentials.'));
  console.log();

  const username = await input({
    message: 'Username:',
    validate: (value) => {
      if (!value.trim()) {
        return 'Username is required';
      }
      return true;
    }
  });

  const pwd = await password({
    message: 'Password:',
    validate: (value) => {
      if (!value) {
        return 'Password is required';
      }
      return true;
    }
  });

  return { username: username.trim(), password: pwd };
}

/**
 * Prompt for session cookies
 * @returns {Promise<{cookies: Array<{name: string, value: string}>, errors: string[]}>}
 */
async function promptForCookies() {
  console.log();
  console.log(chalk.cyan('Enter your session cookie(s) in the format: cookie_name=cookie_value'));
  console.log(chalk.cyan('For multiple cookies, separate with semicolons: name1=value1; name2=value2'));
  console.log(chalk.gray('Example: SESSf85b9bf32f33febb4bc39d6515cff996=HPmHHIlgQoJJdE5Y%2CfrvC6czmpgtoFCpaQ-iRVbYj3DqtOIE'));
  console.log();

  const cookieInput = await input({
    message: 'Session cookie(s):',
    validate: (value) => {
      if (!value.trim()) {
        return 'Cookie is required';
      }
      const { cookies, errors } = parseCookieString(value);
      if (cookies.length === 0) {
        return errors.length > 0 ? errors[0] : 'Invalid cookie format. Use: cookie_name=cookie_value';
      }
      return true;
    }
  });

  return parseCookieString(cookieInput);
}

/**
 * Prompt user for authentication with verification flow
 * @param {string} projectDir - The project directory name
 * @param {string} baseUrl - The base URL of the site being tested
 * @returns {Promise<{hasAuth: boolean, hasBasicAuth: boolean, hasCookies: boolean}>}
 */
export async function promptForAuthentication(projectDir, baseUrl) {
  // Clear any existing auth for this project first
  clearAllAuth(projectDir);

  console.log();
  const needsAuth = await confirm({
    message: 'Do you need authentication for these requests?',
    default: false
  });

  if (!needsAuth) {
    console.log(chalk.cyan('Proceeding without authentication.'));
    return { hasAuth: false, hasBasicAuth: false, hasCookies: false };
  }

  // Ask what type of authentication
  const authType = await select({
    message: 'What type of authentication do you need?',
    choices: [
      { name: 'Basic authentication', value: 'basic' },
      { name: 'Session cookies', value: 'cookies' },
      { name: 'Both (basic auth + session cookies)', value: 'both' },
      { name: 'Cancel', value: 'cancel' }
    ]
  });

  if (authType === 'cancel') {
    console.log(chalk.cyan('Proceeding without authentication.'));
    return { hasAuth: false, hasBasicAuth: false, hasCookies: false };
  }

  let basicAuth = null;
  let cookies = [];
  let authVerified = false;

  // Collect credentials based on auth type
  while (!authVerified) {
    if (authType === 'basic' || authType === 'both') {
      basicAuth = await promptForBasicAuthCredentials();
      console.log(chalk.cyan(`Basic auth configured for user: ${basicAuth.username}`));
    }

    if (authType === 'cookies' || authType === 'both') {
      const cookieResult = await promptForCookies();
      cookies = cookieResult.cookies;

      if (cookieResult.errors.length > 0) {
        console.log(chalk.yellow('Warning: Some cookies could not be parsed:'));
        cookieResult.errors.forEach(err => console.log(chalk.yellow(`  • ${err}`)));
      }

      console.log(chalk.cyan(`Parsed ${cookies.length} cookie(s): ${cookies.map(c => c.name).join(', ')}`));
    }

    // Prompt for test page verification
    console.log();
    console.log(chalk.cyan('Enter a test page path to verify the authentication works.'));
    console.log(chalk.gray('This should be a page that requires authentication to access.'));
    console.log(chalk.gray('Example: /admin or /user/profile'));
    console.log();

    const testPath = await input({
      message: 'Test page path:',
      default: '/user',
      validate: (value) => {
        if (!value.trim()) {
          return 'Test path is required';
        }
        if (!value.startsWith('/')) {
          return 'Path must start with /';
        }
        return true;
      }
    });

    console.log();
    console.log(chalk.blue(`Testing authentication access to ${baseUrl}${testPath}...`));

    const result = await testAuthAccess(baseUrl, testPath, { cookies, basicAuth });

    if (result.success) {
      console.log(chalk.green(`✅ Authentication verified! Received status code ${result.statusCode}`));

      // Store credentials
      if (basicAuth) {
        setBasicAuth(projectDir, basicAuth);
      }
      if (cookies.length > 0) {
        setSessionCookies(projectDir, cookies);
      }

      authVerified = true;
    } else {
      console.log();
      if (result.error) {
        console.log(chalk.red(`❌ Could not access the page: ${result.error}`));
      } else {
        console.log(chalk.red(`❌ Could not access the authenticated page. Status code: ${result.statusCode}`));
      }

      if (result.statusCode >= 300 && result.statusCode < 400) {
        console.log(chalk.yellow('The page redirected, which often indicates the session is not valid.'));
      }

      if (result.statusCode === 401) {
        console.log(chalk.yellow('Received 401 Unauthorized - check your credentials.'));
      }

      console.log();

      const tryAgain = await confirm({
        message: 'Would you like to try adding authentication again?',
        default: true
      });

      if (!tryAgain) {
        console.log(chalk.yellow('Proceeding without verified authentication.'));
        return { hasAuth: false, hasBasicAuth: false, hasCookies: false };
      }
    }
  }

  return {
    hasAuth: true,
    hasBasicAuth: !!basicAuth,
    hasCookies: cookies.length > 0
  };
}

// Keep backward compatibility alias
export const promptForSessionCookies = promptForAuthentication;
