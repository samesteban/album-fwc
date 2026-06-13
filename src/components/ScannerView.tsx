/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ScannerView — Full-screen camera scanner that orchestrates the Web Worker OCR,
 * frame capture loop, and result overlay with action buttons.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, CameraOff, Loader2 } from 'lucide-react';
import Viewfinder from './Viewfinder';
import ScanOverlay from './ScanOverlay';
import { useScanner } from '../hooks/useScanner';
import { useOcrWorker } from '../hooks/useOcrWorker';
import { resolveCardStatus } from '../lib/scanner-state';
import type { ScanResult } from '../types';
import type { ViewfinderState } from './Viewfinder';

interface ScannerViewProps {
  onCardUpdate: (cardId: string, delta: number) => void;
}

export default function ScannerView({ onCardUpdate }: ScannerViewProps) {
  const { isReady: workerReady, error: workerError, scan: sendFrame, lastResult, clearLastResult } = useOcrWorker();
  const [viewfinderState, setViewfinderState] = useState<ViewfinderState>('loading');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const [successFlash, setSuccessFlash] = useState(false);
  const pendingScanRef = useRef(false);
  const isStartingRef = useRef(false);

  // ── Callback: each captured frame is sent to the OCR worker ──

  const handleFrame = useCallback(
    (imageData: ImageData) => {
      // Don't send if we're already waiting for a result or if frozen
      if (pendingScanRef.current) return;
      pendingScanRef.current = true;
      sendFrame(imageData);
    },
    [sendFrame]
  );

  const scanner = useScanner(handleFrame);

  // ── Auto-start when worker is ready ─────────────────────────

  useEffect(() => {
    if (workerReady && scanner.status === 'idle' && !isStartingRef.current) {
      isStartingRef.current = true;
      setViewfinderState('loading');
      scanner.start();
    }
  }, [workerReady, scanner.status, scanner]);

  // ── Track scanner status → viewfinder state ─────────────────

  useEffect(() => {
    if (scanner.status === 'loading') {
      setViewfinderState('loading');
    } else if (scanner.status === 'scanning' && !showOverlay) {
      setViewfinderState('scanning');
    } else if (scanner.status === 'error') {
      setViewfinderState('error');
    }
  }, [scanner.status, showOverlay]);

  // ── Process OCR results ─────────────────────────────────────

  useEffect(() => {
    if (!lastResult) return;
    pendingScanRef.current = false;

    console.log('[Scanner] result received:', lastResult);

    // Only process while actively scanning
    if (scanner.status !== 'scanning') return;

    const { match } = lastResult;
    if (!match) return; // No valid code detected — keep scanning

    // Resolve the detected code against localStorage
    const result = resolveCardStatus(match);
    if (!result) return; // Invalid section/number

    // Valid match — freeze camera and show overlay
    scanner.freeze();
    setScanResult(result);

    if (result.status === 'missing') {
      setViewfinderState('match-missing');
    } else {
      setViewfinderState('match-existing');
    }

    // Small delay before showing overlay so user sees the color change
    setTimeout(() => setShowOverlay(true), 400);
  }, [lastResult, scanner]);

  // ── Worker error handling ──────────────────────────────────

  useEffect(() => {
    if (workerError) {
      setViewfinderState('error');
    }
  }, [workerError]);

  // ── Camera error from getUserMedia ──────────────────────────

  useEffect(() => {
    if (scanner.error) {
      setViewfinderState('error');
    }
  }, [scanner.error]);

  // ── Actions ────────────────────────────────────────────────

  const handlePegar = useCallback(() => {
    if (!scanResult) return;

    // Use the centralized state management from App.tsx
    onCardUpdate(scanResult.cardId, 1);

    // Update local scan result state with incremented count
    const newCount = scanResult.count + 1;
    setScanResult((prev) =>
      prev
        ? {
            ...prev,
            count: newCount,
            status: newCount === 1 ? 'pasted' : 'repeated',
          }
        : null
    );

    // Brief flash feedback
    setSuccessFlash(true);
    setTimeout(() => setSuccessFlash(false), 600);
  }, [scanResult, onCardUpdate]);

  const handleAgregarRepetida = useCallback(() => {
    // Same as Pegar but for when card already exists
    handlePegar();
  }, [handlePegar]);

  const handleSiguiente = useCallback(() => {
    setShowOverlay(false);
    setScanResult(null);
    clearLastResult();
    setViewfinderState('scanning');
    scanner.resume();
  }, [scanner, clearLastResult]);

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="relative w-full h-full min-h-[calc(100vh-8rem)] bg-black overflow-hidden rounded-3xl">
      {/* Video feed */}
      <video
        ref={scanner.videoRef}
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Hidden canvas for frame capture */}
      <canvas ref={scanner.canvasRef} className="hidden" />

      {/* Viewfinder overlay */}
      <Viewfinder state={viewfinderState} />

      {/* Success flash overlay */}
      {successFlash && (
        <div className="absolute inset-0 z-15 bg-emerald-400/20 pointer-events-none transition-opacity duration-300" />
      )}

      {/* Error state — full replacement UI */}
      {scanner.status === 'error' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-emerald-950/95 p-6">
          <div className="bg-red-500/10 border border-red-500/20 rounded-3xl p-6 text-center max-w-xs space-y-3">
            <CameraOff className="w-10 h-10 text-red-400 mx-auto" />
            <p className="text-sm font-bold text-red-300">
              {scanner.error || workerError || 'Error de cámara'}
            </p>
            <button
              onClick={() => {
                setViewfinderState('loading');
                scanner.start();
              }}
              className="bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-colors"
            >
              Reintentar
            </button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {scanner.status === 'loading' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-emerald-950/80">
          <Loader2 className="w-8 h-8 text-yellow-400 animate-spin mb-3" />
          <p className="text-xs font-black text-emerald-300 uppercase tracking-widest font-mono">
            Iniciando cámara...
          </p>
        </div>
      )}

      {/* Worker loading overlay */}
      {!workerReady && scanner.status === 'idle' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-emerald-950">
          <Loader2 className="w-8 h-8 text-yellow-400 animate-spin mb-3" />
          <p className="text-xs font-black text-emerald-300 uppercase tracking-widest font-mono">
            Cargando OCR...
          </p>
        </div>
      )}

      {/* Bottom camera controls */}
      {scanner.status === 'scanning' && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
          <button
            onClick={() => scanner.stop()}
            className="flex items-center gap-2 bg-emerald-900/80 backdrop-blur-sm border border-emerald-800 hover:bg-emerald-800 text-emerald-200 text-[10px] font-bold px-4 py-2.5 rounded-full transition-colors"
          >
            <CameraOff className="w-3.5 h-3.5" />
            Apagar Cámara
          </button>
        </div>
      )}

      {/* Scan result overlay */}
      <ScanOverlay
        result={scanResult}
        isVisible={showOverlay}
        onPegar={handlePegar}
        onAgregarRepetida={handleAgregarRepetida}
        onSiguiente={handleSiguiente}
      />
    </div>
  );
}
