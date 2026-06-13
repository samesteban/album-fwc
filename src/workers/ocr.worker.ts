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

// Downscale camera frames to this max dimension before Otsu thresholding.
// Smaller images process faster; the text-to-frame ratio stays good since
// we already crop to center 75% before sending.
const MAX_FRAME_DIMENSION = 640;

/**
 * Compute Otsu's threshold for a grayscale 8-bit image buffer.
 * Finds the intensity value that best separates foreground from background.
 * Returns a threshold value 0–255.
 */
function otsuThreshold(pixels: Uint8ClampedArray): number {
  const length = pixels.length;
  const totalPixels = length >> 2; // length / 4 (RGBA)
  const hist = new Uint32Array(256);

  // Build histogram from grayscale values (R=G=B after grayscale conversion)
  for (let i = 0; i < length; i += 4) {
    hist[pixels[i]]++;
  }

  let sum = 0;
  for (let i = 0; i < 256; i++) {
    sum += i * hist[i];
  }

  let sumB = 0;
  let wB = 0;
  let maxVariance = 0;
  let threshold = 0;

  for (let i = 0; i < 256; i++) {
    wB += hist[i];
    if (wB === 0) continue;

    const wF = totalPixels - wB;
    if (wF === 0) break;

    sumB += i * hist[i];
    const meanB = sumB / wB;
    const meanF = (sum - sumB) / wF;
    const variance = wB * wF * (meanB - meanF) * (meanB - meanF);

    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = i;
    }
  }

  return threshold;
}

/**
 * Initialize the Tesseract worker with English language data
 * and parameters optimized for short code recognition.
 */
async function initWorker(): Promise<void> {
  try {
    tesseractWorker = await createWorker('eng');

    await tesseractWorker.setParameters({
      // RAW_LINE: treat the image as a single raw text line, no layout
      // analysis at all. Ideal for pre-cropped sticker code zones.
      tessedit_pageseg_mode: '13',
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
 * Downscale a camera frame then apply Otsu binarization.
 *
 * Pipeline:
 *   1. Draw raw pixels onto a source OffscreenCanvas.
 *   2. Downscale onto a smaller canvas (bilinear interpolation).
 *   3. Read back pixels → weighted grayscale → Otsu threshold →
 *      put pure black/white pixels back.
 *   4. Export as PNG for Tesseract.
 *
 * Binarization eliminates colour noise and soft edges, leaving only
 * crisp text shapes. Otsu adapts the threshold automatically, handling
 * white-on-black AND black-on-white stickers without hardcoded values.
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

  // Pass 2: downscale (plain drawImage, no filter)
  const dstCanvas = new OffscreenCanvas(dstW, dstH);
  const dstCtx = dstCanvas.getContext('2d');
  if (!dstCtx) {
    throw new Error('Failed to get destination OffscreenCanvas 2D context');
  }
  dstCtx.drawImage(srcCanvas, 0, 0, srcW, srcH, 0, 0, dstW, dstH);

  // Pass 3: Otsu binarization
  const frame = dstCtx.getImageData(0, 0, dstW, dstH);
  const d = frame.data;

  // Convert to grayscale in-place (weighted luminance)
  for (let i = 0; i < d.length; i += 4) {
    const gray = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    d[i] = gray;
    d[i + 1] = gray;
    d[i + 2] = gray;
  }

  // Compute optimal threshold via Otsu
  const threshold = otsuThreshold(d);

  // Apply threshold — pure black (0) or pure white (255)
  for (let i = 0; i < d.length; i += 4) {
    const val = d[i] >= threshold ? 255 : 0;
    d[i] = val;
    d[i + 1] = val;
    d[i + 2] = val;
  }

  dstCtx.putImageData(frame, 0, 0);
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
