# Visual Diff Implementation Summary

This document summarizes the implementation of the visual regression testing functionality in the CivicTheme Update Helper tool.

## Overview

The visual regression testing feature allows users to take snapshots of their website at different viewports and compare them between CivicTheme versions. The implementation leverages Puppeteer for capturing screenshots and integrates with the existing project configuration system.

## Implementation Details

### Core Components

1. **URL-based Screenshot Module** (`src/lib/visual-regression/screenshot.mjs`)
   - Captures screenshots of specified URLs at different viewport sizes
   - Uses Puppeteer for browser automation
   - Organizes screenshots by viewport and path

2. **Snapshot Manager** (`src/lib/visual-regression/snapshot-manager.mjs`)
   - Creates and manages snapshot directories
   - Updates project configuration with snapshot information
   - Provides APIs for retrieving and comparing snapshots

3. **Take Snapshot Command** (`src/commands/take-snapshot.mjs`)
   - Provides CLI command for taking snapshots
   - Handles project selection and snapshot ID input
   - Integrates with the main menu system

### Integration Points

1. **Main Menu**
   - Added "Take visual regression snapshot" option

2. **Load Existing Project**
   - Offers to take a snapshot after loading a project with visual regression configuration

3. **Project Configuration**
   - Uses the `visual-diff` configuration from `project.json`
   - Updates `project.json` with snapshot information

## Data Structure

### Visual Regression Configuration

```json
{
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
  }
}
```

### Snapshot Information

```json
{
  "snapshots": {
    "snapshot-20250521": {
      "directory": "screenshot-sets/snapshot-20250521",
      "date": "2025-05-21T10:15:30Z",
      "count": 6
    }
  }
}
```

## Directory Structure

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

## Dependencies

- **puppeteer**: Browser automation for taking screenshots
- **serve-handler**: For potential future HTTP server functionality

## Testing

The implementation includes unit tests for the snapshot manager functionality.

## Future Enhancements

1. **Snapshot Comparison**
   - Implement functionality to compare two snapshots
   - Generate visual diff reports

2. **Automated Regression Testing**
   - Add CI/CD integration
   - Automatic snapshot generation for new CivicTheme versions

3. **Visual Review Interface**
   - Interactive UI for reviewing visual differences
   - Approval/rejection workflow