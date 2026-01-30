/**
 * Screenshot Capture Module
 *
 * Uses Playwright to capture screenshots of web pages.
 * Supports full page and element-specific captures.
 */

import { chromium, Browser } from 'playwright';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';

export interface CaptureOptions {
  /** Directory to store screenshots */
  outputDir: string;
  /** Viewport dimensions */
  viewport?: { width: number; height: number };
  /** Browser launch options */
  headless?: boolean;
  /** Wait for network idle before capture */
  waitForNetworkIdle?: boolean;
}

export interface ScreenshotResult {
  /** Full path to the screenshot file */
  imagePath: string;
  /** URL that was captured */
  url: string;
  /** CSS selector if element-specific */
  selector?: string;
  /** Viewport dimensions used */
  viewport: { width: number; height: number };
  /** Timestamp of capture */
  timestamp: string;
  /** Raw image data buffer */
  imageData: Buffer;
}

const DEFAULT_VIEWPORT = { width: 1280, height: 720 };

export class ScreenshotCapture {
  private options: Required<CaptureOptions>;
  private browser: Browser | null = null;

  constructor(options: CaptureOptions) {
    this.options = {
      outputDir: options.outputDir,
      viewport: options.viewport ?? DEFAULT_VIEWPORT,
      headless: options.headless ?? true,
      waitForNetworkIdle: options.waitForNetworkIdle ?? true,
    };

    // Ensure output directory exists
    fs.mkdirSync(this.options.outputDir, { recursive: true });
  }

  /**
   * Get or create browser instance
   */
  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: this.options.headless,
      });
    }
    return this.browser;
  }

  /**
   * Capture a screenshot of a URL
   * @param url - The URL to capture
   * @param selector - Optional CSS selector for element-specific capture
   */
  async captureScreenshot(url: string, selector?: string): Promise<ScreenshotResult> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      // Set viewport
      await page.setViewportSize(this.options.viewport);

      // Navigate to URL
      const waitUntil = this.options.waitForNetworkIdle ? 'networkidle' : 'load';
      await page.goto(url, { waitUntil });

      // Generate unique filename
      const filename = `${randomUUID()}.png`;
      const imagePath = path.join(this.options.outputDir, filename);

      let imageData: Buffer;

      if (selector) {
        // Element-specific screenshot
        const element = page.locator(selector);
        imageData = await element.screenshot();
      } else {
        // Full page screenshot
        imageData = await page.screenshot({ fullPage: true });
      }

      // Write to file
      fs.writeFileSync(imagePath, imageData);

      return {
        imagePath,
        url,
        selector,
        viewport: this.options.viewport,
        timestamp: new Date().toISOString(),
        imageData,
      };
    } finally {
      await page.close();
    }
  }

  /**
   * Close the browser instance
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
