/**
 * Comparison module for Visual Regression Testing
 */

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { ensureDirectory } from './screenshot-set-manager.mjs';
import { determineOptimalConcurrency } from './screenshot.mjs';

// Get the tool's root directory to find the installed reg-cli
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const toolRootDir = path.resolve(__dirname, '..', '..', '..');
const regCliBin = path.join(toolRootDir, 'node_modules', '.bin', 'reg-cli');

/**
 * Extracts statistics from the reg-cli JSON output
 *
 * @param {string} jsonPath - Path to the reg.json file
 * @returns {Object} - Statistics object with counts
 */
export function extractComparisonStatistics(jsonPath) {
  if (!fs.existsSync(jsonPath)) {
    return {
      total: 0,
      passed: 0,
      failed: 0,
      new: 0,
      deleted: 0,
      changed: 0
    };
  }

  try {
    const jsonData = fs.readFileSync(jsonPath, 'utf8');
    const data = JSON.parse(jsonData);

    const newItems = data.newItems || [];
    const deletedItems = data.deletedItems || [];
    const failedItems = data.failedItems || [];
    const passedItems = data.passedItems || [];

    return {
      total: newItems.length + deletedItems.length + failedItems.length + passedItems.length,
      passed: passedItems.length,
      failed: failedItems.length,
      new: newItems.length,
      deleted: deletedItems.length,
      changed: failedItems.length
    };
  } catch (error) {
    console.error(`Error extracting comparison statistics: ${error.message}`);
    return {
      total: 0,
      passed: 0,
      failed: 0,
      new: 0,
      deleted: 0,
      changed: 0
    };
  }
}

/**
 * Compare two sets of screenshots using reg-cli.
 *
 * @param {string} sourceDir - Source screenshots directory.
 * @param {string} targetDir - Target screenshots directory.
 * @param {string} outputDir - Output directory for comparison results.
 * @returns {Promise<Object>} - Comparison result with statistics.
 */
export async function compareScreenshots(
  sourceDir,
  targetDir,
  outputDir,
) {
  ensureDirectory(outputDir);

  try {
    console.log(`Comparing screenshots from ${sourceDir} to ${targetDir}`);
    console.log(`Results will be saved to ${outputDir}`);
    const concurrency = await determineOptimalConcurrency();
    execSync(
      `"${regCliBin}" "${sourceDir}" "${targetDir}" "${outputDir}" --additionalDetection client --matchingThreshold 0 --thresholdRate 0.001 --concurrency ${concurrency} --report "${outputDir}/index.html" --json "${outputDir}/reg.json"`,
      { stdio: 'inherit' },
    );

    const statistics = extractComparisonStatistics(`${outputDir}/reg.json`);

    const result = {
      source: path.basename(sourceDir),
      target: path.basename(targetDir),
      directory: outputDir,
      date: new Date().toISOString(),
      statistics: statistics
    };

    console.log('✅ Comparison complete. Results available at:');
    return result;
  } catch (error) {
    console.error(`Error comparing screenshots: ${error.message}`);
    return {
      source: path.basename(sourceDir),
      target: path.basename(targetDir),
      directory: outputDir,
      date: new Date().toISOString(),
      statistics: {
        total: 0,
        passed: 0,
        failed: 0,
        new: 0,
        deleted: 0,
        changed: 0,
        error: error.message
      }
    };
  }
}
