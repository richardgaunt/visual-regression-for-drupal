export default {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.mjs'],
  setupFilesAfterEnv: ['./jest.setup.mjs'],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  collectCoverageFrom: ['*.mjs', 'src/**/*.mjs', '!jest.setup.mjs', '!jest.config.mjs', '!eslint.config.mjs'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  transform: {},
  transformIgnorePatterns: ['/node_modules/'],
  testTimeout: 30000,
  verbose: true,
  forceExit: true,
  detectOpenHandles: true,
  bail: false,
  injectGlobals: true
};
