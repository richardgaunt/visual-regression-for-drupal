/**
 * CLI command: vr-drupal generate-actions
 * Generate GitHub Actions workflow files for visual regression testing
 */
import { Command } from 'commander';
import chalk from 'chalk';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { join, resolve } from 'path';
import { confirm } from '@inquirer/prompts';
import {
  loadTemplate,
  renderTemplate,
  buildTemplateVariables,
} from '../../lib/github-actions/template-renderer.mjs';
import { resolveProjectDir } from '../../utils/project-manager.mjs';

export const generateActionsCommand = new Command('generate-actions')
  .description('Generate GitHub Actions workflows for visual regression testing')
  .option('--project-dir <dir>', 'Project directory containing project.json')
  .option('--output-dir <dir>', 'Output directory for workflow files', '.github/workflows')
  .option('--baseline-branches <branches>', 'Comma-separated branches for baseline triggers', 'main')
  .option('--node-version <version>', 'Node.js version for workflows', '22')
  .option('--install-command <cmd>', 'Command to install dependencies', 'npm install')
  .option('--needs <job>', 'Job dependency (e.g., build) - VR job will wait for this job to complete')
  .option('--with-auth', 'Include authentication configuration sections')
  .option('--overwrite', 'Overwrite existing workflow files')
  .option('--no-interactive', 'Run non-interactively')
  .action(async (options) => {
    const isInteractive = options.interactive !== false;
    const resolvedDir = options.projectDir ? resolve(options.projectDir) : resolveProjectDir(options);
    const outputDir = resolve(options.outputDir);

    if (!resolvedDir) {
      console.error(chalk.red('Error: No project found. Use --project-dir or create a project with: vr-drupal init'));
      process.exit(3);
    }

    const projectDir = resolve(resolvedDir);

    // Validate project directory has project.json
    const configPath = join(projectDir, 'project.json');
    if (!existsSync(configPath)) {
      console.error(chalk.red(`Error: No project.json found in ${projectDir}`));
      console.error(chalk.yellow('Run "vr-drupal init" first to create a project.'));
      process.exit(3);
    }

    // Build template variables — use the original --project-dir value if given, else the resolved relative path
    const templateProjectDir = options.projectDir || path.relative(process.cwd(), projectDir);
    const variables = buildTemplateVariables({
      projectDir: templateProjectDir,
      baselineBranches: options.baselineBranches,
      nodeVersion: options.nodeVersion,
      installCommand: options.installCommand,
      needs: options.needs,
      withAuth: options.withAuth,
    });

    // Load and render templates
    const baselineTemplate = loadTemplate('visual-regression-baseline.yml');
    const compareTemplate = loadTemplate('visual-regression-compare.yml');

    const baselineContent = renderTemplate(baselineTemplate, variables);
    const compareContent = renderTemplate(compareTemplate, variables);

    // Check for existing files
    const baselinePath = join(outputDir, 'visual-regression-baseline.yml');
    const comparePath = join(outputDir, 'visual-regression-compare.yml');

    const existingFiles = [];
    if (existsSync(baselinePath)) existingFiles.push('visual-regression-baseline.yml');
    if (existsSync(comparePath)) existingFiles.push('visual-regression-compare.yml');

    if (existingFiles.length > 0 && !options.overwrite) {
      if (isInteractive) {
        const overwrite = await confirm({
          message: `Workflow files already exist (${existingFiles.join(', ')}). Overwrite?`,
          default: false,
        });
        if (!overwrite) {
          console.log(chalk.yellow('Generation cancelled.'));
          process.exit(0);
        }
      } else {
        console.error(chalk.red(`Error: Workflow files already exist: ${existingFiles.join(', ')}`));
        console.error(chalk.yellow('Use --overwrite to replace existing files.'));
        process.exit(1);
      }
    }

    // Create output directory
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    // Write workflow files
    writeFileSync(baselinePath, baselineContent);
    writeFileSync(comparePath, compareContent);

    // Print summary
    console.log();
    console.log(chalk.green('GitHub Actions workflows generated successfully!'));
    console.log();
    console.log(chalk.cyan('Files created:'));
    console.log(chalk.white(`  ${baselinePath}`));
    console.log(chalk.white(`  ${comparePath}`));
    console.log();
    console.log(chalk.cyan('Configuration:'));
    console.log(chalk.white(`  Project directory: ${templateProjectDir}`));
    console.log(chalk.white(`  Baseline branches: ${options.baselineBranches}`));
    console.log(chalk.white(`  Node.js version: ${options.nodeVersion}`));
    console.log(chalk.white(`  Auth sections: ${options.withAuth ? 'included' : 'not included'}`));
    console.log(chalk.white(`  Baseline artifact retention: 90 days`));
    console.log(chalk.white(`  Report artifact retention: 14 days`));
    console.log();
    console.log(chalk.yellow('Next steps:'));
    console.log(chalk.white('  1. Review the generated workflow files'));
    console.log(chalk.white('  2. Commit and push to your repository'));
    console.log(chalk.white('  3. Push to main to create the first baseline'));
    console.log(chalk.white('  4. Open a PR to see visual regression comparisons'));
    if (options.withAuth) {
      console.log(chalk.white('  5. Configure auth secrets in your repository settings'));
    }
  });
