# Visual Regression for Drupal

[![Test Suite](https://github.com/salsadigitalauorg/civictheme-visual-regression/actions/workflows/test.yml/badge.svg)](https://github.com/salsadigitalauorg/civictheme-visual-regression/actions/workflows/test.yml)

Visual regression package designed for running visual regression for CivicTheme but can be configured for other Drupal theme's and websites in general.

## Installation

Run `npm install` to install dependencies, then `npm start` to launch the tool. The CLI provides options to create projects, capture screenshots, and generate comparison reports.

## Features

- **Project Management**: Create projects with configurations for URLs, paths, and viewports
- **Screenshot Capture**: Capture screenshots across configured pages using Puppeteer
- **Visual Comparison**: Generate HTML reports showing differences between screenshot sets with statistics on changes

See [COMMANDS.md](./COMMANDS.md) for full CLI documentation and usage examples.

## Project Configuration (project.json)

Each project stores its configuration in a `project.json` file located at `projects/<project-name>/project.json`. This file defines all settings for visual regression testing and can be manually edited to customize your project.

### File Location

After creating a project, you can find its configuration at:
```
projects/
  └── your-project-name/
      └── project.json
```

### Configuration Structure

The `project.json` file follows this schema:

```json
{
  "name": "CivicTheme",
  "directoryName": "civictheme",
  "visual-diff": {
    "base_path": "http://civictheme.docker.amazee.io/",
    "paths": [
      "/",
      "/about",
      "/contact",
      "/search"
    ],
    "viewports": [
      {
        "name": "Mobile",
        "windowWidth": 375,
        "windowHeight": 667
      },
      {
        "name": "Tablet",
        "windowWidth": 768,
        "windowHeight": 1024
      },
      {
        "name": "Desktop",
        "windowWidth": 1600,
        "windowHeight": 1000
      }
    ],
    "advanced": {
      "masking_selectors": [
        ".ct-iframe",
        ".ct-map--canvas",
        ".ct-video-player",
        ".ct-video",
        "video"
      ],
      "disable_css_transitions": true,
      "hide_mask_selectors": true,
      "replace_images_with_solid_color": true,
      "settle_delay_ms": 2000
    }
  },
  "createdAt": "2025-08-27T12:59:00.218Z",
  "updatedAt": "2025-08-27T12:59:00.218Z",
  "snapshots": {
    "snapshot-20250827": {
      "directory": "screenshot-sets/sets/snapshot-20250827",
      "date": "2025-08-27T23:49:50.047Z",
      "count": 12
    }
  }
}
```

### Common Edits

#### Adding New Paths

To test additional pages, add them to the `paths` array:

```json
"paths": [
  "/",
  "/about",
  "/contact",
  "/search",
  "/news",
  "/events"
]
```

#### Adding or Modifying Viewports

To test at different screen sizes, add or modify viewport entries:

```json
"viewports": [
  {
    "name": "Mobile",
    "windowWidth": 375,
    "windowHeight": 667
  },
  {
    "name": "Large Desktop",
    "windowWidth": 1920,
    "windowHeight": 1080
  }
]
```

#### Configuring Advanced Options

The `advanced` section contains optional settings for screenshot capture:

- **masking_selectors**: CSS selectors for elements to mask (hide) during screenshots (e.g., dynamic content like videos, maps, iframes)
- **disable_css_transitions**: Set to `true` to disable CSS animations for consistent screenshots
- **hide_mask_selectors**: Set to `true` to completely hide masked elements instead of showing them with a mask overlay
- **replace_images_with_solid_color**: Set to `true` to replace all images with solid color blocks for consistency
- **settle_delay_ms**: Milliseconds to wait after page load before taking screenshot (default: 2000)

### Validation

The configuration file is validated against a JSON schema when loaded. Required fields include:
- `name`: Human-readable project name
- `directoryName`: Directory name (lowercase letters, numbers, and hyphens only)
- `visual-diff.base_path`: Valid URL for the website being tested

Viewport dimensions must be at least 320 pixels for both width and height.

## Drupal Module: CivicTheme Visual Regression

The `modules/civictheme_visual_regression` directory contains a Drupal module that can be installed on your Drupal site to automatically generate a list of pages for visual regression testing.

### GovCMS Module setup locally

Copy module from `./modules/` to `./files/custom/` in GovCMS Project

Copy to custom module to GovCMS Project containers
```yaml
  civictheme-visual-regression:
    usage: Run the command to copy in custom modules to the containers
    cmd: |
      docker cp ./files/custom govcms-<project-name>-php-1:/app/web/modules/ || exit 1
      docker cp ./files/custom govcms-<project-name>-nginx-1:/app/web/modules/ || exit 1
      docker cp ./files/custom <project-name>:/app/web/modules/ || exit 1
      ahoy drush en civictheme_visual_regression -y
```
Run with `ahoy my civictheme-visual-regression` and then `drush en civictheme_visual_regression`



### What It Does

The module provides a Views-based REST export at `/civictheme-content-export.json` that returns up to 1000 published nodes (or the total number of nodes if fewer than 1000) in randomized order. Each entry includes:
- `title`: The node title
- `link`: The relative path to the node

### Installation

1. Copy the `modules/civictheme_visual_regression` directory to your Drupal site's `modules/custom/` directory
2. Enable the module: `drush en civictheme_visual_regression`
3. The view will be available immediately at `/civictheme-content-export.json`

### Usage

During project setup, the visual regression tool will automatically detect this endpoint and ingest the paths into your project configuration.
