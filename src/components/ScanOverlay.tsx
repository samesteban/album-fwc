/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ScanOverlay — Slide-up results card showing the detected sticker code,
 * current status, and contextual action buttons.
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, Plus, ArrowRight } from 'lucide-react';
import type { ScanResult } from '../types';

interface ScanOverlayProps {
  result: ScanResult | null;
  isVisible: boolean;
  onPegar: () => void;
  onAgregarRepetida: () => void;
  onSiguiente: () => void;
}

export default function ScanOverlay({
  result,
  isVisible,
  onPegar,
  onAgregarRepetida,
  onSiguiente,
}: ScanOverlayProps) {
  const isMissing = result?.status === 'missing';

  return (
    <AnimatePresence>
      {isVisible && result && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 bg-slate-950/60 backdrop-blur-sm"
          />

          {/* Overlay card */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="absolute bottom-0 inset-x-0 z-30 bg-emerald-950/95 backdrop-blur-md border-t border-emerald-800 rounded-t-[2.5rem] shadow-2xl overflow-hidden"
          >
            {/* Drag handle */}
            <div className="w-12 h-1.5 bg-emerald-800/50 rounded-full mx-auto my-3" />

            <div className="px-6 pb-8 space-y-5">
              {/* Header */}
              <div className="text-center">
                <div className="inline-flex items-center gap-2 bg-emerald-900/80 border border-emerald-800 px-4 py-2 rounded-full mb-3">
                  <CheckCircle className={`w-4 h-4 ${isMissing ? 'text-emerald-400' : 'text-yellow-400'}`} />
                  <span className="text-[10px] font-black uppercase tracking-widest font-mono text-emerald-300">
                    Lámina Detectada
                  </span>
                </div>

                {/* Code badge — matches CardGrid style */}
                <div className="flex justify-center gap-2 items-baseline mt-2">
                  <span className="font-mono font-black text-2xl text-white bg-emerald-900/60 px-4 py-1.5 rounded-xl border border-emerald-700/50">
                    {result.sectionCode} {result.number}
                  </span>
                </div>
              </div>

              {/* Status */}
              <div className="text-center">
                <StatusBadge result={result} />
              </div>

              {/* Action buttons */}
              <div className="space-y-2.5">
                {isMissing ? (
                  <button
                    onClick={onPegar}
                    className="w-full bg-yellow-400 hover:bg-yellow-300 active:scale-[0.98] text-emerald-950 font-black text-sm py-3.5 rounded-xl shadow-[0_4px_15px_rgba(234,179,8,0.3)] transition-all flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5 stroke-[2.5]" />
                    Pegar
                  </button>
                ) : (
                  <button
                    onClick={onAgregarRepetida}
                    className="w-full bg-yellow-400 hover:bg-yellow-300 active:scale-[0.98] text-emerald-950 font-black text-sm py-3.5 rounded-xl shadow-[0_4px_15px_rgba(234,179,8,0.3)] transition-all flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5 stroke-[2.5]" />
                    Agregar Repetida
                  </button>
                )}

                <button
                  onClick={onSiguiente}
                  className="w-full bg-emerald-800 hover:bg-emerald-700 active:scale-[0.98] text-emerald-100 font-bold text-sm py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  Siguiente
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function StatusBadge({ result }: { result: ScanResult }) {
  const { status, count } = result;

  if (status === 'missing') {
    return (
      <span className="inline-block text-xs font-black uppercase tracking-wider font-mono bg-red-500/10 border border-red-500/20 text-red-400 px-3 py-1 rounded-full">
        Faltante
      </span>
    );
  }

  if (status === 'pasted') {
    return (
      <span className="inline-block text-xs font-black uppercase tracking-wider font-mono bg-emerald-400/10 border border-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full">
        Pegada
      </span>
    );
  }

  return (
    <span className="inline-block text-xs font-black uppercase tracking-wider font-mono bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 px-3 py-1 rounded-full">
      {count} Repetida{count > 1 ? 's' : ''}
    </span>
  );
}
