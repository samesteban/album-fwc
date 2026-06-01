/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { Section, CollectionState } from '../types';
import { Plus, Minus, CheckCircle, HelpCircle, Copy, Sparkles, Star } from 'lucide-react';
import { motion } from 'motion/react';

interface CardGridProps {
  section: Section;
  collectionState: CollectionState;
  onUpdateCount: (cardId: string, delta: number) => void;
  onSetSectionAllState: (sectionId: string, stateValue: number) => void; // Quick helper to mark all as pasted/clear
}

export default function CardGrid({
  section,
  collectionState,
  onUpdateCount,
  onSetSectionAllState,
}: CardGridProps) {
  // Calcular estadísticas de esta sección específica
  const stats = useMemo(() => {
    let pasted = 0;
    section.cards.forEach(card => {
      const count = collectionState[card.id] || 0;
      if (count >= 1) {
        pasted++;
      }
    });
    const total = section.cards.length;
    const percentage = Math.round((pasted / total) * 100);
    return { pasted, total, percentage };
  }, [section, collectionState]);

  return (
    <div id={`grid-section-${section.id}`} className="space-y-4">
      {/* ENCUBRIMIENTO / HEADER DE LA SECCIÓN */}
      <div className="bg-emerald-900 border border-emerald-800 p-4.5 rounded-3xl shadow-xl relative overflow-hidden">
        {/* Background glow corresponding to section status */}
        <div className={`absolute -right-16 -top-16 w-32 h-32 rounded-full blur-3xl transition-all duration-300 ${
          stats.pasted === stats.total ? 'bg-emerald-500/30' : 'bg-yellow-400/15'
        }`} />

        <div className="flex items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3">
            <span className="text-4xl leading-none font-sans shrink-0" role="img" aria-label={section.name}>
              {section.flag}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-black py-0.5 px-2 bg-emerald-950 text-yellow-400 rounded-lg">
                  {section.id}
                </span>
                <h2 className="text-base font-black text-white truncate max-w-[150px]">{section.name}</h2>
              </div>
              <p className="text-xs text-emerald-300 mt-1">
                Láminas: <span className="font-mono text-white text-xs font-black">{stats.pasted}</span> de <span className="font-mono text-emerald-400 text-xs font-black">{stats.total}</span> (
                <span className={stats.pasted === stats.total ? "text-yellow-400 font-extrabold" : "text-yellow-300 font-bold"}>
                  {stats.percentage}%
                </span>
                )
              </p>
            </div>
          </div>

          {/* Quick Check badge / Sparkle */}
          {stats.pasted === stats.total && (
            <div className="bg-yellow-400 text-emerald-950 flex items-center gap-1 px-2.5 py-1.5 rounded-full font-black text-[9px] uppercase tracking-wider animate-pulse shadow">
              <Sparkles className="w-3 h-3 text-emerald-950" /> ¡Completado!
            </div>
          )}
        </div>

        {/* Barra de progreso de la sección */}
        <div className="w-full bg-emerald-950 h-2.5 rounded-full mt-4 overflow-hidden relative z-10 border border-emerald-850">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${stats.percentage}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className={`h-full rounded-full ${
              stats.pasted === stats.total
                ? 'bg-gradient-to-r from-emerald-400 to-yellow-400'
                : 'bg-gradient-to-r from-yellow-400 to-amber-500'
            }`}
          />
        </div>

        {/* Acciones Rápidas del Album */}
        <div className="flex gap-2 justify-end mt-3 pt-3 border-t border-emerald-850 relative z-10">
          <button
            onClick={() => onSetSectionAllState(section.id, 0)}
            className="text-[10px] font-bold text-emerald-300 hover:text-rose-100 px-2.5 py-1.5 rounded-xl bg-emerald-950/40 hover:bg-rose-500/15 transition border border-emerald-800/50"
          >
            Limpiar
          </button>
          <button
            onClick={() => onSetSectionAllState(section.id, 1)}
            className="text-[10px] font-black text-emerald-950 hover:bg-yellow-300 px-2.5 py-1.5 rounded-xl bg-yellow-400 hover:text-emerald-950 transition flex items-center gap-1 shadow-sm"
          >
            Marcar Todos
          </button>
        </div>
      </div>

      {/* CUADRÍCULA DE LÁMINAS - 2 COLUMNAS FIJAS */}
      <div id="cards-grid-layout" className="grid grid-cols-2 gap-3 pb-40">
        {section.cards.map((card, index) => {
          const count = collectionState[card.id] || 0;
          const isMissing = count === 0;
          const isPasted = count === 1;
          const isRepeated = count >= 2;

          // Clases dinámicas según el estado solicitado
          let cardBg = "bg-emerald-950/30 border-emerald-900/60 text-emerald-700/80 opacity-60 grayscale"; // Faltante
          let cardStatusLabel = "Faltante";
          let labelColor = "text-emerald-600 font-bold";
          let borderGlow = "border-dashed";

          if (isPasted) {
            cardBg = "bg-gradient-to-b from-emerald-900 to-emerald-950 border-emerald-400 text-white shadow-lg shadow-emerald-950/50 scale-[1.01]";
            cardStatusLabel = "Pegada";
            labelColor = "text-yellow-400 font-black";
            borderGlow = "border-solid";
          } else if (isRepeated) {
            cardBg = "bg-gradient-to-b from-emerald-900 to-emerald-950 border-yellow-400 text-yellow-100 shadow-xl shadow-yellow-950/20 scale-[1.01]";
            cardStatusLabel = `${count - 1} Repetida(s)`;
            labelColor = "text-red-400 font-black";
            borderGlow = "border-solid";
          }

          return (
            <motion.div
              key={card.id}
              layout
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(0.2, index * 0.015) }}
              className={`border-2 rounded-2xl p-3 flex flex-col justify-between h-[155px] transition-all duration-300 relative overflow-hidden group ${cardBg} ${borderGlow}`}
            >
              {/* Fondo decorativo exclusivo si está pegada o repetida */}
              {isPasted && (
                <div className="absolute right-0 bottom-0 pointer-events-none opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                  <CheckCircle className="w-20 h-20 -mr-4 -mb-4 text-yellow-400" />
                </div>
              )}
              {isRepeated && (
                <div className="absolute right-0 bottom-0 pointer-events-none opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                  <Star className="w-20 h-20 -mr-4 -mb-4 text-yellow-400" />
                </div>
              )}

              {/* Top Row: Sigla + Número */}
              <div className="flex justify-between items-start">
                <span className="font-mono font-black text-[11px] bg-emerald-950 text-white px-2 py-0.5 rounded-md tracking-wider">
                  {card.sectionId} {card.num}
                </span>

                {/* Gran indicador numérico multiplicador si es >= 2 */}
                {isRepeated && (
                  <motion.div
                    initial={{ scale: 0.6 }}
                    animate={{ scale: 1 }}
                    className="absolute top-2.5 right-2.5 bg-red-500 text-white h-7.5 w-7.5 rounded-full flex items-center justify-center text-xs font-black shadow-lg border-2 border-white leading-none shrink-0"
                  >
                    x{count}
                  </motion.div>
                )}

                {/* Pequeño icono ilustrativo para pegado simple */}
                {isPasted && (
                  <div className="text-emerald-950 bg-yellow-400 p-1 rounded-lg shadow-sm">
                    <CheckCircle className="w-3.5 h-3.5" />
                  </div>
                )}

                {/* Icono faltante */}
                {isMissing && (
                  <div className="text-emerald-800 bg-emerald-950/40 p-1 rounded-lg">
                    <HelpCircle className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>

              {/* Middle Row: Nombre de Jugador (Opcional, solo si el tipo de sección no es especial) */}
              <div className="my-2 min-w-0 flex-1 flex flex-col justify-center">
                {card.playerName ? (
                  <p className={`text-xs font-bold leading-snug line-clamp-2 ${isMissing ? 'text-emerald-700/80' : 'text-white'}`}>
                    {card.playerName}
                  </p>
                ) : (
                  <div className="py-2">
                    <span className="text-[9px] uppercase font-mono font-black tracking-widest text-emerald-400">
                      {section.id === 'FWC' ? 'Especial FWC' : 'Especial CC'}
                    </span>
                  </div>
                )}
              </div>

              {/* Bottom Row: Estado label + +/- Controles */}
              <div className="flex justify-between items-center bg-emerald-950/90 -mx-3 -mb-3 px-3 py-1.5 rounded-b-2xl border-t border-emerald-900">
                <span className={`text-[9px] font-bold tracking-wider uppercase font-mono ${labelColor}`}>
                  {isMissing ? 'Faltante' : isPasted ? 'Pegada' : `${count - 1} Rep.`}
                </span>

                {/* Controles de incremento / decremento */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => onUpdateCount(card.id, -1)}
                    disabled={count === 0}
                    className={`h-7 w-7 rounded-lg flex items-center justify-center transition-all ${
                      count === 0
                        ? 'text-emerald-950/40 bg-emerald-950/20 cursor-not-allowed'
                        : 'text-white bg-emerald-800 hover:bg-emerald-700'
                    }`}
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onUpdateCount(card.id, 1)}
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-white bg-emerald-850 hover:bg-emerald-700 hover:text-white transition-all border border-emerald-700"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
