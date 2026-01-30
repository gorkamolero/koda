/**
 * Visual Diff Engine
 *
 * Exports for screenshot capture and visual diff comparison.
 */

export { ScreenshotCapture } from './capture.js';
export type { CaptureOptions, ScreenshotResult } from './capture.js';

export { VisualDiff } from './diff.js';
export type { DiffOptions, DiffResult, BoundingBox } from './diff.js';

export { VisualDiffService } from './service.js';
export type { ServiceOptions, CaptureStateParams, SnapshotRecord, TurnComparison } from './service.js';
