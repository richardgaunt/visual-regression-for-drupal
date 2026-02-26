/**
 * URL-based screenshot module for visual regression testing
 */
import path from 'path';
import fs from 'fs';
import { Cluster } from 'puppeteer-cluster';

/**
 * Determine appropriate concurrency for screenshot capture.
 * @returns {number}
 */
export async function determineOptimalConcurrency() {
  const os = await import('os');
  const cpuCount = os.cpus().length;
  const totalMemoryGB = os.totalmem() / 1024 / 1024 / 1024;
  // Each Puppeteer instance can use ~100-200MB of memory - in GB.
  const estimatedMemoryPerProcess = 0.15;
  // Use the smaller of CPU-based or memory-based limits
  // Add a smaller cap to prevent overwhelming the system
  const memoryBasedLimit = Math.floor(totalMemoryGB / estimatedMemoryPerProcess);

  const maxConcurrency = Math.min(
    cpuCount * 16,
    memoryBasedLimit,
    100,
  );

  return Math.max(1, maxConcurrency);
}

/**
 * Capture screenshots for a list of URLs with different viewports
 *
 * @param {Object} options
 * @param {string} options.baseUrl - Base URL for the website
 * @param {Array<string>} options.paths - Paths to capture
 * @param {Array<Object>} options.viewports - Viewport configurations
 * @param {string} options.outputDir - Output directory for screenshots
 * @param {number} [options.concurrency] - Number of concurrent browser instances to use
 * @param {Array<{name: string, value: string}>} [options.cookies] - Session cookies for authenticated access
 * @param {{username: string, password: string}} [options.basicAuth] - Basic auth credentials
 * @returns {Promise<Object>} - Capture results
 */
export async function captureUrlScreenshots({
  baseUrl,
  paths,
  viewports,
  outputDir,
  concurrency,
  advancedOptions,
  cookies = [],
  basicAuth = null
}) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  if (!concurrency) {
    concurrency = await determineOptimalConcurrency();
  }

  console.log(`📸 Starting screenshot capture for ${baseUrl}`);
  console.log(`🛤️  Paths: ${paths.join(', ')}`);
  console.log(`📱 Viewports: ${viewports.map(v => v.name).join(', ')}`);
  console.log(`📁 Output directory: ${outputDir}`);
  console.log(`⚡ Concurrency: ${concurrency}`);

  try {
    const tasks = [];

    for (const viewport of viewports) {
      const viewportDir = path.join(outputDir, viewport.name.toLowerCase());
      if (!fs.existsSync(viewportDir)) {
        fs.mkdirSync(viewportDir, { recursive: true });
      }

      for (const urlPath of paths) {
        const url = new URL(urlPath, baseUrl).href;
        const sanitizedPath = urlPath === '/'
          ? 'homepage'
          : urlPath.replace(/^\//, '').replace(/\//g, '-');
        const outputPath = path.join(viewportDir, `${sanitizedPath}.png`);

        tasks.push({ url, viewport, outputPath, advancedOptions, cookies, basicAuth, baseUrl });
      }
    }

    // Create a unique cache directory for this run to share cache within the run
    // but maintain isolation between separate visual regression runs
    const os = await import('os');
    const runId = Date.now();
    const cacheDir = path.join(os.tmpdir(), `puppeteer-vr-cache-${runId}`);
    fs.mkdirSync(cacheDir, { recursive: true });

    const cluster = await Cluster.launch({
      // CONCURRENCY_PAGE shares browser context (and cache) across all pages
      concurrency: Cluster.CONCURRENCY_PAGE,
      maxConcurrency: concurrency,
      puppeteerOptions: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: 'new',
        userDataDir: cacheDir,
      },
      // Per-task timeout - kills stuck workers after 30 seconds
      timeout: 20000,
      retryLimit: 2,
      retryDelay: 1000,
      monitor: true,
      // Delay between launching workers to prevent system overload
      workerCreationDelay: 300,
    });

    // eslint-disable-next-line max-len
    await cluster.task(async ({ page, data: { url, viewport, outputPath, advancedOptions, cookies, basicAuth, baseUrl } }) => {
      console.log(`Capturing ${url} at ${viewport.name} (${viewport.windowWidth}x${viewport.windowHeight})`);

      await page.setViewport({
        width: viewport.windowWidth,
        height: viewport.windowHeight,
      });

      // Set basic auth if provided
      if (basicAuth) {
        await page.authenticate({
          username: basicAuth.username,
          password: basicAuth.password
        });
      }

      // Set session cookies if provided
      if (cookies && cookies.length > 0) {
        const parsedUrl = new URL(baseUrl);
        const puppeteerCookies = cookies.map(cookie => ({
          name: cookie.name,
          value: cookie.value,
          domain: parsedUrl.hostname,
          path: '/',
        }));
        await page.setCookie(...puppeteerCookies);
      }

      // NOTE: Changed from networkidle0 to networkidle2
      // networkidle0 waits for zero network connections. networkidle2 allows up to 2 active connections,
      // which causes issues with visual regression testing.
      await page.goto(url, {
        waitUntil: ['domcontentloaded', 'networkidle0'],
        timeout: 15000
      });

      // Wait for all fonts (including Google Fonts) to finish loading
      await page.evaluate(() => document.fonts.ready);

      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      if (advancedOptions.disable_css_transitions) {
        await page.evaluate(() => {
          const style = document.createElement('style');
          style.textContent = `
            *, *::before, *::after {
              transition: none !important;
              transition-duration: 0s !important;
            }
          `;
          document.head.appendChild(style);
        });
      }

      if (advancedOptions.hide_mask_selectors && advancedOptions.masking_selectors.length > 0) {
        await page.evaluate((cssSelectors) => {
          document.querySelectorAll(cssSelectors.join(', ')).forEach((el) => {
            el.style.visibility = 'hidden';
          });
        }, advancedOptions.masking_selectors);
      }

      if (advancedOptions.replace_images_with_solid_color) {
        await page.evaluate(() => {
          // Base64 encoded 1x1 pixel (PNG format)
          const pixelImageB64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
          // Replace all img src attributes
          const images = document.querySelectorAll('img');
          images.forEach((img) => {
            if (img.src && !img.src.startsWith('data:')) {
              img.src = pixelImageB64;
            }
          });

          // Replace background images in CSS
          const elementsWithBg = document.querySelectorAll('.ct-footer, .ct-banner__inner, .ct-background');
          elementsWithBg.forEach((el) => {
            const style = window.getComputedStyle(el);
            const bgImage = style.backgroundImage;
            if (bgImage && bgImage !== 'none' && !bgImage.includes('data:')) {
              el.style.backgroundImage = `url("${pixelImageB64}")`;
            }
          });
        });
      }

      // Small delay to ensure page has settled down
      const settleDelay = advancedOptions.settle_delay_ms || 0;
      if (settleDelay > 0) {
        await new Promise((resolve) => {
          setTimeout(() => {
            resolve();
          }, settleDelay);
        });
      }


      await page.screenshot({
        path: outputPath,
        fullPage: true,
      });

      return {
        url,
        viewport: viewport.name,
        outputPath
      };
    });

    for (const task of tasks) {
      cluster.queue(task);
    }

    await cluster.idle();
    await cluster.close();

    // Clean up the run-specific cache directory
    fs.rmSync(cacheDir, { recursive: true, force: true });

    console.log(`✅ Screenshot capture completed for ${baseUrl}`);
    return {
      baseUrl,
      paths,
      viewports: viewports.map(v => v.name),
      count: tasks.length,
      directory: outputDir
    };
  } catch (error) {
    console.error('Error capturing screenshots:', error);
    throw error;
  }
}
