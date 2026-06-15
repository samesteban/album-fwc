/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { ArrowLeft, Loader2, AlertCircle, HelpCircle, Search, CheckCircle, ArrowRight } from 'lucide-react';
import { buildInitialSections, computeTradeMatches } from '../data';
import { supabase } from '../lib/supabase';
import type { TradeResult, TradeMatchItem, ShareMetadata } from '../types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const STORAGE_KEY = 'album_share_metadata';

type PageState = 'form' | 'loading' | 'results' | 'error';

interface ShareData {
  name: string | null;
  collectionState: Record<string, number>;
  createdAt: string;
}

function isValidShareData(raw: unknown): raw is ShareData {
  if (!raw || typeof raw !== 'object') return false;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.collectionState !== 'object' || obj.collectionState === null) return false;
  return true;
}

function TradeItemCard({ item }: { item: TradeMatchItem; key?: string }) {
  return (
    <div className="flex items-center gap-2.5 bg-emerald-950/60 p-3 rounded-2xl border border-emerald-800/70 shadow-sm">
      <span className="text-xl shrink-0">{item.sectionFlag}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono font-black text-white text-xs bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-800/50">
            {item.sectionId} {item.num}
          </span>
        </div>
        {item.playerName && (
          <p className="text-[11px] text-emerald-300 truncate mt-1 font-semibold leading-relaxed">
            {item.playerName}
          </p>
        )}
      </div>
      {item.surplusOwner && (
        <span className={`shrink-0 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
          item.surplusOwner === 'mine'
            ? 'bg-yellow-400/15 text-yellow-400 border border-yellow-400/30'
            : 'bg-amber-400/15 text-amber-400 border border-amber-400/30'
        }`}>
          {item.surplusOwner === 'mine' ? 'Mía' : 'Suya'}
        </span>
      )}
    </div>
  );
}

export default function TradeMatchPage() {
  const [pageState, setPageState] = useState<PageState>('form');
  const [userId, setUserId] = useState<string>('');
  const [profileLoading, setProfileLoading] = useState(true);

  // Load userId: try localStorage first, then fallback to Supabase profile
  useEffect(() => {
    (async () => {
      // 1. Try localStorage (anonymous and synced users)
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const meta: ShareMetadata = JSON.parse(raw);
          if (meta.shareId) {
            setUserId(meta.shareId);
            setProfileLoading(false);
            return;
          }
        }
      } catch {
        // Ignore corrupted data
      }

      // 2. Fallback: check Supabase profile for logged-in users
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('share_id')
          .eq('id', session.user.id)
          .single();
        if (profile?.share_id) {
          const meta: ShareMetadata = { shareId: profile.share_id, createdAt: '' };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
          setUserId(profile.share_id);
        }
      }

      setProfileLoading(false);
    })();
  }, []);

  const [otherId, setOtherId] = useState('');
  const [result, setResult] = useState<TradeResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSameId, setIsSameId] = useState(false);
  const [isOtherEmpty, setIsOtherEmpty] = useState(false);
  const [isUserEmpty, setIsUserEmpty] = useState(false);

  const sections = useMemo(() => buildInitialSections(), []);
  const hasStoredId = userId !== '';

  const handleCompare = async () => {
    const trimmedUser = userId.trim();
    const trimmedOther = otherId.trim();

    if (!trimmedUser || !trimmedOther) return;

    // Self-comparison detection
    if (trimmedUser === trimmedOther) {
      setIsSameId(true);
      setIsOtherEmpty(false);
      setIsUserEmpty(false);
      setResult({ vosLeDas: [], elxTeDa: [], matches: [], surplus: [] });
      setPageState('results');
      return;
    }

    setPageState('loading');
    setIsSameId(false);

    try {
      const userUrl = `${SUPABASE_URL}/storage/v1/object/public/album-shares/public/${trimmedUser}.json`;
      const otherUrl = `${SUPABASE_URL}/storage/v1/object/public/album-shares/public/${trimmedOther}.json`;

      const responses = await Promise.all([
        fetch(userUrl),
        fetch(otherUrl),
      ]);

      const [userRes, otherRes] = responses;

      if (!userRes.ok || !otherRes.ok) {
        setPageState('error');
        setErrorMessage('No se pudo cargar uno de los álbumes');
        return;
      }

      const [userRaw, otherRaw] = await Promise.all([
        userRes.json(),
        otherRes.json(),
      ]);

      if (!isValidShareData(userRaw) || !isValidShareData(otherRaw)) {
        setPageState('error');
        setErrorMessage('Alguno de los álbumes tiene datos inválidos');
        return;
      }

      const userCount = Object.keys(userRaw.collectionState).length;
      const otherCount = Object.keys(otherRaw.collectionState).length;
      setIsUserEmpty(userCount === 0);
      setIsOtherEmpty(otherCount === 0);

      const tradeResult = computeTradeMatches(
        sections,
        userRaw.collectionState,
        otherRaw.collectionState,
      );

      setResult(tradeResult);
      setPageState('results');
    } catch (err) {
      console.error('Error al comparar álbumes:', err);
      setPageState('error');
      setErrorMessage('No se pudo conectar al servidor.');
    }
  };

  const handleRetry = () => {
    setPageState('form');
    setErrorMessage('');
    setResult(null);
    setIsSameId(false);
    setIsOtherEmpty(false);
    setIsUserEmpty(false);
  };

  // ── Form State (no stored ID) ────────────────────────────────

  if (pageState === 'form' && !hasStoredId) {
    // Still checking Supabase profile — show loading
    if (profileLoading) {
      return (
        <div className="bg-emerald-950 min-h-screen text-slate-100 flex flex-col font-sans antialiased">
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
            <div className="w-16 h-16 bg-yellow-400/10 rounded-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-yellow-400 animate-spin" />
            </div>
          </div>
        </div>
      );
    }

    // No ID found in localStorage or profile
    return (
      <div className="bg-emerald-950 min-h-screen text-slate-100 flex flex-col font-sans antialiased">
        <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-md h-64 bg-yellow-400/5 rounded-full blur-3xl pointer-events-none z-0" />

        <main className="flex-1 w-full max-w-sm mx-auto px-4 pt-12 z-10 flex flex-col items-center justify-center gap-6">
          <div className="w-20 h-20 bg-emerald-900 border-2 border-emerald-800 rounded-full flex items-center justify-center">
            <HelpCircle className="w-10 h-10 text-emerald-500" />
          </div>
          <h1 className="text-xl font-black text-white text-center">
            Primero comparte tu álbum
          </h1>
          <p className="text-sm text-emerald-300 text-center max-w-xs leading-relaxed">
            Necesitas generar un enlace de tu álbum antes de poder compararlo con otra persona.
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-emerald-950 font-black px-6 py-3 rounded-2xl text-sm uppercase tracking-wider transition-all shadow-lg"
          >
            <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
            Volver al inicio
          </a>
        </main>
      </div>
    );
  }

  // ── Form State (with stored ID) ──────────────────────────────

  if (pageState === 'form') {
    return (
      <div className="bg-emerald-950 min-h-screen text-slate-100 flex flex-col font-sans antialiased">
        <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-md h-64 bg-yellow-400/5 rounded-full blur-3xl pointer-events-none z-0" />

        {/* HEADER */}
        <header className="sticky top-0 z-40 bg-emerald-900/90 backdrop-blur-md border-b border-emerald-800 px-4 py-3.5 shadow-lg">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center border-2 border-white shadow-inner shrink-0">
              <span className="text-emerald-950 font-black text-xs">26</span>
            </div>
            <span className="font-sans text-sm font-black tracking-tight text-white">
              Comparar Álbumes
            </span>
          </div>
        </header>

        <main className="flex-1 w-full max-w-sm mx-auto px-4 pt-6 z-10 space-y-6">
          <div className="bg-emerald-900/60 border border-emerald-800/80 p-5 rounded-3xl shadow-lg space-y-4">
            {/* Tu ID */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-black text-emerald-300 uppercase tracking-wider font-mono">
                Tu ID
              </label>
              <input
                type="text"
                value={userId}
                onChange={e => setUserId(e.target.value)}
                placeholder="Tu ID del álbum compartido"
                className="w-full px-4 py-3 bg-emerald-950 border border-emerald-800 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 rounded-2xl text-white placeholder-emerald-400/65 outline-none transition duration-150 text-sm"
              />
            </div>

            {/* Other ID */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-black text-emerald-300 uppercase tracking-wider font-mono">
                ID del otro álbum
              </label>
              <input
                type="text"
                value={otherId}
                onChange={e => setOtherId(e.target.value)}
                placeholder="Pega el ID de la otra persona"
                className="w-full px-4 py-3 bg-emerald-950 border border-emerald-800 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 rounded-2xl text-white placeholder-emerald-400/65 outline-none transition duration-150 text-sm"
              />
            </div>

            <button
              onClick={handleCompare}
              disabled={!userId.trim() || !otherId.trim()}
              className="w-full bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-emerald-950 font-black py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 text-sm uppercase tracking-wider shadow-lg transition-all active:scale-[0.98] border border-yellow-300/40 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              <Search className="w-5 h-5 stroke-[2.5]" />
              Comparar
            </button>
          </div>

          <a
            href="/"
            className="flex items-center justify-center gap-2 text-emerald-400 hover:text-emerald-200 text-[11px] font-bold uppercase tracking-wider transition"
          >
            <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
            Volver al inicio
          </a>
        </main>
      </div>
    );
  }

  // ── Loading State ────────────────────────────────────────────

  if (pageState === 'loading') {
    return (
      <div className="bg-emerald-950 min-h-screen text-slate-100 flex flex-col font-sans antialiased">
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
          <div className="w-16 h-16 bg-yellow-400/10 rounded-full flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-yellow-400 animate-spin" />
          </div>
          <p className="text-sm font-bold text-emerald-300 animate-pulse">
            Comparando álbumes...
          </p>
        </div>
      </div>
    );
  }

  // ── Results State ────────────────────────────────────────────

  if (pageState === 'results' && result) {
    const totalItems = result.vosLeDas.length + result.elxTeDa.length;
    const isEmpty = totalItems === 0;

    return (
      <div className="bg-emerald-950 min-h-screen text-slate-100 flex flex-col font-sans antialiased pb-20">
        <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-md h-64 bg-yellow-400/5 rounded-full blur-3xl pointer-events-none z-0" />

        <header className="sticky top-0 z-40 bg-emerald-900/90 backdrop-blur-md border-b border-emerald-800 px-4 py-3.5 shadow-lg">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center border-2 border-white shadow-inner shrink-0">
              <span className="text-emerald-950 font-black text-xs">26</span>
            </div>
            <span className="font-sans text-sm font-black tracking-tight text-white">
              Resultados
            </span>
          </div>
        </header>

        <main className="flex-1 w-full max-w-sm mx-auto px-4 pt-4 z-10 space-y-4">
          {/* Self-comparison */}
          {isSameId && (
            <div className="bg-emerald-900/60 border border-emerald-800/80 p-6 rounded-3xl shadow-lg text-center space-y-3">
              <div className="w-16 h-16 bg-emerald-900 border-2 border-emerald-800 rounded-full flex items-center justify-center mx-auto">
                <HelpCircle className="w-8 h-8 text-emerald-500" />
              </div>
              <h2 className="text-lg font-black text-white">Mismo álbum</h2>
              <p className="text-sm text-emerald-300 leading-relaxed">
                Estás comparando contigo mismo. No hay intercambios posibles.
              </p>
            </div>
          )}

          {/* Empty results: other person has no stickers */}
          {isEmpty && !isSameId && isOtherEmpty && (
            <div className="bg-emerald-900/60 border border-emerald-800/80 p-6 rounded-3xl shadow-lg text-center space-y-3">
              <div className="w-16 h-16 bg-emerald-900 border-2 border-emerald-800 rounded-full flex items-center justify-center mx-auto">
                <HelpCircle className="w-8 h-8 text-emerald-500" />
              </div>
              <h2 className="text-lg font-black text-white">Sin láminas registradas</h2>
              <p className="text-sm text-emerald-300 leading-relaxed">
                Esta persona no tiene láminas registradas. No hay intercambios posibles.
              </p>
            </div>
          )}

          {/* Empty results: user has no stickers */}
          {isEmpty && !isSameId && isUserEmpty && !isOtherEmpty && (
            <div className="bg-emerald-900/60 border border-emerald-800/80 p-6 rounded-3xl shadow-lg text-center space-y-3">
              <div className="w-16 h-16 bg-emerald-900 border-2 border-emerald-800 rounded-full flex items-center justify-center mx-auto">
                <HelpCircle className="w-8 h-8 text-emerald-500" />
              </div>
              <h2 className="text-lg font-black text-white">Tu álbum está vacío</h2>
              <p className="text-sm text-emerald-300 leading-relaxed">
                Primero registra algunas láminas antes de comparar.
              </p>
            </div>
          )}

          {/* Empty results: both have stickers but no matches */}
          {isEmpty && !isSameId && !isUserEmpty && !isOtherEmpty && (
            <div className="bg-emerald-900/60 border border-emerald-800/80 p-6 rounded-3xl shadow-lg text-center space-y-3">
              <div className="w-16 h-16 bg-emerald-900 border-2 border-emerald-800 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-emerald-500" />
              </div>
              <h2 className="text-lg font-black text-white">Nada para intercambiar</h2>
              <p className="text-sm text-emerald-300 leading-relaxed">
                No hay láminas repetidas que puedan intercambiarse entre estos dos álbumes.
              </p>
            </div>
          )}

          {/* Results with items — two columns */}
          {!isEmpty && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                {result.vosLeDas.length > 0 ? (
                  <SectionBlock
                    title="Le sirven"
                    icon={<ArrowRight className="w-4 h-4 stroke-[2.5]" />}
                    items={result.vosLeDas}
                    accent="emerald"
                    badge={`${result.vosLeDas.length}`}
                  />
                ) : (
                  <div className="bg-emerald-900/60 border border-emerald-800/80 p-3 rounded-3xl shadow-md text-center h-full flex items-center justify-center">
                    <p className="text-[10px] font-bold text-emerald-400 leading-tight">
                      Sin repetidas que le sirvan
                    </p>
                  </div>
                )}
              </div>

              <div>
                {result.elxTeDa.length > 0 ? (
                  <SectionBlock
                    title="Me sirven"
                    icon={<ArrowLeft className="w-4 h-4 stroke-[2.5]" />}
                    items={result.elxTeDa}
                    accent="amber"
                    badge={`${result.elxTeDa.length}`}
                  />
                ) : (
                  <div className="bg-emerald-900/60 border border-emerald-800/80 p-3 rounded-3xl shadow-md text-center h-full flex items-center justify-center">
                    <p className="text-[10px] font-bold text-emerald-400 leading-tight">
                      Sin repetidas que te sirvan
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Back button */}
          <div className="flex flex-col gap-2 pb-4">
            <button
              onClick={handleRetry}
              className="w-full bg-emerald-800 hover:bg-emerald-700 text-white font-black py-3 px-4 rounded-2xl text-sm uppercase tracking-wider transition-all shadow-md"
            >
              Comparar otros álbumes
            </button>
            <a
              href="/"
              className="flex items-center justify-center gap-2 text-emerald-400 hover:text-emerald-200 text-[11px] font-bold uppercase tracking-wider transition py-2"
            >
              <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
              Volver al inicio
            </a>
          </div>

          {/* Disclaimer */}
          <div className="bg-emerald-950/40 border border-emerald-800/30 rounded-2xl px-4 py-3">
            <p className="text-[10px] text-emerald-500 leading-relaxed text-center font-medium">
              Esta comparación es solo una referencia. Antes de realizar cualquier intercambio, coordina con la otra persona. No hay obligación de intercambiar las cartas sugeridas.
            </p>
          </div>
        </main>
      </div>
    );
  }

  // ── Error State ──────────────────────────────────────────────

  return (
    <div className="bg-emerald-950 min-h-screen text-slate-100 flex flex-col font-sans antialiased">
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
        <div className="w-20 h-20 bg-red-900/30 border-2 border-red-800/50 rounded-full flex items-center justify-center">
          <AlertCircle className="w-10 h-10 text-red-400" />
        </div>
        <h1 className="text-xl font-black text-white">Error</h1>
        <p className="text-sm text-emerald-300 text-center max-w-xs leading-relaxed">
          {errorMessage || 'Ocurrió un error inesperado.'}
        </p>
        <div className="flex gap-3 mt-2">
          <button
            onClick={handleRetry}
            className="inline-flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-emerald-950 font-black px-6 py-3 rounded-2xl text-sm uppercase tracking-wider transition-all shadow-lg"
          >
            Reintentar
          </button>
          <a
            href="/"
            className="inline-flex items-center gap-2 bg-emerald-800 hover:bg-emerald-700 text-white font-black px-6 py-3 rounded-2xl text-sm uppercase tracking-wider transition-all shadow-md"
          >
            <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
            Inicio
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Section Block Sub-component ────────────────────────────────

interface SectionBlockProps {
  title: string;
  icon: React.ReactNode;
  items: TradeMatchItem[];
  accent: 'emerald' | 'amber' | 'yellow';
  badge: string;
  highlighted?: boolean;
}

function SectionBlock({ title, icon, items, accent, badge, highlighted }: SectionBlockProps) {
  const borderClass = highlighted
    ? 'border-yellow-400/50 bg-yellow-400/5'
    : 'border-emerald-800/80 bg-emerald-900/60';

  const titleAccent = highlighted ? 'text-yellow-400' : 'text-white';

  return (
    <div className={`${borderClass} p-4 rounded-3xl shadow-md ${highlighted ? 'ring-2 ring-yellow-400/20' : ''}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={titleAccent}>{icon}</span>
        <h3 className={`text-sm font-black uppercase tracking-tight ${titleAccent}`}>
          {title}
        </h3>
        {badge && (
          <span className="ml-auto text-[10px] bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded-full font-mono font-bold">
            {badge}
          </span>
        )}
      </div>

      <div className="space-y-2">
        {items.map(item => (
          <TradeItemCard key={item.cardId} item={item} />
        ))}
      </div>
    </div>
  );
}
