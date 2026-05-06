/**
 * Shared "show project details" operation.
 */
import chalk from 'chalk';
import { getAllSnapshots, getAllComparisons } from '../lib/visual-regression/snapshot-manager.mjs';

/**
 * @param {Object} args
 * @param {string} args.projectPath
 * @param {Object} args.projectConfig
 * @param {Object} [args.options]
 * @param {boolean} [args.options.snapshots]
 * @param {boolean} [args.options.comparisons]
 * @param {boolean} [args.options.config]
 * @param {string}  [args.options.format] - 'text' | 'json'
 */
export function runShow({ projectPath, projectConfig, options = {} }) {
  const { snapshots: showSnapshots, comparisons: showComparisons, config: showConfig, format = 'text' } = options;
  const showAll = !showSnapshots && !showComparisons && !showConfig;

  if (format === 'json') {
    let output = projectConfig;
    if (showSnapshots) output = getAllSnapshots(projectPath);
    else if (showComparisons) output = getAllComparisons(projectPath);
    else if (showConfig) output = projectConfig['visual-diff'] || {};
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  console.log();
  console.log(chalk.green.bold(projectConfig.name));
  console.log(chalk.cyan('='.repeat(projectConfig.name.length)));
  console.log();

  if (showConfig || showAll) {
    console.log(chalk.white.bold('Configuration:'));
    if (projectConfig.directoryName) {
      console.log(chalk.cyan(`  Directory: ${projectConfig.directoryName}`));
    }
    if (projectConfig.createdAt) {
      console.log(chalk.cyan(`  Created: ${new Date(projectConfig.createdAt).toLocaleString()}`));
    }
    if (projectConfig.updatedAt) {
      console.log(chalk.cyan(`  Updated: ${new Date(projectConfig.updatedAt).toLocaleString()}`));
    }
    console.log();

    const vd = projectConfig['visual-diff'];
    if (vd) {
      console.log(chalk.white.bold('Visual Regression Settings:'));
      console.log(chalk.cyan(`  Base URL: ${vd.base_path}`));
      console.log(chalk.cyan(`  Paths: ${vd.paths?.length || 0}`));
      if (vd.paths && vd.paths.length <= 10) {
        vd.paths.forEach(p => console.log(chalk.gray(`    - ${p}`)));
      } else if (vd.paths) {
        vd.paths.slice(0, 5).forEach(p => console.log(chalk.gray(`    - ${p}`)));
        console.log(chalk.gray(`    ... and ${vd.paths.length - 5} more`));
      }
      console.log(chalk.cyan(`  Viewports: ${vd.viewports?.map(v => `${v.name} (${v.windowWidth}x${v.windowHeight})`).join(', ') || 'None'}`));
      if (vd.advanced) {
        console.log(chalk.cyan('  Advanced:'));
        console.log(chalk.gray(`    - CSS transitions disabled: ${vd.advanced.disable_css_transitions}`));
        console.log(chalk.gray(`    - Hide mask selectors: ${vd.advanced.hide_mask_selectors}`));
        console.log(chalk.gray(`    - Replace images: ${vd.advanced.replace_images_with_solid_color}`));
        console.log(chalk.gray(`    - Settle delay: ${vd.advanced.settle_delay_ms}ms`));
      }
      console.log();
    }
  }

  if (showSnapshots || showAll) {
    const snapshots = getAllSnapshots(projectPath);
    const ids = Object.keys(snapshots);
    console.log(chalk.white.bold(`Snapshots (${ids.length}):`));
    if (ids.length === 0) {
      console.log(chalk.gray('  No snapshots yet'));
    } else {
      for (const id of ids) {
        const s = snapshots[id];
        console.log(chalk.cyan(`  ${id}`));
        console.log(chalk.gray(`    Date: ${new Date(s.date).toLocaleString()}`));
        console.log(chalk.gray(`    Screenshots: ${s.count}`));
        console.log(chalk.gray(`    Directory: ${s.directory}`));
      }
    }
    console.log();
  }

  if (showComparisons || showAll) {
    const comparisons = getAllComparisons(projectPath);
    const ids = Object.keys(comparisons);
    console.log(chalk.white.bold(`Comparisons (${ids.length}):`));
    if (ids.length === 0) {
      console.log(chalk.gray('  No comparisons yet'));
    } else {
      for (const id of ids) {
        const c = comparisons[id];
        console.log(chalk.cyan(`  ${id}`));
        console.log(chalk.gray(`    Source: ${c.source}`));
        console.log(chalk.gray(`    Target: ${c.target}`));
        console.log(chalk.gray(`    Date: ${new Date(c.date).toLocaleString()}`));
        if (c.statistics) {
          const s = c.statistics;
          const hasChanges = s.changed > 0 || s.new > 0 || s.deleted > 0;
          console.log(chalk.gray(`    Results: ${s.passed}/${s.total} passed${hasChanges ? ` (${s.changed} changed, ${s.new} new, ${s.deleted} deleted)` : ''}`));
        }
      }
    }
    console.log();
  }
}
