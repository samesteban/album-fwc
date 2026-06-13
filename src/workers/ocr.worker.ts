/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * OCR Web Worker — runs Tesseract.js in a dedicated thread.
 * Communicates with the main thread via postMessage.
 *
 * Data flow:
 *   Main thread captures ImageData synchronously (getImageData),
 *   transfers pixel buffer zero-copy to this worker.
 *   Worker draws ImageData onto an OffscreenCanvas, encodes as PNG,
 *   then passes the PNG Blob to Tesseract.js for recognition.
 *
 * Contract:
 *   Main → Worker: OcrRequest { type: 'scan', imageData: ImageData }
 *                 | { type: 'close' }
 *   Worker → Main: OcrResponse { type: 'ready' | 'result' | 'error' }
 */

import { createWorker, type Worker } from 'tesseract.js';

import type { OcrRequest, OcrResponse } from '../types';
import { parseOcrCode } from '../lib/scanner-regex';

let tesseractWorker: Worker | null = null;

// Downscale camera frames to this max dimension to speed up OCR
// and make text relatively larger in the processed image.
const MAX_FRAME_DIMENSION = 640;

/**
 * Initialize the Tesseract worker with English language data
 * and parameters optimized for short code recognition.
 */
async function initWorker(): Promise<void> {
  try {
    tesseractWorker = await createWorker('eng');

    // Apply parameters after creation — passing config to createWorker
    // only accepts InitOptions (dawg loading), not runtime params.
    await tesseractWorker.setParameters({
      // Treat the image as a single uniform block of text — avoids
      // costly page-layout analysis that's useless for sticker codes.
      tessedit_pageseg_mode: '6',
      // Restrict character set to uppercase letters, digits, and space
      // to prevent number/letter confusion (e.g. 5→S, 0→O, 1→I).
      tessedit_char_whitelist: ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    });

    self.postMessage({ type: 'ready' } satisfies OcrResponse);
  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : 'Failed to initialize OCR worker',
    } satisfies OcrResponse);
  }
}

/**
 * Convert transferred ImageData to a downscaled PNG Blob.
 *
 * Two-pass approach:
 *   1. Draw raw pixels onto an OffscreenCanvas at original resolution.
 *   2. Downscale via drawImage (with bilinear interpolation) onto a
 *      smaller canvas, then export as PNG.
 *
 * Downscaling makes text relatively larger, reduces noise, and
 * dramatically speeds up Tesseract processing on mobile.
 */
async function imageDataToBlob(imageData: ImageData): Promise<Blob> {
  let srcW = imageData.width;
  let srcH = imageData.height;

  // Pass 1: put raw pixels on a source canvas
  const srcCanvas = new OffscreenCanvas(srcW, srcH);
  const srcCtx = srcCanvas.getContext('2d');
  if (!srcCtx) {
    throw new Error('Failed to get OffscreenCanvas 2D context');
  }
  srcCtx.putImageData(imageData, 0, 0);

  // Calculate downscale dimensions
  let dstW = srcW;
  let dstH = srcH;
  if (srcW > MAX_FRAME_DIMENSION || srcH > MAX_FRAME_DIMENSION) {
    const scale = Math.min(MAX_FRAME_DIMENSION / srcW, MAX_FRAME_DIMENSION / srcH);
    dstW = Math.round(srcW * scale);
    dstH = Math.round(srcH * scale);
  }

  // Pass 2: downscale onto the destination canvas
  const dstCanvas = new OffscreenCanvas(dstW, dstH);
  const dstCtx = dstCanvas.getContext('2d');
  if (!dstCtx) {
    throw new Error('Failed to get destination OffscreenCanvas 2D context');
  }
  dstCtx.drawImage(srcCanvas, 0, 0, srcW, srcH, 0, 0, dstW, dstH);

  return dstCanvas.convertToBlob({ type: 'image/png' });
}

/**
 * Process a single frame: convert to PNG → OCR → regex extraction.
 */
async function processFrame(imageData: ImageData): Promise<void> {
  if (!tesseractWorker) {
    self.postMessage({
      type: 'error',
      message: 'Worker not initialized',
    } satisfies OcrResponse);
    return;
  }

  try {
    // Convert transferred pixel data to a proper PNG blob
    const blob = await imageDataToBlob(imageData);
    const { data } = await tesseractWorker.recognize(blob);
    const raw = data.text.trim();

    console.log('[OCR] raw:', JSON.stringify(raw), `confidence:${data.confidence}`);

    if (!raw) {
      self.postMessage({
        type: 'result',
        raw: null,
        match: null,
        sectionCode: null,
        number: null,
      } satisfies OcrResponse);
      return;
    }

    const parsed = parseOcrCode(raw);
    console.log('[OCR] parsed:', parsed);

    self.postMessage({
      type: 'result',
      raw,
      match: parsed ? `${parsed.sectionCode} ${parsed.number}` : null,
      sectionCode: parsed?.sectionCode ?? null,
      number: parsed?.number ?? null,
    } satisfies OcrResponse);
  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : 'OCR processing failed',
    } satisfies OcrResponse);
  }
}

// ── Message Handler ────────────────────────────────────────────

self.onmessage = async (event: MessageEvent<OcrRequest>) => {
  const msg = event.data;

  if (msg.type === 'close') {
    if (tesseractWorker) {
      await tesseractWorker.terminate();
      tesseractWorker = null;
    }
    self.close();
    return;
  }

  // type === 'scan'
  await processFrame(msg.imageData);
};

// ── Boot ───────────────────────────────────────────────────────

initWorker();
