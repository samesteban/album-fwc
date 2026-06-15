/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * useScanner — Camera lifecycle, frame capture loop with 1s setInterval,
 * and scanner state machine (idle → loading → scanning → frozen).
 *
 * Captures only a center viewfinder strip (60% width × 20% height) to
 * reduce processing overhead and focus Tesseract on the sticker code zone.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import type { RefObject } from 'react';
import type { ScannerStatus } from '../types';

interface UseScannerReturn {
  status: ScannerStatus;
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  freeze: () => void;
  resume: () => void;
}

const CAPTURE_INTERVAL_MS = 1000;

export function useScanner(
  onFrame: (imageData: ImageData) => void
): UseScannerReturn {
  const [status, setStatus] = useState<ScannerStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isActiveRef = useRef(false);

  // ── Canvas helpers ──────────────────────────────────────────

  const captureFrame = useCallback((): ImageData | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw the full video frame
    ctx.drawImage(video, 0, 0);

    // Crop to center viewfinder strip (60% width × 20% height).
    // This narrow horizontal strip focuses on the sticker code zone
    // and excludes background noise (shirts, posters, etc.), while
    // keeping the frame small for efficient OCR processing.
    const cropWidth = Math.round(canvas.width * 0.6);
    const cropHeight = Math.round(canvas.height * 0.2);
    const cropX = Math.round((canvas.width - cropWidth) / 2);
    const cropY = Math.round((canvas.height - cropHeight) / 2);

    return ctx.getImageData(cropX, cropY, cropWidth, cropHeight);
  }, []);

  // ── Capture tick ────────────────────────────────────────────

  const captureTick = useCallback(() => {
    if (!isActiveRef.current) return;

    const frame = captureFrame();
    if (frame) {
      onFrame(frame);
    }
  }, [captureFrame, onFrame]);

  // ── Camera control ──────────────────────────────────────────

  const start = useCallback(async () => {
    try {
      setStatus('loading');
      setError(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) {
        stop();
        return;
      }

      video.srcObject = stream;
      await video.play();

      isActiveRef.current = true;
      setStatus('scanning');
      intervalRef.current = setInterval(captureTick, CAPTURE_INTERVAL_MS);
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Permiso de cámara denegado. Habilítalo en la configuración del navegador.'
          : err instanceof DOMException && err.name === 'NotFoundError'
          ? 'No se encontró ninguna cámara en este dispositivo.'
          : err instanceof Error
          ? err.message
          : 'Error al iniciar la cámara';

      setError(message);
      setStatus('error');
    }
  }, [captureTick]);

  const stop = useCallback(() => {
    isActiveRef.current = false;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    const video = videoRef.current;
    if (video) {
      video.srcObject = null;
    }

    setStatus('idle');
  }, []);

  const freeze = useCallback(() => {
    isActiveRef.current = false;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    setStatus('frozen');
  }, []);

  const resume = useCallback(() => {
    if (!streamRef.current) {
      start();
      return;
    }

    isActiveRef.current = true;
    setStatus('scanning');
    intervalRef.current = setInterval(captureTick, CAPTURE_INTERVAL_MS);
  }, [captureTick, start]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    status,
    videoRef,
    canvasRef,
    error,
    start,
    stop,
    freeze,
    resume,
  };
}
