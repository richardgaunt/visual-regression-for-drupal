# Visual Diff Integration Plan

This document outlines the plan for integrating the existing visual-diff module with our CivicTheme Update Helper tool to implement snapshot functionality based on project.json configuration.

## Overview

We need to adapt the existing visual-diff tool to work with our project structure and configuration. Instead of capturing Storybook components, we need to capture screenshots of specific URLs defined in the project.json configuration file.

## Current Components

### Our Configuration (src/lib/visual-regression/)
- `config.mjs`: Defines viewport presets and URL validation
- `prompts.mjs`: Interactive prompts for configuring visual regression testing

### Existing visual-diff (src/visual-diff/)
- `lib/screenshot.mjs`: Core functionality for taking screenshots using Puppeteer
- `lib/commands/capture.mjs`: Command handler for capturing screenshots
- `lib/config.mjs`: Configuration loading for visual-diff
- `lib/screenshot-set-manager.mjs`: Managing screenshot sets

## Integration Strategy

We'll create a new module that bridges our project.json configuration with the existing visual-diff tool. The key changes include:

1. Create a new screenshot capturing module that uses the existing Puppeteer infrastructure but works with direct URLs instead of Storybook components
2. Create a snapshot manager for storing and retrieving snapshots in the project directory
3. Create a command handler for integrating with our CLI
4. Update the existing visual-diff configuration to work with our setup

## Implementation Steps

### 1. Create a URL-based Screenshot Module

Create a new module `src/lib/visual-regression/screenshot.mjs` that:
- Adapts the existing `captureScreenshots` function to work with a list of URLs
- Configures Puppeteer to capture screenshots at different viewport sizes
- Organizes screenshots by URL path and viewport

```javascript
/**
 * Capture screenshots for a list of URLs
 * 
 * @param {Object} options
 * @param {string} options.baseUrl - Base URL for the website
 * @param {Array<string>} options.paths - Paths to capture
 * @param {Array<Object>} options.viewports - Viewport configurations
 * @param {string} options.outputDir - Output directory for screenshots
 * @returns {Promise<Object>} - Capture results
 */
export async function captureUrlScreenshots(options) {
  // Implementation here
}
```

### 2. Create a Snapshot Manager

Create a snapshot manager module `src/lib/visual-regression/snapshot-manager.mjs` that:
- Creates and manages snapshot directories under `projects/<project>/screenshot-sets/`
- Updates project.json with snapshot information
- Provides functions for retrieving and comparing snapshots

```javascript
/**
 * Create a new snapshot for a project
 * 
 * @param {string} projectDir - Project directory name
 * @param {string} snapshotId - Snapshot identifier
 * @param {Object} config - Visual regression configuration
 * @returns {Promise<Object>} - Snapshot information
 */
export async function createSnapshot(projectDir, snapshotId, config) {
  // Implementation here
}

/**
 * Update project configuration with snapshot information
 * 
 * @param {string} projectDir - Project directory name
 * @param {string} snapshotId - Snapshot identifier
 * @param {Object} snapshotInfo - Snapshot information
 * @returns {Promise<boolean>} - Success status
 */
export async function updateProjectWithSnapshot(projectDir, snapshotId, snapshotInfo) {
  // Implementation here
}
```

### 3. Create a Command Handler

Create a command handler `src/commands/take-snapshot.mjs` that:
- Takes a project and snapshot ID as input
- Loads project configuration
- Calls the snapshot manager to create a snapshot
- Updates project configuration with snapshot information

```javascript
/**
 * Take a snapshot of a project
 * 
 * @param {string} projectName - Project name
 * @param {string} snapshotId - Snapshot identifier
 * @returns {Promise<void>}
 */
export async function takeSnapshot(projectName, snapshotId) {
  // Implementation here
}
```

### 4. Adapt Existing Configuration

Create an adapter module `src/lib/visual-regression/visual-diff-adapter.mjs` that:
- Converts our project.json configuration to a format compatible with the existing visual-diff tool
- Maps viewport configurations
- Handles path conversion

```javascript
/**
 * Convert project configuration to visual-diff configuration
 * 
 * @param {Object} projectConfig - Project configuration
 * @returns {Object} - Visual-diff compatible configuration
 */
export function adaptProjectConfig(projectConfig) {
  // Implementation here
}
```

### 5. Update Main Menu Flow

Update the main menu flow to include snapshot functionality:
- Add a "Take Snapshot" option to the main menu when a project is loaded
- Prompt for snapshot ID
- Call the snapshot command

## Expected Output Structure

```
projects/
  my-project/
    project.json
    screenshot-sets/
      snapshot-20250521/
        desktop/
          homepage.png
          about.png
          contact.png
        mobile/
          homepage.png
          about.png
          contact.png
```

The updated project.json would include:

```json
{
  "name": "My Project",
  "visual-diff": {
    "base_path": "https://example.com",
    "paths": ["/", "/about", "/contact"],
    "viewports": [
      {
        "name": "Desktop",
        "windowWidth": 1600,
        "windowHeight": 1000
      },
      {
        "name": "Mobile",
        "windowWidth": 375,
        "windowHeight": 667
      }
    ]
  },
  "snapshots": {
    "snapshot-20250521": {
      "directory": "screenshot-sets/snapshot-20250521",
      "date": "2025-05-21T10:15:30Z"
    }
  }
}
```

## Technical Considerations

1. **Puppeteer Configuration**: We'll reuse the Puppeteer cluster approach for efficient screenshot capturing.

2. **URL Construction**: We'll combine the base_path with each path to form complete URLs.

3. **Error Handling**: We need robust error handling for network issues, invalid URLs, and authentication requirements.

4. **Storage Efficiency**: Organize screenshots by viewport and path for easy comparison.

5. **Comparison Support**: Lay groundwork for future comparison functionality between snapshots.

## Next Steps

1. Implement the URL-based screenshot module
2. Create the snapshot manager
3. Develop the command handler
4. Create the adapter for existing visual-diff
5. Update the main menu flow
6. Test the integration
7. Document usage