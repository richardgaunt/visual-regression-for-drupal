// This file configures Jest for the scaffolded CLI application
import { jest } from '@jest/globals';

// Set longer timeouts for all tests
jest.setTimeout(30000);

// For ESM modules, we need to use a different approach to mocking
// The jest.unstable_mockModule API can be used before the imports
// See tests for implementation examples

// Global test configuration
global.afterEach(() => {
  // Add any global test teardown here
  jest.clearAllMocks();
});
