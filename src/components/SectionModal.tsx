/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Section, CollectionState } from '../types';
import { Search, X, Check, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  sections: Section[];
  activeSectionId: string;
  onSelectSection: (sectionId: string) => void;
  collectionState: CollectionState;
}

export default function SectionModal({
  isOpen,
  onClose,
  sections,
  activeSectionId,
  onSelectSection,
  collectionState,
}: SectionModalProps) {
  const [filterQuery, setFilterQuery] = useState('');

  // Calcular el progreso individual de cada sección
  const sectionsProgress = useMemo(() => {
    const progressMap: { [sectionId: string]: { pasted: number; total: number; percentage: number } } = {};

    sections.forEach(section => {
      let pasted = 0;
      section.cards.forEach(card => {
        if ((collectionState[card.id] || 0) >= 1) {
          pasted++;
        }
      });
      progressMap[section.id] = {
        pasted,
        total: section.cards.length,
        percentage: Math.round((pasted / section.cards.length) * 100)
      };
    });

    return progressMap;
  }, [sections, collectionState]);

  // Filtrar secciones por coincidencia en el buscador del modal
  const filteredSections = useMemo(() => {
    const query = filterQuery.trim().toLowerCase();
    if (!query) return sections;

    return sections.filter(
      section =>
        section.name.toLowerCase().includes(query) ||
        section.id.toLowerCase().includes(query)
    );
  }, [sections, filterQuery]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-end sm:items-center justify-center"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="fixed bottom-0 sm:bottom-auto inset-x-0 sm:inset-auto sm:max-w-lg w-full bg-emerald-900 border-t sm:border border-emerald-800 rounded-t-[2.5rem] sm:rounded-3xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[80vh]"
          >
            {/* Drawer Drag handle for mobile */}
            <div className="w-12 h-1.5 bg-emerald-850/50 rounded-full mx-auto my-3 shrink-0 sm:hidden" />

            {/* Header */}
            <div className="px-6 pb-4 pt-2 sm:pt-4 border-b border-emerald-850 shrink-0">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-black text-white flex items-center gap-2">
                    <Globe className="w-5.5 h-5.5 text-yellow-400" />
                    Secciones del Álbum
                  </h2>
                  <p className="text-xs text-emerald-300">Navega a un país o categoría especial</p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 bg-emerald-800 hover:bg-emerald-750 text-emerald-100 hover:text-white rounded-full transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Buscador dentro del modal */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400 w-4.5 h-4.5" />
                <input
                  type="text"
                  placeholder="Buscar país (ej: México, ARG...)"
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-emerald-950 border border-emerald-800 rounded-2xl text-white text-sm outline-none placeholder-emerald-400 focus:border-yellow-400"
                />
              </div>
            </div>

            {/* Grid/List of countries */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filteredSections.map(section => {
                  const progress = sectionsProgress[section.id];
                  const isActive = section.id === activeSectionId;
                  const isComplete = progress.pasted === progress.total;

                  return (
                    <button
                      key={section.id}
                      onClick={() => {
                        onSelectSection(section.id);
                        onClose();
                      }}
                      className={`flex items-center justify-between p-3 rounded-2xl border text-left transition-all ${
                        isActive
                          ? 'bg-yellow-400 border-white text-emerald-950 font-black shadow-md'
                          : isComplete
                          ? 'bg-emerald-950 border-emerald-500 text-emerald-100 hover:bg-emerald-800'
                          : 'bg-emerald-950/40 border-emerald-800 text-emerald-100 hover:bg-emerald-850'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-2xl shrink-0 leading-none">{section.flag}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={`text-[10px] font-mono font-black py-0.5 px-1.5 rounded ${
                              isActive ? 'bg-emerald-950 text-white' : 'bg-emerald-900 text-emerald-250'
                            }`}>
                              {section.id}
                            </span>
                            <span className={`text-[11px] font-black truncate ${isActive ? 'text-emerald-950' : 'text-white'}`}>{section.name}</span>
                          </div>
                          
                          {/* Progreso texto */}
                          <p className={`text-[10px] mt-1 font-semibold ${isActive ? 'text-emerald-900/85' : 'text-emerald-300'}`}>
                            {progress.pasted} de {progress.total} • <span className={isComplete ? "text-yellow-400 font-extrabold" : ""}>{progress.percentage}%</span>
                          </p>
                        </div>
                      </div>

                      {/* Icono de estatus */}
                      <div className="shrink-0 ml-1.5">
                        {isComplete ? (
                          <div className="bg-yellow-400 text-emerald-900 p-1 rounded-full shadow-sm">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        ) : isActive ? (
                          <div className="h-2.5 w-2.5 rounded-full bg-emerald-950" />
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>

              {filteredSections.length === 0 && (
                <div className="text-center py-8 text-emerald-350 text-xs font-semibold">
                  Ninguna sección coincide con "{filterQuery}"
                </div>
              )}
            </div>

            {/* Footer containing quick totals info */}
            <div className="p-4.5 bg-emerald-950 border-t border-emerald-900 shrink-0 text-center">
              <p className="text-[9px] text-emerald-400 font-black font-auto uppercase tracking-wider">
                Álbum Oficial de 48 Selecciones + FWC y Coca-Cola
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
