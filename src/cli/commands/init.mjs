/**
 * CLI command: vr-drupal init
 * Initialize a new visual regression project
 */
import { Command } from 'commander';
import chalk from 'chalk';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { input, confirm, checkbox } from '@inquirer/prompts';
import { VIEWPORT_PRESETS, DEFAULT_PATHS, isValidUrl } from '../../lib/visual-regression/config.mjs';
import { validateProjectConfiguration } from '../../utils/validator.mjs';
import { DEFAULT_PROJECT_DIR_NAME } from '../../utils/project-manager.mjs';

/**
 * Fetch CivicTheme content export JSON from a site
 * @param {string} baseUrl - The base URL of the site
 * @returns {Promise<string[]|null>} - Array of paths or null if not found
 */
async function fetchCivicThemeContentExport(baseUrl) {
  const exportUrl = baseUrl.replace(/\/$/, '') + '/content-export.json';

  try {
    const response = await fetch(exportUrl);
    if (!response.ok) return null;

    const data = await response.json();
    if (!Array.isArray(data)) return null;

    const paths = data
      .filter(item => item && typeof item.link === 'string')
      .map(item => item.link);

    return paths.length > 0 ? paths : null;
  } catch {
    return null;
  }
}

/**
 * Parse viewport string to viewport objects
 * @param {string} viewportString - Comma-separated viewport names
 * @returns {Object[]} - Array of viewport configurations
 */
function parseViewports(viewportString) {
  if (!viewportString) {
    return Object.values(VIEWPORT_PRESETS);
  }

  const names = viewportString.split(',').map(v => v.trim().toUpperCase());
  const viewports = [];

  for (const name of names) {
    if (VIEWPORT_PRESETS[name]) {
      viewports.push(VIEWPORT_PRESETS[name]);
    }
  }

  return viewports.length > 0 ? viewports : Object.values(VIEWPORT_PRESETS);
}

/**
 * Parse paths string to array
 * @param {string} pathsString - Comma-separated paths
 * @returns {string[]} - Array of paths
 */
function parsePaths(pathsString) {
  if (!pathsString) return null;
  return pathsString.split(',').map(p => p.trim()).filter(p => p.startsWith('/'));
}

/**
 * Convert project name to directory-safe name
 * @param {string} name - Project name
 * @returns {string} - Directory-safe name
 */
function convertToDirectoryName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

export const initCommand = new Command('init')
  .description('Initialize a new visual regression project')
  .option('--name <name>', 'Project name')
  .option('--url <url>', 'Base URL to screenshot')
  .option('--paths <paths>', 'Comma-separated paths to screenshot')
  .option('--viewports <viewports>', 'Viewport presets: mobile,tablet,desktop')
  .option('--project-root <dir>', 'Project root directory (output will be <root>/.visual-regression/<name>/)')
  .option('--output-dir <dir>', 'Output directory (overrides --project-root)')
  .option('--detect-paths', 'Auto-detect paths from CivicTheme export')
  .option('--no-interactive', 'Run non-interactively (fail if required options missing)')
  .action(async (options) => {
    const isInteractive = options.interactive !== false;

    // We need the project name early to compute the output directory
    // Get project name first (before resolving output directory)
    let projectName = options.name;
    if (!projectName) {
      if (isInteractive) {
        projectName = await input({
          message: 'Enter project name:',
          validate: (value) => value.trim() ? true : 'Project name is required'
        });
      } else {
        console.error(chalk.red('Error: --name is required in non-interactive mode'));
        process.exit(2);
      }
    }

    const directoryName = convertToDirectoryName(projectName);

    // Resolve output directory
    let outputDir;

    if (options.outputDir) {
      // Explicit --output-dir takes highest priority
      outputDir = resolve(options.outputDir);
    } else if (options.projectRoot) {
      // --project-root: output to <root>/.visual-regression/<name>/
      outputDir = resolve(options.projectRoot, DEFAULT_PROJECT_DIR_NAME, directoryName);
    } else if (isInteractive) {
      const projectRoot = await input({
        message: 'Enter project root directory:',
        default: '.'
      });
      outputDir = resolve(projectRoot, DEFAULT_PROJECT_DIR_NAME, directoryName);
    } else {
      // Non-interactive without explicit dir: default to ./.visual-regression/<name>/
      outputDir = resolve(DEFAULT_PROJECT_DIR_NAME, directoryName);
    }

    // Check if project.json already exists
    const configPath = join(outputDir, 'project.json');
    if (existsSync(configPath)) {
      if (isInteractive) {
        const overwrite = await confirm({
          message: `Project already exists at ${outputDir}. Overwrite?`,
          default: false
        });
        if (!overwrite) {
          console.log(chalk.yellow('Initialization cancelled.'));
          process.exit(0);
        }
      } else {
        console.error(chalk.red(`Error: Project already exists at ${outputDir}`));
        process.exit(1);
      }
    }

    // projectName was already resolved above (needed for directory computation)

    // Get base URL
    let baseUrl = options.url;
    if (!baseUrl) {
      if (isInteractive) {
        baseUrl = await input({
          message: 'Enter base URL (e.g., https://example.com):',
          validate: (value) => {
            if (!value.trim()) return 'Base URL is required';
            if (!isValidUrl(value)) return 'Invalid URL. Must be HTTP or HTTPS.';
            return true;
          }
        });
      } else {
        console.error(chalk.red('Error: --url is required in non-interactive mode'));
        process.exit(2);
      }
    } else if (!isValidUrl(baseUrl)) {
      console.error(chalk.red('Error: Invalid URL. Must be HTTP or HTTPS.'));
      process.exit(2);
    }

    // Get paths
    let paths = parsePaths(options.paths);
    if (!paths) {
      if (options.detectPaths || isInteractive) {
        console.log(chalk.cyan('Checking for CivicTheme content export...'));
        const detectedPaths = await fetchCivicThemeContentExport(baseUrl);

        if (detectedPaths) {
          console.log(chalk.green(`Found ${detectedPaths.length} paths from CivicTheme export`));
          if (isInteractive) {
            const usePaths = await confirm({
              message: `Use ${detectedPaths.length} paths from CivicTheme export?`,
              default: true
            });
            if (usePaths) {
              paths = detectedPaths;
            }
          } else {
            paths = detectedPaths;
          }
        } else {
          console.log(chalk.yellow('CivicTheme content export not found.'));
        }
      }

      if (!paths && isInteractive) {
        const useDefault = await confirm({
          message: `Use default paths (${DEFAULT_PATHS.join(', ')})?`,
          default: true
        });

        if (useDefault) {
          paths = DEFAULT_PATHS;
        } else {
          const customPathsStr = await input({
            message: 'Enter comma-separated paths (e.g., /,/about,/contact):',
            validate: (value) => value.trim() ? true : 'At least one path is required'
          });
          paths = parsePaths(customPathsStr) || DEFAULT_PATHS;
        }
      }

      if (!paths) {
        paths = DEFAULT_PATHS;
      }
    }

    // Get viewports
    let viewports = parseViewports(options.viewports);
    if (!options.viewports && isInteractive) {
      const presetChoices = Object.entries(VIEWPORT_PRESETS).map(([key, preset]) => ({
        name: `${preset.name} (${preset.windowWidth}x${preset.windowHeight})`,
        value: key,
        checked: true
      }));

      const selectedPresets = await checkbox({
        message: 'Select viewport presets:',
        choices: presetChoices
      });

      viewports = selectedPresets.map(key => VIEWPORT_PRESETS[key]);
      if (viewports.length === 0) {
        viewports = Object.values(VIEWPORT_PRESETS);
      }
    }

    // Create configuration
    const now = new Date().toISOString();

    const config = {
      name: projectName,
      directoryName: directoryName,
      'visual-diff': {
        base_path: baseUrl,
        paths: paths,
        viewports: viewports,
        advanced: {
          masking_selectors: ['.ct-iframe', '.ct-map--canvas', '.ct-video-player', '.ct-video', 'video'],
          disable_css_transitions: true,
          hide_mask_selectors: true,
          replace_images_with_solid_color: true,
          settle_delay_ms: 2000
        }
      },
      createdAt: now,
      updatedAt: now
    };

    // Validate configuration
    const validation = validateProjectConfiguration(config);
    if (!validation.valid) {
      console.error(chalk.red('Error: Invalid configuration'));
      validation.errors.forEach(err => console.error(chalk.red(`  - ${err.message}`)));
      process.exit(1);
    }

    // Create output directory and save configuration
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    writeFileSync(configPath, JSON.stringify(config, null, 2));

    // Create .gitignore
    const gitignoreContent = `# Screenshot sets - these are generated and should not be committed
screenshot-sets/sets/*
!screenshot-sets/sets/.gitkeep

# Comparison reports - these are generated
screenshot-sets/comparisons/*
!screenshot-sets/comparisons/.gitkeep
`;
    writeFileSync(join(outputDir, '.gitignore'), gitignoreContent);

    // Create screenshot-sets directories with .gitkeep files
    const setsDir = join(outputDir, 'screenshot-sets', 'sets');
    const comparisonsDir = join(outputDir, 'screenshot-sets', 'comparisons');

    mkdirSync(setsDir, { recursive: true });
    mkdirSync(comparisonsDir, { recursive: true });

    writeFileSync(join(setsDir, '.gitkeep'), '');
    writeFileSync(join(comparisonsDir, '.gitkeep'), '');

    console.log();
    console.log(chalk.green('Project initialized successfully!'));
    console.log(chalk.cyan(`  Name: ${projectName}`));
    console.log(chalk.cyan(`  URL: ${baseUrl}`));
    console.log(chalk.cyan(`  Paths: ${paths.length}`));
    console.log(chalk.cyan(`  Viewports: ${viewports.map(v => v.name).join(', ')}`));
    console.log(chalk.cyan(`  Config: ${configPath}`));
    console.log();
    console.log(chalk.yellow('Next steps:'));
    console.log(chalk.white(`  vr-drupal take`));
  });
