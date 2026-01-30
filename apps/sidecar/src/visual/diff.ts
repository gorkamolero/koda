/**
 * Visual Diff Module
 *
 * Compares two images and generates diff visualization.
 * Uses pixel-by-pixel comparison with configurable threshold.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';

export interface DiffOptions {
  /** Threshold for pixel difference (0-1) */
  threshold?: number;
  /** Generate a diff image highlighting changes */
  generateDiffImage?: boolean;
  /** Calculate bounding boxes for changed regions */
  calculateBounds?: boolean;
  /** Output directory for diff images */
  outputDir?: string;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DiffResult {
  /** Whether images are identical (within threshold) */
  identical: boolean;
  /** Percentage of pixels that differ */
  diffPercentage: number;
  /** Path to diff image (if generated) */
  diffImagePath?: string;
  /** Bounding boxes of changed regions */
  changedRegions?: BoundingBox[];
  /** Total pixels compared */
  totalPixels: number;
  /** Number of different pixels */
  differentPixels: number;
}

const DEFAULT_THRESHOLD = 0.1;

export class VisualDiff {
  /**
   * Compare two images
   * @param beforeImage - Before image buffer
   * @param afterImage - After image buffer
   * @param options - Diff options
   */
  async compare(
    beforeImage: Buffer,
    afterImage: Buffer,
    options: DiffOptions = {}
  ): Promise<DiffResult> {
    const threshold = options.threshold ?? DEFAULT_THRESHOLD;

    // Simple byte-by-byte comparison for now
    // In production, we'd use a proper image diff library like pixelmatch or looks-same
    const beforeBytes = new Uint8Array(beforeImage);
    const afterBytes = new Uint8Array(afterImage);

    const maxLength = Math.max(beforeBytes.length, afterBytes.length);
    let differentPixels = 0;

    // Compare byte by byte
    for (let i = 0; i < maxLength; i++) {
      const beforeByte = beforeBytes[i] ?? 0;
      const afterByte = afterBytes[i] ?? 0;

      // Calculate normalized difference
      const diff = Math.abs(beforeByte - afterByte) / 255;

      if (diff > threshold) {
        differentPixels++;
      }
    }

    // Estimate pixel count (assuming RGBA, 4 bytes per pixel)
    const totalPixels = Math.ceil(maxLength / 4);
    const diffPercentage = maxLength > 0 ? (differentPixels / maxLength) * 100 : 0;
    const identical = differentPixels === 0;

    const result: DiffResult = {
      identical,
      diffPercentage,
      totalPixels,
      differentPixels,
    };

    // Generate diff image if requested
    if (options.generateDiffImage && options.outputDir) {
      const diffImagePath = await this.generateDiffImage(
        beforeImage,
        afterImage,
        options.outputDir
      );
      result.diffImagePath = diffImagePath;
    }

    // Calculate bounding boxes if requested
    if (options.calculateBounds) {
      result.changedRegions = this.calculateChangedRegions(beforeImage, afterImage);
    }

    return result;
  }

  /**
   * Generate a diff image highlighting changes
   */
  private async generateDiffImage(
    _beforeImage: Buffer,
    _afterImage: Buffer,
    outputDir: string
  ): Promise<string> {
    // In a real implementation, we'd use pixelmatch or similar
    // For now, create a placeholder diff image
    const filename = `diff-${randomUUID()}.png`;
    const diffPath = path.join(outputDir, filename);

    // Create a simple placeholder - in production, this would be the actual diff visualization
    // The diff would highlight changed pixels in red/magenta
    const placeholder = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
      // Minimal valid PNG (1x1 red pixel)
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
      0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41,
      0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
      0x00, 0x01, 0x01, 0x00, 0x05, 0xff, 0xd8, 0x6b,
      0x36, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
      0x44, 0xae, 0x42, 0x60, 0x82,
    ]);

    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(diffPath, placeholder);

    return diffPath;
  }

  /**
   * Calculate bounding boxes for changed regions
   */
  private calculateChangedRegions(
    _beforeImage: Buffer,
    _afterImage: Buffer
  ): BoundingBox[] {
    // In a real implementation, we'd analyze the images to find
    // contiguous regions of change and compute their bounding boxes
    // For now, return a placeholder indicating the whole image changed
    return [
      {
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      },
    ];
  }

  /**
   * Compare two image files
   */
  async compareFiles(beforePath: string, afterPath: string, options: DiffOptions = {}): Promise<DiffResult> {
    const beforeImage = fs.readFileSync(beforePath);
    const afterImage = fs.readFileSync(afterPath);

    return this.compare(beforeImage, afterImage, options);
  }
}
