/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * OCR Web Worker — runs Tesseract.js in a dedicated thread.
 * Communicates with the main thread via postMessage.
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

/**
 * Initialize the Tesseract worker with English language data.
 */
async function initWorker(): Promise<void> {
  try {
    tesseractWorker = await createWorker('eng');
    self.postMessage({ type: 'ready' } satisfies OcrResponse);
  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : 'Failed to initialize OCR worker',
    } satisfies OcrResponse);
  }
}

/**
 * Process a single frame: OCR + regex extraction.
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
    const { data } = await tesseractWorker.recognize(imageData);
    const raw = data.text.trim();

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
