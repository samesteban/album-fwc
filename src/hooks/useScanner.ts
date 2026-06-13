/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * useScanner — Camera lifecycle, frame capture loop with 500ms throttle,
 * and scanner state machine (idle → loading → scanning → frozen).
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
  freeze: () => ImageData | null;
  resume: () => void;
}

const CAPTURE_INTERVAL_MS = 500;

export function useScanner(
  onFrame: (imageData: ImageData) => void
): UseScannerReturn {
  const [status, setStatus] = useState<ScannerStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastCaptureRef = useRef<number>(0);
  const isActiveRef = useRef(false);

  // ── Canvas helpers ──────────────────────────────────────────

  const captureFrame = useCallback((): ImageData | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Match canvas to video dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }, []);

  // ── Frame loop ──────────────────────────────────────────────

  const frameLoop = useCallback(
    (timestamp: number) => {
      if (!isActiveRef.current) return;

      if (timestamp - lastCaptureRef.current >= CAPTURE_INTERVAL_MS) {
        lastCaptureRef.current = timestamp;
        const frame = captureFrame();
        if (frame) {
          onFrame(frame);
        }
      }

      animFrameRef.current = requestAnimationFrame(frameLoop);
    },
    [captureFrame, onFrame]
  );

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
      lastCaptureRef.current = performance.now();
      setStatus('scanning');
      animFrameRef.current = requestAnimationFrame(frameLoop);
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
  }, [frameLoop]);

  const stop = useCallback(() => {
    isActiveRef.current = false;

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
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

  const freeze = useCallback((): ImageData | null => {
    isActiveRef.current = false;

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    setStatus('frozen');

    // Capture one last frame for the frozen display
    return captureFrame();
  }, [captureFrame]);

  const resume = useCallback(() => {
    if (!streamRef.current) {
      start();
      return;
    }

    isActiveRef.current = true;
    lastCaptureRef.current = performance.now();
    setStatus('scanning');
    animFrameRef.current = requestAnimationFrame(frameLoop);
  }, [frameLoop, start]);

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
