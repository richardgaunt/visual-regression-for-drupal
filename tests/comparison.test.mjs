/**
 * Test suite for aggregateScreenshots
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { aggregateScreenshots } from '../src/lib/visual-regression/comparison.mjs';

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'vr-test-'));
}

describe('aggregateScreenshots', () => {
  let tmpDir, sourceDir, targetDir, outputDir;

  beforeEach(() => {
    tmpDir = createTempDir();

    // Create source and target screenshot dirs with dummy images
    sourceDir = path.join(tmpDir, 'sets', 'baseline');
    targetDir = path.join(tmpDir, 'sets', 'current');
    outputDir = path.join(tmpDir, 'comparisons', 'baseline--current');

    fs.mkdirSync(sourceDir, { recursive: true });
    fs.mkdirSync(targetDir, { recursive: true });
    fs.mkdirSync(outputDir, { recursive: true });

    fs.writeFileSync(path.join(sourceDir, 'home.png'), 'source-img');
    fs.writeFileSync(path.join(targetDir, 'home.png'), 'target-img');

    // Create a synthetic reg.json
    const regJson = {
      actualDir: '../sets/baseline',
      expectedDir: '../sets/current',
      diffDir: './diff',
      failedItems: [],
      newItems: [],
      deletedItems: [],
      passedItems: ['home.png']
    };
    fs.writeFileSync(
      path.join(outputDir, 'reg.json'),
      JSON.stringify(regJson),
      'utf8'
    );

    // Create a synthetic index.html with embedded paths
    const html = `<!DOCTYPE html><html><head></head><body>
<script>window['__reg__'] = {"actualDir":"../sets/baseline","expectedDir":"../sets/current"};</script>
</body></html>`;
    fs.writeFileSync(path.join(outputDir, 'index.html'), html, 'utf8');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should copy screenshot sets into the output directory', () => {
    aggregateScreenshots(sourceDir, targetDir, outputDir);

    expect(fs.existsSync(path.join(outputDir, 'sets', 'baseline', 'home.png'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'sets', 'current', 'home.png'))).toBe(true);

    // Verify file contents match
    expect(fs.readFileSync(path.join(outputDir, 'sets', 'baseline', 'home.png'), 'utf8')).toBe('source-img');
    expect(fs.readFileSync(path.join(outputDir, 'sets', 'current', 'home.png'), 'utf8')).toBe('target-img');
  });

  it('should rewrite paths in reg.json', () => {
    aggregateScreenshots(sourceDir, targetDir, outputDir);

    const regData = JSON.parse(fs.readFileSync(path.join(outputDir, 'reg.json'), 'utf8'));
    expect(regData.actualDir).toBe('./sets/baseline');
    expect(regData.expectedDir).toBe('./sets/current');
  });

  it('should rewrite paths in index.html', () => {
    aggregateScreenshots(sourceDir, targetDir, outputDir);

    const html = fs.readFileSync(path.join(outputDir, 'index.html'), 'utf8');
    expect(html).toContain('"./sets/baseline"');
    expect(html).toContain('"./sets/current"');
    expect(html).not.toContain('"../sets/baseline"');
    expect(html).not.toContain('"../sets/current"');
  });
});
