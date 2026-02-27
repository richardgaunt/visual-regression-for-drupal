/**
 * Test suite for aggregateScreenshots and comparison metadata
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { aggregateScreenshots } from '../src/lib/visual-regression/comparison.mjs';
import {
  writeComparisonMetadata,
  readComparisonMetadata,
  getAllComparisons
} from '../src/lib/visual-regression/snapshot-manager.mjs';

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

describe('comparison metadata', () => {
  let projectPath;

  beforeEach(() => {
    projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'vr-test-'));
  });

  afterEach(() => {
    fs.rmSync(projectPath, { recursive: true, force: true });
  });

  describe('writeComparisonMetadata', () => {
    it('should create a valid comparison.json', () => {
      const comparisonId = 'baseline--current';
      const comparisonDir = path.join(projectPath, 'screenshot-sets', 'comparisons', comparisonId);
      fs.mkdirSync(comparisonDir, { recursive: true });

      const metadata = {
        source: 'baseline',
        target: 'current',
        date: '2026-01-15T10:00:00.000Z',
        statistics: { total: 10, passed: 8, changed: 1, new: 1, deleted: 0 }
      };

      writeComparisonMetadata(projectPath, comparisonId, metadata);

      const jsonPath = path.join(comparisonDir, 'comparison.json');
      expect(fs.existsSync(jsonPath)).toBe(true);

      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      expect(data.id).toBe(comparisonId);
      expect(data.source).toBe('baseline');
      expect(data.target).toBe('current');
      expect(data.directory).toBe('screenshot-sets/comparisons/baseline--current');
      expect(data.date).toBe('2026-01-15T10:00:00.000Z');
      expect(data.statistics.total).toBe(10);
    });
  });

  describe('readComparisonMetadata', () => {
    it('should read comparison.json back', () => {
      const comparisonId = 'before--after';
      const comparisonDir = path.join(projectPath, 'screenshot-sets', 'comparisons', comparisonId);
      fs.mkdirSync(comparisonDir, { recursive: true });

      const metadata = {
        source: 'before',
        target: 'after',
        date: '2026-02-01T12:00:00.000Z',
        statistics: { total: 5, passed: 5, changed: 0, new: 0, deleted: 0 }
      };
      writeComparisonMetadata(projectPath, comparisonId, metadata);

      const result = readComparisonMetadata(projectPath, comparisonId);
      expect(result).not.toBeNull();
      expect(result.id).toBe(comparisonId);
      expect(result.source).toBe('before');
      expect(result.target).toBe('after');
    });

    it('should return null for missing comparison', () => {
      const result = readComparisonMetadata(projectPath, 'nonexistent--id');
      expect(result).toBeNull();
    });
  });

  describe('getAllComparisons', () => {
    it('should discover multiple comparison directories', () => {
      const ids = ['a--b', 'c--d', 'e--f'];
      for (const id of ids) {
        const dir = path.join(projectPath, 'screenshot-sets', 'comparisons', id);
        fs.mkdirSync(dir, { recursive: true });
        writeComparisonMetadata(projectPath, id, {
          source: id.split('--')[0],
          target: id.split('--')[1],
          date: new Date().toISOString(),
          statistics: { total: 1, passed: 1, changed: 0, new: 0, deleted: 0 }
        });
      }

      const comparisons = getAllComparisons(projectPath);
      expect(Object.keys(comparisons)).toHaveLength(3);
      expect(comparisons['a--b']).toBeDefined();
      expect(comparisons['c--d']).toBeDefined();
      expect(comparisons['e--f']).toBeDefined();
    });

    it('should return empty object when no comparisons exist', () => {
      const comparisons = getAllComparisons(projectPath);
      expect(comparisons).toEqual({});
    });

    it('should skip directories without comparison.json', () => {
      const dir = path.join(projectPath, 'screenshot-sets', 'comparisons', 'orphan--dir');
      fs.mkdirSync(dir, { recursive: true });

      const comparisons = getAllComparisons(projectPath);
      expect(Object.keys(comparisons)).toHaveLength(0);
    });
  });
});
