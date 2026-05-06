/**
 * CLI command: vr-drupal list
 * List all visual regression projects
 */
import { Command } from 'commander';
import { runList } from '../../operations/list.mjs';

export const listCommand = new Command('list')
  .description('List all visual regression projects')
  .option('--format <format>', 'Output format: table, json', 'table')
  .action((options) => {
    runList({ format: options.format });
  });
