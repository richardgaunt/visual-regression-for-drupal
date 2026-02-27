/**
 * CLI command: vr-drupal list
 * List all visual regression projects
 */
import { Command } from 'commander';
import chalk from 'chalk';
import { join } from 'path';
import { getAllSnapshots } from '../../lib/visual-regression/snapshot-manager.mjs';
import { getAllProjects, projectsDir } from '../../utils/project-manager.mjs';

export const listCommand = new Command('list')
  .description('List all visual regression projects')
  .option('--format <format>', 'Output format: table, json', 'table')
  .action(async (options) => {
    const projects = getAllProjects();

    if (projects.length === 0) {
      console.log(chalk.yellow('No projects found in .visual-regression/.'));
      console.log(chalk.cyan('Create one with: vr-drupal init'));
      return;
    }

    if (options.format === 'json') {
      console.log(JSON.stringify(projects, null, 2));
      return;
    }

    // Table format
    console.log();
    console.log(chalk.green(`Found ${projects.length} project(s):`));
    console.log();

    for (const project of projects) {
      const projectPath = join(projectsDir, project.directoryName);
      const snapshotCount = Object.keys(getAllSnapshots(projectPath)).length;
      const comparisonCount = project.comparisons ? Object.keys(project.comparisons).length : 0;

      console.log(chalk.white.bold(project.name));
      console.log(chalk.cyan(`  Directory: ${project.directoryName}`));
      console.log(chalk.cyan(`  URL: ${project['visual-diff']?.base_path || 'Not configured'}`));
      console.log(chalk.cyan(`  Paths: ${project['visual-diff']?.paths?.length || 0}`));
      console.log(chalk.cyan(`  Viewports: ${project['visual-diff']?.viewports?.map(v => v.name).join(', ') || 'None'}`));
      console.log(chalk.cyan(`  Snapshots: ${snapshotCount}`));
      console.log(chalk.cyan(`  Comparisons: ${comparisonCount}`));
      console.log(chalk.cyan(`  Created: ${new Date(project.createdAt).toLocaleString()}`));
      console.log();
    }
  });
