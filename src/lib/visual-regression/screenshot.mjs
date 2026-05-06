/**
 * URL-based screenshot module for visual regression testing
 */
import path from 'path';
import fs from 'fs';
import { Cluster } from 'puppeteer-cluster';

// Hosts whose requests never affect rendering but routinely keep the network
// "busy" (preventing networkidle0). Blocking them lets the page actually settle
// under load. Match by hostname suffix.
const BLOCKED_THIRD_PARTY_HOSTS = [
  'google-analytics.com',
  'googletagmanager.com',
  'doubleclick.net',
  'googleadservices.com',
  'youtube.com',
  'youtu.be',
  'ytimg.com',
  'facebook.com',
  'facebook.net',
  'connect.facebook.net',
  'twitter.com',
  'x.com',
  'hotjar.com',
  'fullstory.com',
  'segment.io',
  'segment.com',
];

function isBlockedHost(hostname) {
  return BLOCKED_THIRD_PARTY_HOSTS.some((suffix) =>
    hostname === suffix || hostname.endsWith(`.${suffix}`)
  );
}

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
  if (basicAuth) {
    console.log(`Basic Auth: ${basicAuth.username} and ${basicAuth.password}`);
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
      // monitor: true clears the terminal every 500ms and hides per-task error logs.
      monitor: false,
      // Delay between launching workers to prevent system overload
      workerCreationDelay: 300,
    });

    const failures = [];
    cluster.on('taskerror', (err, data, willRetry) => {
      if (willRetry) return;
      const url = data && data.url;
      const viewportName = data && data.viewport && data.viewport.name;
      failures.push({ url, viewport: viewportName, error: err.message });
      console.error(`✗ ${url} @ ${viewportName}: ${err.message}`);
    });

    // eslint-disable-next-line max-len
    await cluster.task(async ({ page, data: { url, viewport, outputPath, advancedOptions, cookies, basicAuth, baseUrl } }) => {
      console.log(`Capturing ${url} at ${viewport.name} (${viewport.windowWidth}x${viewport.windowHeight})`);

      await page.setViewport({
        width: viewport.windowWidth,
        height: viewport.windowHeight,
      });

      // Set basic auth if provided.
      // Use an explicit Authorization header rather than page.authenticate(): when many pages
      // share one browser context (Cluster.CONCURRENCY_PAGE), the credential-handler
      // registration races with the auth challenge and Chromium aborts requests with
      // net::ERR_INVALID_AUTH_CREDENTIALS. A pre-set header sidesteps the prompt entirely.
      const authHeader = (basicAuth && basicAuth.username)
        ? `Basic ${Buffer.from(`${basicAuth.username}:${basicAuth.password ?? ''}`).toString('base64')}`
        : null;
      if (authHeader) {
        await page.setExtraHTTPHeaders({ Authorization: authHeader });
      }

      // Block third-party trackers that prevent networkidle0 from firing.
      // Inject the Authorization header on every continued request: with request
      // interception enabled, headers set via setExtraHTTPHeaders can be dropped on
      // intercepted requests, which causes intermittent ERR_INVALID_AUTH_CREDENTIALS.
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        try {
          const host = new URL(req.url()).hostname;
          if (isBlockedHost(host)) {
            req.abort();
            return;
          }
          if (authHeader) {
            req.continue({ headers: { ...req.headers(), Authorization: authHeader } });
          } else {
            req.continue();
          }
        } catch {
          req.continue();
        }
      });

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
      // If networkidle0 times out we still want a screenshot — the page is normally rendered, the
      // timeout just means a long-tail subresource never finished. We log and continue, relying on
      // the settle delay + document.fonts.ready below to capture a stable image.
      let mainResponseStatus = null;
      const captureMainResponse = (resp) => {
        if (resp.url() === url && resp.request().resourceType() === 'document') {
          mainResponseStatus = resp.status();
        }
      };
      page.on('response', captureMainResponse);
      try {
        await page.goto(url, {
          waitUntil: ['domcontentloaded', 'networkidle0'],
          timeout: 15000
        });
      } catch (err) {
        if (err.name === 'TimeoutError' && mainResponseStatus && mainResponseStatus < 400) {
          console.warn(`⚠ ${url} @ ${viewport.name}: networkidle0 timed out (doc=${mainResponseStatus}); capturing anyway`);
        } else {
          throw err;
        }
      } finally {
        page.off('response', captureMainResponse);
      }

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

      if (!fs.existsSync(outputPath)) {
        throw new Error(`Screenshot file was not written to ${outputPath}`);
      }

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

    const successCount = tasks.length - failures.length;
    if (failures.length > 0) {
      console.log(`⚠️  Screenshot capture finished: ${successCount}/${tasks.length} succeeded, ${failures.length} failed.`);
      console.log('Failed captures:');
      for (const f of failures.slice(0, 10)) {
        console.log(`  - ${f.url} @ ${f.viewport}: ${f.error}`);
      }
      if (failures.length > 10) {
        console.log(`  …and ${failures.length - 10} more.`);
      }
    } else {
      console.log(`✅ Screenshot capture completed for ${baseUrl} (${successCount}/${tasks.length}).`);
    }
    return {
      baseUrl,
      paths,
      viewports: viewports.map(v => v.name),
      count: successCount,
      attempted: tasks.length,
      failures,
      directory: outputDir
    };
  } catch (error) {
    console.error('Error capturing screenshots:', error);
    throw error;
  }
}
