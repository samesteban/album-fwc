/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useMemo } from 'react';
import { ArrowLeft, Loader2, AlertCircle, HelpCircle, CheckCircle, Trophy } from 'lucide-react';
import {
  buildInitialSections,
  calculateStats,
  getTopRepeatedCards,
} from '../data';
import type { AlbumPageState, CollectionState } from '../types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface AlbumPageProps {
  shareId: string;
}

interface ShareData {
  name: string | null;
  collectionState: CollectionState;
  createdAt: string;
}

function isValidShareData(raw: unknown): raw is ShareData {
  if (!raw || typeof raw !== 'object') return false;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.collectionState !== 'object' || obj.collectionState === null) return false;
  return true;
}

export default function AlbumPage({ shareId }: AlbumPageProps) {
  const [pageState, setPageState] = useState<AlbumPageState>('loading');
  const [shareData, setShareData] = useState<ShareData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sections = useMemo(() => buildInitialSections(), []);

  useEffect(() => {
    let cancelled = false;

    async function fetchShare() {
      setPageState('loading');

      try {
        const url = `${SUPABASE_URL}/storage/v1/object/public/album-shares/public/${shareId}.json`;
        const response = await fetch(url);

        if (!response.ok) {
          if (response.status === 404) {
            if (!cancelled) setPageState('not-found');
          } else {
            if (!cancelled) {
              setPageState('error');
              setError(`Error al cargar (${response.status})`);
            }
          }
          return;
        }

        const raw = await response.json();

        if (!isValidShareData(raw)) {
          if (!cancelled) setPageState('not-found');
          return;
        }

        if (!cancelled) {
          setShareData(raw);
          setPageState('loaded');
        }
      } catch (err) {
        console.error('Error al cargar álbum compartido:', err);
        if (!cancelled) {
          setPageState('error');
          setError('No se pudo conectar al servidor.');
        }
      }
    }

    fetchShare();

    return () => {
      cancelled = true;
    };
  }, [shareId]);

  const stats = useMemo(() => {
    if (!shareData) return null;
    return calculateStats(sections, shareData.collectionState);
  }, [sections, shareData]);

  const topRepeated = useMemo(() => {
    if (!shareData) return [];
    return getTopRepeatedCards(sections, shareData.collectionState, 10);
  }, [sections, shareData]);

  // ── Loading State ──────────────────────────────────────────

  if (pageState === 'loading') {
    return (
      <div className="bg-emerald-950 min-h-screen text-slate-100 flex flex-col font-sans antialiased">
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
          <div className="w-16 h-16 bg-yellow-400/10 rounded-full flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-yellow-400 animate-spin" />
          </div>
          <p className="text-sm font-bold text-emerald-300 animate-pulse">
            Cargando álbum...
          </p>
        </div>
      </div>
    );
  }

  // ── Not Found State ─────────────────────────────────────────

  if (pageState === 'not-found') {
    return (
      <div className="bg-emerald-950 min-h-screen text-slate-100 flex flex-col font-sans antialiased">
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
          <div className="w-20 h-20 bg-emerald-900 border-2 border-emerald-800 rounded-full flex items-center justify-center">
            <HelpCircle className="w-10 h-10 text-emerald-500" />
          </div>
          <h1 className="text-xl font-black text-white">Álbum no encontrado</h1>
          <p className="text-sm text-emerald-300 text-center max-w-xs leading-relaxed">
            El enlace que intentás abrir no existe o fue eliminado.
            Revisá que la URL sea correcta.
          </p>
          <a
            href="/"
            className="mt-2 inline-flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-emerald-950 font-black px-6 py-3 rounded-2xl text-sm uppercase tracking-wider transition-all shadow-lg"
          >
            <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
            Volver al inicio
          </a>
        </div>
      </div>
    );
  }

  // ── Error State ─────────────────────────────────────────────

  if (pageState === 'error') {
    return (
      <div className="bg-emerald-950 min-h-screen text-slate-100 flex flex-col font-sans antialiased">
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
          <div className="w-20 h-20 bg-red-900/30 border-2 border-red-800/50 rounded-full flex items-center justify-center">
            <AlertCircle className="w-10 h-10 text-red-400" />
          </div>
          <h1 className="text-xl font-black text-white">Error al cargar</h1>
          <p className="text-sm text-emerald-300 text-center max-w-xs leading-relaxed">
            {error || 'Ocurrió un error inesperado. Intentá de nuevo más tarde.'}
          </p>
          <a
            href="/"
            className="mt-2 inline-flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-emerald-950 font-black px-6 py-3 rounded-2xl text-sm uppercase tracking-wider transition-all shadow-lg"
          >
            <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
            Volver al inicio
          </a>
        </div>
      </div>
    );
  }

  // ── Loaded State ────────────────────────────────────────────

  if (!shareData || !stats) return null;

  const hasCollection = Object.keys(shareData.collectionState).length > 0;

  // Organize pasted stickers by section
  const sectionsWithPasted = sections
    .map(section => {
      const pastedCards = section.cards.filter(
        card => (shareData.collectionState[card.id] || 0) >= 1
      );
      return { ...section, pastedCards };
    })
    .filter(s => s.pastedCards.length > 0);

  return (
    <div className="bg-emerald-950 min-h-screen text-slate-100 flex flex-col font-sans antialiased pb-16">
      {/* GLOW DECORATIVO DE FONDO */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-md h-64 bg-yellow-400/5 rounded-full blur-3xl pointer-events-none z-0" />

      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-emerald-900/90 backdrop-blur-md border-b border-emerald-800 px-4 py-3.5 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center border-2 border-white shadow-inner shrink-0">
              <span className="text-emerald-950 font-black text-xs">26</span>
            </div>
            <div className="min-w-0">
              <span className="font-sans text-sm font-black tracking-tight text-white block leading-tight">
                ÁLBUM MUNDIAL <span className="text-yellow-400">2026</span>
              </span>
              {shareData.name && (
                <span className="text-[10px] text-emerald-400 font-bold font-mono truncate block leading-tight">
                  por {shareData.name}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="flex-1 w-full max-w-sm mx-auto px-1 pt-4 z-10 space-y-2">
        {!hasCollection ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-emerald-900/60 rounded-full flex items-center justify-center mx-auto mb-3">
              <HelpCircle className="w-8 h-8 text-emerald-500" />
            </div>
            <p className="text-sm font-bold text-emerald-300">
              Este álbum está vacío.
            </p>
          </div>
        ) : (
          <>
            {/* STATS RESUME */}
            <div className="bg-emerald-900/60 border border-emerald-800/80 p-4 rounded-3xl shadow-md">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center border-2 border-white shadow-inner shrink-0 text-emerald-950">
                  <Trophy className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-emerald-300 font-black font-mono block">
                    Progreso del álbum
                  </span>
                  <span className="text-lg font-black text-white">
                    {stats.uniquesPasted} / {stats.totalCards}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-950/60 rounded-2xl p-3 border border-emerald-800/50">
                  <span className="text-[9px] text-emerald-300 font-black uppercase tracking-wider font-mono block mb-1">
                    Faltantes
                  </span>
                  <span className="text-xl font-black text-rose-300">{stats.missingCount}</span>
                </div>
                <div className="bg-emerald-950/60 rounded-2xl p-3 border border-emerald-800/50">
                  <span className="text-[9px] text-emerald-300 font-black uppercase tracking-wider font-mono block mb-1">
                    Repetidas
                  </span>
                  <span className="text-xl font-black text-yellow-400">{stats.repeatedCount}</span>
                </div>
              </div>
            </div>

            {/* SECTIONS GRID — PASTED STICKERS */}
            {sectionsWithPasted.map(section => (
              <div
                key={section.id}
                className="bg-emerald-900/60 border border-emerald-800/80 rounded-3xl p-4 shadow-md"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">{section.flag}</span>
                  <h3 className="text-sm font-black text-white uppercase tracking-tight">
                    {section.name}
                  </h3>
                  <span className="ml-auto text-[10px] bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded-full font-mono font-bold">
                    {section.pastedCards.length}/{section.cards.length}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {section.cards.map(card => {
                    const count = shareData.collectionState[card.id] || 0;
                    const isPasted = count >= 1;

                    return (
                      <div
                        key={card.id}
                        className={`w-9 h-9 rounded-lg flex items-center justify-center text-[11px] font-bold font-mono border transition-all ${
                          isPasted
                            ? count > 1
                              ? 'bg-yellow-400/20 border-yellow-400/40 text-yellow-400 shadow-sm'
                              : 'bg-emerald-400/20 border-emerald-500/30 text-emerald-300 shadow-sm'
                            : 'bg-emerald-950/50 border-emerald-800/40 text-emerald-700/60'
                        }`}
                        title={`${card.num}${card.playerName ? ` — ${card.playerName}` : ''}${count > 1 ? ` (×${count})` : ''}`}
                      >
                        {isPasted ? (
                          <span className="relative">
                            {card.num}
                            {count > 1 && (
                              <span className="absolute -top-2 -right-2 text-[7px] text-yellow-400 font-black">
                                +{count - 1}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="opacity-40">{card.num}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* MISSING STICKERS SUMMARY */}
            <div className="bg-emerald-900/60 border border-emerald-800/80 p-4 rounded-3xl shadow-md">
              <h3 className="text-xs font-black text-yellow-400 uppercase tracking-wider font-mono mb-3 flex items-center gap-1.5">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-400" />
                </span>
                Láminas Faltantes
              </h3>

              <div className="grid grid-cols-2 gap-2">
                {sections.map(section => {
                  const sectionCards = section.cards;
                  const missingCards = sectionCards.filter(
                    card => !shareData.collectionState[card.id] || shareData.collectionState[card.id] === 0
                  );

                  if (missingCards.length === 0) return null;

                  return (
                    <div key={section.id} className="bg-emerald-950/50 rounded-2xl p-3 border border-emerald-800/40">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-sm">{section.flag}</span>
                        <span className="text-[9px] font-black text-emerald-300 uppercase tracking-tight truncate font-mono">
                          {section.id}
                        </span>
                        <span className="ml-auto text-[9px] text-rose-400 font-bold font-mono">
                          {missingCards.length}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-0.5">
                        {missingCards.map(card => (
                          <span
                            key={card.id}
                            className="text-[8px] px-1 py-0.5 bg-rose-900/20 text-rose-400/80 rounded font-mono"
                          >
                            {card.num}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* REPEATED STICKERS */}
            {topRepeated.length > 0 && (
              <div className="bg-emerald-900/60 border border-emerald-800/80 p-4 rounded-3xl shadow-md">
                <h3 className="text-xs font-black text-yellow-400 uppercase tracking-wider font-mono mb-3 flex items-center gap-1.5">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-400" />
                  </span>
                  Repetidas
                </h3>

                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {topRepeated.map((item, idx) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between bg-emerald-950/60 p-3 rounded-2xl border border-emerald-800 relative shadow-sm"
                    >
                      <div className="absolute top-0 left-0 bg-yellow-400 text-emerald-950 text-[9px] px-2 py-0.5 rounded-br-lg font-black font-mono shadow-sm">
                        #{idx + 1}
                      </div>

                      <div className="flex items-center gap-2.5 ml-4 min-w-0">
                        <span className="text-xl shrink-0 mt-0.5">{item.flag}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-black text-white text-xs bg-emerald-950 px-1.5 py-0.5 rounded">
                              {item.sectionId} {item.num}
                            </span>
                            <span className="text-[9px] text-white font-extrabold bg-red-500 px-2.5 py-0.5 rounded-md uppercase tracking-wider shrink-0">
                              x{item.repeatedAmount}
                            </span>
                          </div>
                          {item.playerName && (
                            <p className="text-[11px] text-emerald-300 truncate mt-1 bg-emerald-950/30 font-semibold leading-relaxed">
                              {item.playerName}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* FOOTER */}
      <footer className="fixed bottom-0 inset-x-0 bg-emerald-900/95 backdrop-blur-md border-t border-emerald-800/80 z-40 shadow-lg">
        <div className="max-w-sm mx-auto h-14 px-3 flex items-center justify-center">
          <a
            href="/"
            className="flex items-center justify-center gap-2 text-emerald-300 hover:text-white text-[10px] font-bold uppercase tracking-wider transition"
          >
            <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
            Creá tu propio álbum
          </a>
        </div>
      </footer>
    </div>
  );
}
