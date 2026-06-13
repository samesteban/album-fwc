/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * useOcrWorker — Web Worker lifecycle and message passing for Tesseract.js OCR.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import type { OcrResponse, OcrResultResponse } from '../types';

interface UseOcrWorkerReturn {
  isReady: boolean;
  error: string | null;
  scan: (imageData: ImageData) => void;
  lastResult: OcrResultResponse | null;
}

export function useOcrWorker(): UseOcrWorkerReturn {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<OcrResultResponse | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const worker = new Worker(
      new URL('../workers/ocr.worker.ts', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = (event: MessageEvent<OcrResponse>) => {
      const { type } = event.data;

      if (type === 'ready') {
        setIsReady(true);
        setError(null);
        return;
      }

      if (type === 'error') {
        setError(event.data.message);
        return;
      }

      if (type === 'result') {
        setLastResult(event.data);
      }
    };

    worker.onerror = (err) => {
      setError(err.message || 'Worker error');
    };

    workerRef.current = worker;

    return () => {
      worker.postMessage({ type: 'close' });
      worker.terminate();
      workerRef.current = null;
      setIsReady(false);
    };
  }, []);

  const scan = useCallback((imageData: ImageData) => {
    if (!workerRef.current) return;
    workerRef.current.postMessage({ type: 'scan', imageData }, [imageData.data.buffer]);
  }, []);

  return { isReady, error, scan, lastResult };
}
