/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Viewfinder — Centered camera frame overlay with see-through window.
 * Uses a massive box-shadow to create the dim overlay around the clear center area.
 * Border color changes based on scanner state for immediate feedback.
 */

import React from 'react';

export type ViewfinderState =
  | 'loading'
  | 'scanning'
  | 'match-missing'
  | 'match-existing'
  | 'error';

interface ViewfinderProps {
  state: ViewfinderState;
}

const GLOW_MAP: Record<ViewfinderState, string> = {
  loading: 'border-emerald-800/50',
  scanning: 'border-emerald-400/50',
  'match-missing': 'border-emerald-400',
  'match-existing': 'border-yellow-400',
  error: 'border-red-400',
};

const LABEL_MAP: Record<ViewfinderState, string> = {
  loading: 'Iniciando...',
  scanning: 'Enfoca el código',
  'match-missing': '¡Faltante!',
  'match-existing': '¡Registrada!',
  error: 'Error',
};

const LABEL_COLOR_MAP: Record<ViewfinderState, string> = {
  loading: 'text-emerald-400',
  scanning: 'text-emerald-300',
  'match-missing': 'text-emerald-400',
  'match-existing': 'text-yellow-400',
  error: 'text-red-400',
};

export default function Viewfinder({ state }: ViewfinderProps) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
      {/* Viewfinder window — the box-shadow creates the dim overlay */}
      <div
        className={`
          relative w-[75%] aspect-[4/3] rounded-3xl border-[3px] bg-transparent
          transition-all duration-300 ease-out
          ${GLOW_MAP[state]}
        `}
        style={{
          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.45)',
        }}
      >
        {/* Corner brackets */}
        <div className="absolute -top-[2px] -left-[2px] w-8 h-8 border-t-[3px] border-l-[3px] border-yellow-400/80 rounded-tl-2xl" />
        <div className="absolute -top-[2px] -right-[2px] w-8 h-8 border-t-[3px] border-r-[3px] border-yellow-400/80 rounded-tr-2xl" />
        <div className="absolute -bottom-[2px] -left-[2px] w-8 h-8 border-b-[3px] border-l-[3px] border-yellow-400/80 rounded-bl-2xl" />
        <div className="absolute -bottom-[2px] -right-[2px] w-8 h-8 border-b-[3px] border-r-[3px] border-yellow-400/80 rounded-br-2xl" />
      </div>

      {/* Label below the viewfinder */}
      <div className="absolute bottom-[calc(50%-37.5%*0.75-48px)] left-1/2 -translate-x-1/2">
        <span className={`
          text-[10px] font-black uppercase tracking-widest font-mono
          transition-colors duration-300
          ${LABEL_COLOR_MAP[state]}
        `}>
          {LABEL_MAP[state]}
        </span>
      </div>
    </div>
  );
}
