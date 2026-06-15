/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Section, CollectionState, CollectionStats } from '../types';
import { getTopRepeatedCards, calculateStats } from '../data';
import { Search, Trophy, CheckCircle, HelpCircle, Plus, Minus, ArrowRight, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ShareButton from './ShareButton';

interface DashboardProps {
  sections: Section[];
  collectionState: CollectionState;
  onUpdateCount: (cardId: string, delta: number) => void;
  onSelectSection: (sectionId: string) => void;
  onResetCollection: () => void;
  syncStatus?: string;
  /** Present = authenticated, undefined = not logged in */
  userDisplayName?: string | null;
}

export default function Dashboard({
  sections,
  collectionState,
  onUpdateCount,
  onSelectSection,
  onResetCollection,
  syncStatus,
  userDisplayName,
}: DashboardProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Calcular estadísticas generales
  const stats = useMemo(() => {
    return calculateStats(sections, collectionState);
  }, [sections, collectionState]);

  // Obtener el Top 10 de más repetidas
  const topRepeated = useMemo(() => {
    return getTopRepeatedCards(sections, collectionState, 10);
  }, [sections, collectionState]);

  // Lista plana de todas las cartas para buscador reactivo rápida
  const allCardsFlat = useMemo(() => {
    const list: {
      id: string;
      sectionId: string;
      num: string;
      playerName?: string;
      sectionFlag?: string;
      sectionName: string;
    }[] = [];

    sections.forEach(section => {
      section.cards.forEach(card => {
        list.push({
          id: card.id,
          sectionId: card.sectionId,
          num: card.num,
          playerName: card.playerName,
          sectionFlag: section.flag,
          sectionName: section.name
        });
      });
    });

    return list;
  }, [sections]);

  // Lógica del buscador reactivo
  // Soporta buscar "ARG 15", "México", "Jugador 1", "CC", "FWC 00", etc.
  const searchResults = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return [];

    return allCardsFlat
      .filter(card => {
        const fullCode = `${card.sectionId} ${card.num}`.toLowerCase();
        const codeNoSpace = `${card.sectionId}${card.num}`.toLowerCase();
        const sectionName = card.sectionName.toLowerCase();
        const playerName = card.playerName ? card.playerName.toLowerCase() : '';
        const sectionId = card.sectionId.toLowerCase();
        
        return (
          fullCode.includes(query) ||
          codeNoSpace.includes(query) ||
          sectionName.includes(query) ||
          playerName.includes(query) ||
          sectionId === query ||
          card.num === query
        );
      })
      .slice(0, 15); // Limitar a 15 resultados rápidos para preservar rendimiento
  }, [allCardsFlat, searchTerm]);

  // Estilo del porcentaje de progreso
  const circleRadius = 50;
  const circumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circumference - (stats.completionPercentage / 100) * circumference;

  return (
    <div id="dashboard-container" className="space-y-6">
      {/* SECCIÓN DEL TITULO/HEADER DEL APARTADO */}
      <div className="flex justify-between items-center bg-emerald-900 text-white p-4.5 rounded-3xl shadow-xl border border-emerald-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center border-2 border-white shadow-inner shrink-0 text-emerald-950">
            <Trophy className="w-5.5 h-5.5 stroke-[2.5]" />
          </div>
          <div>
            <span className="text-xs uppercase tracking-widest text-emerald-300 font-black font-mono">QATAR & 48 SELECCIONES</span>
            <h1 className="text-xl font-black tracking-tight text-white">Álbum <span className="text-yellow-400">2026</span> PWA</h1>
          </div>
        </div>
      </div>

      {/* SYNC STATUS BAR */}
      {syncStatus && (
        <div className="flex items-center justify-between bg-emerald-900/40 border border-emerald-800/50 px-4 py-2 rounded-2xl">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              syncStatus === 'synced' ? 'bg-emerald-400' :
              syncStatus === 'syncing' ? 'bg-yellow-400 animate-pulse' :
              syncStatus === 'error' ? 'bg-red-400' :
              syncStatus === 'offline' ? 'bg-slate-500' :
              'bg-emerald-700'
            }`} />
            <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider font-mono">
              {syncStatus === 'synced' && 'Sincronizado'}
              {syncStatus === 'syncing' && 'Sincronizando...'}
              {syncStatus === 'error' && 'Error de sincronización'}
              {syncStatus === 'offline' && 'Sin conexión'}
              {syncStatus === 'idle' && 'Local'}
            </span>
          </div>
        </div>
      )}

      {/* BUSCADOR REACTIVO DE LÁMINAS */}
      <div id="search-box" className="bg-emerald-900/55 border border-emerald-800/80 p-4 rounded-3xl shadow-lg">
        <label className="block text-[11px] font-black text-emerald-300 uppercase tracking-wider mb-2 font-mono">
          Buscador de Láminas
        </label>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400 w-5 h-5 pointer-events-none" />
          <input
            type="text"
            placeholder="Ej: ARG 15, FWC 00, Pedro, México..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-emerald-950 border border-emerald-800 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 rounded-2xl text-white placeholder-emerald-400/65 outline-none transition duration-150 text-sm"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] bg-emerald-800 text-white font-bold px-2.5 py-1 rounded-md hover:bg-emerald-700"
            >
              Borrar
            </button>
          )}
        </div>

        {/* RESULTADOS DE BÚSQUEDA */}
        <AnimatePresence>
          {searchTerm && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-3 overflow-hidden space-y-2 max-h-[350px] overflow-y-auto divide-y divide-emerald-800/30 pr-1 text-emerald-100"
            >
              {searchResults.length === 0 ? (
                <div className="text-center py-6 text-emerald-400 text-xs font-semibold">
                  No se encontraron láminas correspondientes.
                </div>
              ) : (
                searchResults.map(card => {
                  const count = collectionState[card.id] || 0;
                  
                  // Colores según estado del buscador (0, 1, 2+)
                  let stateBg = "bg-red-500/10 border-red-500/20 text-red-400";
                  let stateLabel = "Faltante";
                  if (count === 1) {
                    stateBg = "bg-emerald-400/10 border-emerald-500/20 text-emerald-300";
                    stateLabel = "Pegada";
                  } else if (count >= 2) {
                    stateBg = "bg-yellow-400/10 border-yellow-400/20 text-yellow-400";
                    stateLabel = `Repetida +${count - 1}`;
                  }

                  return (
                    <div
                      key={card.id}
                      className="flex items-center justify-between py-3 first:pt-1 text-sm gap-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-xl shrink-0" title={card.sectionName}>
                          {card.sectionFlag}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-baseline gap-1.5 flex-wrap">
                            <span className="font-mono font-black text-white text-xs bg-emerald-950 px-1.5 py-0.5 rounded">
                              {card.sectionId} {card.num}
                            </span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${stateBg}`}>
                              {stateLabel}
                            </span>
                          </div>
                          {card.playerName && (
                            <p className="text-xs text-emerald-300 truncate mt-1.5 font-semibold leading-none">
                              {card.playerName}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Saltar a Sección */}
                        <button
                          onClick={() => {
                            onSelectSection(card.sectionId);
                            setSearchTerm('');
                          }}
                          className="p-1.5 bg-yellow-400 hover:bg-yellow-300 text-emerald-950 rounded-lg text-[10px] flex items-center gap-1 font-black transition-all shrink-0 shadow"
                          title="Ir a Sección"
                        >
                          Ir <ArrowRight className="w-3 h-3 stroke-[2.5]" />
                        </button>

                        {/* Modificador rápido */}
                        <div className="flex items-center bg-emerald-950 border border-emerald-800 rounded-xl p-0.5">
                          <button
                            onClick={() => onUpdateCount(card.id, -1)}
                            disabled={count === 0}
                            className={`p-1.5 rounded-lg hover:bg-emerald-900 transition ${
                              count === 0 ? 'text-emerald-900 cursor-not-allowed' : 'text-emerald-400 hover:text-white'
                            }`}
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-center font-bold px-2 text-white font-mono min-w-[20px] text-xs">
                            {count}
                          </span>
                          <button
                            onClick={() => onUpdateCount(card.id, 1)}
                            className="p-1.5 rounded-lg hover:bg-emerald-900 text-emerald-400 hover:text-white transition"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* KPIS DE PROGRESO DE LA COLECCIÓN */}
      <div className="grid grid-cols-1 gap-4">
        {/* KPI 1: Circular Progress Arc */}
        <div className="bg-emerald-900 border border-emerald-800 rounded-3xl p-4.5 flex items-center justify-between shadow-lg">
          <div className="space-y-1.5">
            <h3 className="text-emerald-300 text-[11px] font-black uppercase tracking-wider font-mono">Progreso Total</h3>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-white">{stats.uniquesPasted}</span>
              <span className="text-emerald-400 font-bold text-sm">/ {stats.totalCards}</span>
            </div>
            <p className="text-xs text-yellow-300 font-bold flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" />
              Láminas Coleccionadas
            </p>
          </div>

          <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="48"
                cy="48"
                r={circleRadius}
                fill="transparent"
                stroke="rgba(6, 78, 59, 1)"
                strokeWidth="8"
              />
              <circle
                cx="48"
                cy="48"
                r={circleRadius}
                fill="transparent"
                stroke="url(#progressGradient)"
                strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-500 ease-out"
              />
              <defs>
                <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#34d399" />
                  <stop offset="100%" stopColor="#facc15" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-black text-white leading-none">{stats.completionPercentage}%</span>
              <span className="text-[9px] text-emerald-300 font-black tracking-wider uppercase font-mono mt-0.5">Pegadas</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Faltantes & Repetidas */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-emerald-900 border border-emerald-800 rounded-3xl p-4 flex flex-col justify-between shadow-md">
            <span className="text-emerald-300 text-[10px] font-black uppercase tracking-wider font-mono">Faltantes</span>
            <div className="mt-2 space-y-1">
              <div className="text-2xl font-black text-rose-300">{stats.missingCount}</div>
              <div className="text-[10px] text-emerald-200 font-medium leading-tight">Necesitas Conseguir</div>
            </div>
            <div className="w-full bg-emerald-950 h-1.5 rounded-full mt-2.5 overflow-hidden">
              <div
                className="bg-rose-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${(stats.missingCount / stats.totalCards) * 100}%` }}
              ></div>
            </div>
          </div>

          <div className="bg-emerald-900 border border-emerald-800 rounded-3xl p-4 flex flex-col justify-between shadow-md">
            <span className="text-emerald-300 text-[10px] font-black uppercase tracking-wider font-mono">Repetidas</span>
            <div className="mt-2 space-y-1">
              <div className="text-2xl font-black text-yellow-400">{stats.repeatedCount}</div>
              <div className="text-[10px] text-emerald-200 font-medium leading-tight">Para Intercambiar</div>
            </div>
            <div className="w-full bg-emerald-950 h-1.5 rounded-full mt-2.5 overflow-hidden">
              <div
                className="bg-yellow-400 h-full rounded-full transition-all duration-300"
                style={{ width: `${stats.totalCards > 0 ? Math.min(100, (stats.repeatedCount / stats.totalCards) * 100) : 0}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* COMPARTIR MI ÁLBUM */}
      {userDisplayName !== undefined && (
        <ShareButton
          collectionState={collectionState}
          displayName={userDisplayName ?? null}
        />
      )}

      {/* COMPARADOR DE ÁLBUMES */}
      <a
        href="/match"
        className="block bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 border border-emerald-500/30 p-4 rounded-3xl shadow-lg transition-all active:scale-[0.98]"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center border-2 border-white shadow-inner shrink-0">
            <span className="text-emerald-950 font-black text-sm text-center leading-none">⇄</span>
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-black text-white">Comparar Álbumes</h3>
            <p className="text-[10px] text-emerald-300 font-semibold mt-0.5">
              Encontrá intercambios con otros coleccionistas
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-yellow-400 shrink-0 ml-auto stroke-[2.5]" />
        </div>
      </a>

      {/* TOP 10 REPETIDAS */}
      <div id="top-10-repeated shadow-md" className="bg-emerald-900/60 border border-emerald-800/80 p-4 rounded-3xl">
        <div className="flex items-center justify-between mb-3.5">
          <h3 className="text-xs font-black text-yellow-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-400"></span>
            </span>
            Top 10 Repetidas
          </h3>
          <span className="text-[9px] bg-emerald-950 text-emerald-300 px-2.5 py-1 rounded-full font-mono font-bold uppercase tracking-wider">
            De Mayor a Menor
          </span>
        </div>

        {topRepeated.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-emerald-800/60 rounded-2xl text-emerald-400 text-xs font-semibold">
            Sin láminas repetidas aún. Las láminas con contador de 2 o más aparecerán aquí como duplicadas.
          </div>
        ) : (
          <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
            {topRepeated.map((item, idx) => (
              <div
                key={item.id}
                className="flex items-center justify-between bg-emerald-950/60 p-3 rounded-2xl border border-emerald-800 relative shadow-sm"
              >
                {/* Ranking badge */}
                <div className="absolute top-0 left-0 bg-yellow-400 text-emerald-950 text-[9px] px-2 py-0.5 rounded-br-lg font-black font-mono shadow-sm">
                  #{idx + 1}
                </div>

                <div className="flex items-center gap-2.5 ml-4 min-w-0">
                  <span className="text-xl shrink-0 mt-0.5">{item.flag}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono font-black text-white text-xs bg-emerald-900 px-1.5 py-0.5 rounded">
                        {item.sectionId} {item.num}
                      </span>
                      <span className="text-[9px] text-white font-extrabold bg-red-500 px-2.5 py-0.5 rounded-md shadow-sm uppercase tracking-wider shrink-0 select-none">
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

                <div className="flex items-center gap-2">
                  {/* Saltar a Sección */}
                  <button
                    onClick={() => onSelectSection(item.sectionId)}
                    className="p-1.5 bg-emerald-800 hover:bg-emerald-700 text-emerald-200 rounded-lg text-xs"
                    title="Ir a Sección"
                  >
                    <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                  </button>

                  <div className="flex items-center bg-emerald-950 border border-emerald-800 rounded-xl p-0.5">
                    <button
                      onClick={() => onUpdateCount(item.id, -1)}
                      className="p-1.5 rounded-lg hover:bg-emerald-900 text-emerald-400 hover:text-white transition"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-center font-bold px-2 text-white font-mono min-w-[18px] text-xs">
                      {item.count}
                    </span>
                    <button
                      onClick={() => onUpdateCount(item.id, 1)}
                      className="p-1.5 rounded-lg hover:bg-emerald-900 text-emerald-400 hover:text-white transition"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
