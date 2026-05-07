/**
 * Comparison module for Visual Regression Testing
 */

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { ensureDirectory } from './screenshot-set-manager.mjs';
import { determineOptimalConcurrency } from './screenshot.mjs';
import { URL_DECORATOR_SCRIPT } from './url-decorator-script.mjs';

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

    injectUrlsIntoReport(sourceDir, targetDir, outputDir);

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

function readUrlMap(setDir) {
  const urlsPath = path.join(setDir, 'urls.json');
  if (!fs.existsSync(urlsPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(urlsPath, 'utf8'));
  } catch (error) {
    console.warn(`Could not parse ${urlsPath}: ${error.message}`);
    return null;
  }
}

/**
 * After reg-cli has generated index.html, inject a URL mapping (window.__reg_urls__)
 * and a small DOM-decorator script so each item in the report is annotated with a
 * link to the source URL it was captured from.
 *
 * Silently no-ops if neither set has a urls.json (preserves backwards-compat with
 * older sets captured before this feature existed).
 *
 * @param {string} sourceDir - Source (expected/before) screenshot set directory.
 * @param {string} targetDir - Target (actual/after) screenshot set directory.
 * @param {string} outputDir - Comparison output directory.
 */
export function injectUrlsIntoReport(sourceDir, targetDir, outputDir) {
  const expected = readUrlMap(sourceDir);
  const actual = readUrlMap(targetDir);
  if (!expected && !actual) return;

  const indexPath = path.join(outputDir, 'index.html');
  if (!fs.existsSync(indexPath)) return;

  const payload = { expected: expected || {}, actual: actual || {} };
  const marker = '<!-- vr-url-injection -->';
  const injection =
    `${marker}\n` +
    `<script>window.__reg_urls__ = ${JSON.stringify(payload)};</script>\n` +
    `<script>${URL_DECORATOR_SCRIPT}</script>\n`;

  let html = fs.readFileSync(indexPath, 'utf8');
  if (html.includes(marker)) return;
  html = html.replace('</body>', `${injection}</body>`);
  fs.writeFileSync(indexPath, html, 'utf8');

  // Also expose the mapping in reg.json for programmatic consumers.
  const regJsonPath = path.join(outputDir, 'reg.json');
  if (fs.existsSync(regJsonPath)) {
    try {
      const regData = JSON.parse(fs.readFileSync(regJsonPath, 'utf8'));
      regData.urls = payload;
      fs.writeFileSync(regJsonPath, JSON.stringify(regData, null, 2), 'utf8');
    } catch (error) {
      console.warn(`Could not annotate reg.json with URLs: ${error.message}`);
    }
  }
}

/**
 * Copy screenshot sets into the comparison output directory and rewrite
 * paths in reg.json and index.html so the report is self-contained.
 *
 * @param {string} sourceDir - Absolute path to the source screenshot set.
 * @param {string} targetDir - Absolute path to the target screenshot set.
 * @param {string} outputDir - Comparison output directory.
 */
export function aggregateScreenshots(sourceDir, targetDir, outputDir) {
  const sourceName = path.basename(sourceDir);
  const targetName = path.basename(targetDir);

  // Copy screenshot sets into the comparison directory
  const destSource = path.join(outputDir, 'sets', sourceName);
  const destTarget = path.join(outputDir, 'sets', targetName);
  // eslint-disable-next-line n/no-unsupported-features/node-builtins
  fs.cpSync(sourceDir, destSource, { recursive: true });
  // eslint-disable-next-line n/no-unsupported-features/node-builtins
  fs.cpSync(targetDir, destTarget, { recursive: true });

  // Rewrite reg.json paths
  const regJsonPath = path.join(outputDir, 'reg.json');
  if (fs.existsSync(regJsonPath)) {
    const regData = JSON.parse(fs.readFileSync(regJsonPath, 'utf8'));
    regData.actualDir = `./sets/${sourceName}`;
    regData.expectedDir = `./sets/${targetName}`;
    fs.writeFileSync(regJsonPath, JSON.stringify(regData, null, 2), 'utf8');
  }

  // Rewrite index.html embedded paths
  const indexPath = path.join(outputDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    let html = fs.readFileSync(indexPath, 'utf8');
    html = html.replace(`"../sets/${sourceName}"`, `"./sets/${sourceName}"`);
    html = html.replace(`"../sets/${targetName}"`, `"./sets/${targetName}"`);
    fs.writeFileSync(indexPath, html, 'utf8');
  }

  console.log(`Aggregated screenshots into ${path.join(outputDir, 'sets')}`);
}
