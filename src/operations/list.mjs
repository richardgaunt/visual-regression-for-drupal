/**
 * Shared "list projects" operation.
 */
import { join } from 'path';
import chalk from 'chalk';
import { getAllSnapshots, getAllComparisons } from '../lib/visual-regression/snapshot-manager.mjs';
import { getAllProjects, projectsDir } from '../utils/project-manager.mjs';

/**
 * @param {Object} [options]
 * @param {string} [options.format] - 'table' | 'json'
 */
export function runList({ format = 'table' } = {}) {
  const projects = getAllProjects();

  if (projects.length === 0) {
    if (format === 'json') {
      console.log('[]');
      return;
    }
    console.log(chalk.yellow('No projects found in .visual-regression/.'));
    console.log(chalk.cyan('Create one with: vr-drupal init'));
    return;
  }

  if (format === 'json') {
    console.log(JSON.stringify(projects, null, 2));
    return;
  }

  console.log();
  console.log(chalk.green(`Found ${projects.length} project(s):`));
  console.log();

  for (const project of projects) {
    const projectPath = join(projectsDir, project.directoryName);
    const snapshotCount = Object.keys(getAllSnapshots(projectPath)).length;
    const comparisonCount = Object.keys(getAllComparisons(projectPath)).length;

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
}
