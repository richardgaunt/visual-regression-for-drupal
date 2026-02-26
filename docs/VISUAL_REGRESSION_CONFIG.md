# Visual Regression Configuration

This document provides information about configuring and using the visual regression testing features in the CivicTheme Update Helper.

## Overview

Visual regression testing allows you to capture screenshots of your website before and after CivicTheme updates, and compare them to identify any visual differences or regressions. This helps ensure that your site's appearance remains consistent during the update process.

## Configuration

Visual regression configuration is stored in the `project.json` file with the following structure:

```json
{
  "visual-diff": {
    "base_path": "https://example.com",
    "paths": [
      "/",
      "/about",
      "/contact"
    ],
    "viewports": [
      {
        "name": "Mobile",
        "windowWidth": 375,
        "windowHeight": 667
      },
      {
        "name": "Desktop",
        "windowWidth": 1600,
        "windowHeight": 1000
      }
    ]
  }
}
```

### Configuration Properties

- **base_path**: The base URL of your website (e.g., `https://example.com`)
- **paths**: An array of URL paths to capture screenshots for (e.g., `/about`, `/contact`)
- **viewports**: An array of viewport configurations, each with:
  - **name**: A descriptive name for the viewport (e.g., "Mobile", "Desktop")
  - **windowWidth**: The viewport width in pixels
  - **windowHeight**: The viewport height in pixels

## Default Configuration

The tool provides default configurations that you can use as a starting point:

### Default Paths
- `/` (homepage)
- `/about`
- `/contact`
- `/search`

### Default Viewports
- **Mobile**: 375×667
- **Tablet**: 768×1024
- **Desktop**: 1600×1000

## Setting Up Visual Regression Testing

You can configure visual regression testing in two ways:

### During Project Creation

When creating a new project, you'll be prompted to set up visual regression testing. The process will guide you through:

1. Entering the base URL for your website
2. Selecting or customizing paths to capture
3. Choosing viewport configurations

### Editing Configuration Manually

You can also manually edit the `project.json` file to update your visual regression configuration. Make sure to follow the correct structure as shown above.

## Best Practices

- **Base URL**: Use the development or staging URL during testing to avoid capturing production data
- **Paths**: Include critical pages that showcase CivicTheme components
- **Viewports**: Configure at least one mobile and one desktop viewport
- **Custom Viewports**: Add custom viewports if your site has specific breakpoints

## Troubleshooting

### Invalid URL
- Ensure the base URL includes the protocol (http:// or https://)
- Verify that the URL is accessible from the environment where you run the tests

### Path Configuration
- All paths should start with a `/` character
- Ensure paths exist on your site to avoid 404 errors during screenshot capture