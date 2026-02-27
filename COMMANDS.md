# CivicTheme Visual Regression CLI Commands

This document describes all available CLI commands for the `vr-drupal` tool. These commands enable visual regression testing workflows for CivicTheme websites.

## Installation

```bash
# Install from npm
npm install -g @richardgaunt/visual-regression-for-drupal

# Or link for development
npm link
```

After installation, the `vr-drupal` command is available globally.

## Command Overview

| Command | Purpose |
|---------|---------|
| `vr-drupal` | Launch interactive menu (no arguments) |
| `vr-drupal init` | Initialize a new visual regression project |
| `vr-drupal take` | Take visual regression screenshots |
| `vr-drupal compare` | Compare two snapshot sets |
| `vr-drupal list` | List all projects |
| `vr-drupal show` | Show project details |
| `vr-drupal delete` | Delete projects, snapshots, or comparisons |

---

## Global Options

These options apply to the main `vr-drupal` command:

| Option | Description |
|--------|-------------|
| `--project-dir <dir>` | Load project from specified directory for interactive mode |
| `-V, --version` | Output the version number |
| `-h, --help` | Display help for command |

### Interactive Mode with Specific Project

```bash
# Launch interactive menu for a specific project directory
vr-drupal --project-dir .visual-regression/my-site
```

This loads the project from the specified directory and shows an interactive menu to take snapshots or compare them.

---

## vr-drupal init

Initialize a new visual regression project. Creates a `.visual-regression/<name>/project.json` configuration file.

### Usage

```bash
vr-drupal init [options]
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--name <name>` | Project name | (prompted) |
| `--url <url>` | Base URL to screenshot (e.g., https://example.com) | (prompted) |
| `--paths <paths>` | Comma-separated paths to screenshot (e.g., /,/about,/contact) | auto-detect or default |
| `--viewports <viewports>` | Viewport presets: mobile,tablet,desktop | all |
| `--project-root <dir>` | Project root directory (output will be `<root>/.visual-regression/<name>/`) | `.` |
| `--output-dir <dir>` | Output directory (overrides --project-root) | `.visual-regression/<name>/` |
| `--detect-paths` | Auto-detect paths from CivicTheme export endpoint | false |
| `--no-interactive` | Fail if required options missing (for CI/CD) | false |

### Examples

```bash
# Interactive mode - prompts for all options
vr-drupal init

# Non-interactive with all options
vr-drupal init \
  --name "My Project" \
  --url https://example.com \
  --paths /,/about,/contact \
  --viewports mobile,desktop \
  --no-interactive

# Auto-detect paths from CivicTheme
vr-drupal init \
  --name "CivicTheme Site" \
  --url https://civictheme.example.com \
  --detect-paths

# Initialize in a different root directory
vr-drupal init \
  --name "My Site" \
  --url https://example.com \
  --project-root /path/to/repo
```

### Output

Creates `.visual-regression/<name>/project.json` with:
- Project name and directory name
- Visual regression configuration (base URL, paths, viewports)
- Advanced settings (masking selectors, CSS transition handling, settle delay)

---

## vr-drupal take

Take visual regression screenshots for a project.

### Usage

```bash
vr-drupal take [project] [options]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `project` | Project name (subdirectory within `.visual-regression/`) |

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--project-dir <dir>` | Directory containing project.json | (auto-discovered) |
| `--id <id>` | Snapshot ID | snapshot-YYYYMMDD |
| `--auth-type <type>` | Authentication type: none, basic, cookie | none |
| `--username <user>` | Basic auth username | (prompted if auth-type=basic) |
| `--password <pass>` | Basic auth password | (prompted if auth-type=basic) |
| `--cookies <string>` | Cookie string: "name1=val1; name2=val2" | (none) |
| `--overwrite` | Overwrite existing snapshot | false |
| `--no-interactive` | Run non-interactively | false |

### Examples

```bash
# Auto-discover project (when only one project exists)
vr-drupal take --id before-update

# Take snapshot for a named project
vr-drupal take my-site --id before-update

# Take snapshot with explicit project directory
vr-drupal take --project-dir .visual-regression/my-site --id baseline

# With basic authentication
vr-drupal take my-site \
  --id authenticated-snapshot \
  --auth-type basic \
  --username admin \
  --password secret

# With session cookies
vr-drupal take my-site \
  --id session-snapshot \
  --cookies "SESS123=abc123; token=xyz789"

# Non-interactive for CI/CD
vr-drupal take my-site \
  --id ci-snapshot-$BUILD_NUMBER \
  --no-interactive
```

### Output

- Creates screenshots in `<project-dir>/screenshot-sets/sets/<snapshot-id>/`
- Organized by viewport: `mobile/`, `tablet/`, `desktop/`
- Updates `project.json` with snapshot metadata

---

## vr-drupal compare

Compare two snapshot sets and generate a visual diff report.

### Usage

```bash
vr-drupal compare [project] [options]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `project` | Project name (subdirectory within `.visual-regression/`) |

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--project-dir <dir>` | Directory containing project.json | (auto-discovered) |
| `--source <id>` | Source (before) snapshot ID | (prompted) |
| `--target <id>` | Target (after) snapshot ID | (prompted) |
| `--open` | Open report in browser after comparison | false |
| `--aggregate-screenshots` | Copy screenshot sets into comparison directory for self-contained static hosting | false |
| `--output-format <format>` | Output format: html, json | html |
| `--no-interactive` | Run non-interactively | false |

### Examples

```bash
# Auto-discover project and select snapshots interactively
vr-drupal compare

# Compare specific snapshots for a named project
vr-drupal compare my-site --source before --target after

# Compare and open report
vr-drupal compare my-site \
  --source baseline \
  --target current \
  --open

# Self-contained report for uploading to static hosting (Netlify, S3, etc.)
vr-drupal compare my-site \
  --source baseline \
  --target current \
  --aggregate-screenshots \
  --no-interactive

# JSON output for scripting
vr-drupal compare my-site \
  --source baseline \
  --target current \
  --output-format json \
  --no-interactive
```

### Output

- Creates comparison report in `<project-dir>/screenshot-sets/comparisons/<source>--<target>/`
- `index.html`: Visual HTML report
- `reg.json`: JSON statistics (total, passed, changed, new, deleted)
- Updates `project.json` with comparison metadata

### Self-Contained Reports (`--aggregate-screenshots`)

By default, the comparison report references screenshot images via relative paths (`../sets/baseline`, `../sets/current`) that point outside the comparison directory. This works when browsing locally but breaks when you upload just the comparison directory to a static host like Netlify, GitHub Pages, or S3.

Use `--aggregate-screenshots` to make the comparison directory fully self-contained:

- Copies both screenshot sets into `<comparison-dir>/sets/baseline/` and `<comparison-dir>/sets/current/`
- Rewrites image paths in both `reg.json` and `index.html` to `./sets/<name>`
- The entire comparison directory can then be uploaded as-is and will work correctly

```bash
# Generate a self-contained report
vr-drupal compare my-site \
  --source baseline \
  --target current \
  --aggregate-screenshots \
  --no-interactive

# Upload the comparison directory to Netlify, S3, etc.
netlify deploy --dir .visual-regression/my-site/screenshot-sets/comparisons/baseline--current/
```

### Statistics Output

```json
{
  "total": 66,
  "passed": 64,
  "changed": 2,
  "new": 0,
  "deleted": 0
}
```

---

## vr-drupal list

List all visual regression projects.

### Usage

```bash
vr-drupal list [options]
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--format <format>` | Output format: table, json | table |

### Examples

```bash
# List all projects in table format
vr-drupal list

# List all projects in JSON format
vr-drupal list --format json
```

### Output (Table)

```
Found 2 project(s):

My Project
  Directory: my-project
  URL: https://example.com
  Paths: 25
  Viewports: Mobile, Tablet, Desktop
  Snapshots: 3
  Comparisons: 2
  Created: 10/02/2026, 11:00:00 am
```

### Output (JSON)

```json
[
  {
    "name": "My Project",
    "directoryName": "my-project",
    "visual-diff": {
      "base_path": "https://example.com",
      "paths": ["/", "/about"],
      "viewports": [...]
    },
    "snapshots": {...},
    "comparisons": {...}
  }
]
```

---

## vr-drupal show

Show detailed information about a project.

### Usage

```bash
vr-drupal show [project] [options]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `project` | Project name (subdirectory within `.visual-regression/`) |

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--project-dir <dir>` | Directory containing project.json | (auto-discovered) |
| `--snapshots` | List snapshots only | false |
| `--comparisons` | List comparisons only | false |
| `--config` | Show full configuration only | false |
| `--format <format>` | Output format: text, json | text |

### Examples

```bash
# Show all details (auto-discover or select interactively)
vr-drupal show

# Show a named project
vr-drupal show my-site

# Show only snapshots
vr-drupal show my-site --snapshots

# Show only comparisons
vr-drupal show my-site --comparisons

# Show only configuration
vr-drupal show my-site --config

# JSON output
vr-drupal show my-site --format json

# JSON output of snapshots only
vr-drupal show my-site --snapshots --format json
```

### Output

```
My Project
==========

Configuration:
  Directory: my-project
  Created: 10/02/2026, 11:00:00 am
  Updated: 10/02/2026, 2:30:00 pm

Visual Regression Settings:
  Base URL: https://example.com
  Paths: 25
    - /
    - /about
    - /contact
    ... and 22 more
  Viewports: Mobile (375x667), Tablet (768x1024), Desktop (1600x1000)
  Advanced:
    - CSS transitions disabled: true
    - Hide mask selectors: true
    - Replace images: true
    - Settle delay: 2000ms

Snapshots (3):
  baseline
    Date: 10/02/2026, 11:30:00 am
    Screenshots: 75
    Directory: screenshot-sets/sets/baseline

Comparisons (2):
  baseline--after-update
    Source: baseline
    Target: after-update
    Date: 10/02/2026, 2:00:00 pm
    Results: 73/75 passed (2 changed, 0 new, 0 deleted)
```

---

## vr-drupal delete

Delete a project, snapshot, or comparison.

### Usage

```bash
vr-drupal delete [project] [options]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `project` | Project name (subdirectory within `.visual-regression/`) |

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--project-dir <dir>` | Directory containing project.json | (auto-discovered) |
| `--snapshot <id>` | Delete specific snapshot only | (none) |
| `--comparison <id>` | Delete specific comparison only | (none) |
| `--force` | Skip confirmation prompt | false |
| `--no-interactive` | Run non-interactively | false |

### Examples

```bash
# Interactive - select project to delete
vr-drupal delete

# Delete entire project (with confirmation)
vr-drupal delete my-site

# Delete project without confirmation
vr-drupal delete my-site --force

# Delete specific snapshot
vr-drupal delete my-site --snapshot old-snapshot

# Delete specific comparison
vr-drupal delete my-site --comparison baseline--old

# Non-interactive deletion
vr-drupal delete my-site \
  --snapshot old-snapshot \
  --force \
  --no-interactive
```

### Behavior

- Deleting a project removes all snapshots and comparisons
- Deleting a snapshot removes the screenshot directory and metadata
- Deleting a comparison removes the comparison directory and metadata
- Without `--force`, prompts for confirmation in interactive mode
- With `--no-interactive`, requires `--force` for project deletion

---

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments |
| 3 | Project not found |
| 4 | Snapshot not found |
| 5 | Authentication failed |
| 6 | Screenshot capture failed |
| 7 | Comparison failed |

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VR_DRUPAL_PROJECT_DIR` | Default project directory for `--project-dir` option |
| `VR_DRUPAL_PROJECTS_DIR` | Override base `.visual-regression/` location (used for testing) |

### Using Environment Variables

```bash
# Point to a specific project directory
export VR_DRUPAL_PROJECT_DIR=.visual-regression/my-site

# Now all commands use this directory without needing --project-dir
vr-drupal take --id baseline
vr-drupal compare --source baseline --target current
vr-drupal show
```

---

## CI/CD Usage

For automated pipelines, use `--no-interactive` to ensure commands fail rather than prompt:

```bash
# Initialize project (creates .visual-regression/ci-project/)
vr-drupal init \
  --name "CI Project" \
  --url $SITE_URL \
  --detect-paths \
  --no-interactive

# Take baseline screenshot (auto-discovers the project)
vr-drupal take \
  --id baseline-$CI_COMMIT_SHA \
  --no-interactive

# Take comparison screenshot
vr-drupal take \
  --id pr-$CI_MERGE_REQUEST_IID \
  --no-interactive

# Compare and get JSON result (--aggregate-screenshots for uploadable report)
RESULT=$(vr-drupal compare \
  --source baseline-$CI_COMMIT_SHA \
  --target pr-$CI_MERGE_REQUEST_IID \
  --aggregate-screenshots \
  --output-format json \
  --no-interactive)

# Check for changes
CHANGED=$(echo $RESULT | jq '.changed')
if [ "$CHANGED" -gt 0 ]; then
  echo "Visual changes detected!"
  exit 1
fi
```

---

## Project Directory Structure

Projects live in `.visual-regression/<project-name>/` relative to your working directory:

```
.visual-regression/
└── my-site/
    ├── project.json              # Project configuration
    ├── .gitignore                # Ignores generated screenshot data
    └── screenshot-sets/
        ├── sets/
        │   ├── <snapshot-id>/    # Screenshots organized by viewport
        │   │   ├── mobile/
        │   │   ├── tablet/
        │   │   └── desktop/
        │   └── <snapshot-id>/
        └── comparisons/
            └── <source>--<target>/  # Comparison reports
                ├── index.html       # Visual HTML report
                └── reg.json         # Statistics JSON
```

### Auto-Discovery

When only one project exists in `.visual-regression/`, commands automatically use it without requiring a project name or `--project-dir`. When multiple projects exist, you can specify by name (`vr-drupal take my-site`) or interactively select from a list.
