/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Section, CollectionState } from './types';
import { buildInitialSections, loadCollectionState, saveCollectionState } from './data';
import Dashboard from './components/Dashboard';
import SectionModal from './components/SectionModal';
import CardGrid from './components/CardGrid';
import { Home, BookOpen, Globe, Info, Sparkles, Sliders } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  // Lista persistente de secciones con su estructura original
  const sections = useMemo(() => buildInitialSections(), []);

  // Estado reactivo para los contadores de las láminas
  const [collectionState, setCollectionState] = useState<CollectionState>(() => {
    return loadCollectionState();
  });

  // Pestaña activa actual: 'dashboard' | 'collection'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'collection'>('dashboard');

  // Sección nacional activa actual (predeterminada MEX, primera en la lista)
  const [activeSectionId, setActiveSectionId] = useState<string>('MEX');

  // Control de apertura del modal de selección
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Guardado automático en LocalStorage ante cualquier cambio
  useEffect(() => {
    saveCollectionState(collectionState);
  }, [collectionState]);

  // Actualizador para una lámina individual (delta puede ser +1 o -1)
  const handleUpdateCount = (cardId: string, delta: number) => {
    setCollectionState(prevState => {
      const current = prevState[cardId] || 0;
      const next = Math.max(0, current + delta); // Nunca menor de 0
      return {
        ...prevState,
        [cardId]: next,
      };
    });
  };

  // Acciones rápidas para cambiar todo el estado de una sección (ej: todas pegadas, o limpiar todas)
  const handleSetSectionAllState = (sectionId: string, stateValue: number) => {
    const targetSection = sections.find(s => s.id === sectionId);
    if (!targetSection) return;

    setCollectionState(prevState => {
      const nextState = { ...prevState };
      targetSection.cards.forEach(card => {
        nextState[card.id] = stateValue;
      });
      return nextState;
    });
  };

  // Reiniciar por completo la colección a 0
  const handleResetCollection = () => {
    setCollectionState({});
  };

  // Obtener el objeto de sección activo
  const activeSection = useMemo(() => {
    return sections.find(s => s.id === activeSectionId) || sections[0];
  }, [sections, activeSectionId]);

  // Manejar redireccionamiento rápido desde resultados de búsqueda o Top 10
  const handleJumpToSection = (sectionId: string) => {
    setActiveSectionId(sectionId);
    setActiveTab('collection');
  };

  return (
    <div className="bg-emerald-950 min-h-screen text-slate-100 flex flex-col font-sans select-none pb-24 antialiased">
      {/* GLOW DECORATIVO DE FONDO */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-md h-64 bg-yellow-400/5 rounded-full blur-3xl pointer-events-none z-0" />

      {/* TOP GLOSSY NAVBAR */}
      <header className="sticky top-0 z-40 bg-emerald-900/90 backdrop-blur-md border-b border-emerald-800 px-4 py-3.5 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center border-2 border-white shadow-inner shrink-0">
            <span className="text-emerald-950 font-black text-xs">26</span>
          </div>
          <span className="font-sans text-sm font-black tracking-tight text-white">
            ÁLBUM MUNDIAL <span className="text-yellow-400">2026</span>
          </span>
        </div>
        <div className="text-[9px] font-bold text-yellow-400 font-mono tracking-wider bg-emerald-850 px-2.5 py-1 rounded-full border border-emerald-700/80 uppercase">
          Local Storage Activo
        </div>
      </header>

      {/* MAIN CONTAINER (LIMITADO PARA VISTA MOBILE VERTICAL) */}
      <main className="flex-1 w-full max-w-sm mx-auto px-4 pt-4 z-10">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' ? (
            <motion.div
              key="dashboard-view"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.15 }}
            >
              <Dashboard
                sections={sections}
                collectionState={collectionState}
                onUpdateCount={handleUpdateCount}
                onSelectSection={handleJumpToSection}
                onResetCollection={handleResetCollection}
              />
            </motion.div>
          ) : (
            <motion.div
              key="collection-view"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="space-y-4"
            >
              {/* CardGrid Grid de láminas */}
              <CardGrid
                section={activeSection}
                collectionState={collectionState}
                onUpdateCount={handleUpdateCount}
                onSetSectionAllState={handleSetSectionAllState}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* BOTÓN FLOTANTE PARA CAMBIAR PAÍS (visible cuando estás en la pestaña de colección) */}
      <AnimatePresence>
        {activeTab === 'collection' && (
          <motion.button
            id="floating-country-selector-fab"
            initial={{ scale: 0, y: 100 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0, y: 100 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsModalOpen(true)}
            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-30 bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-emerald-950 font-black px-6 py-3.5 rounded-full shadow-[0_8px_30px_rgba(234,179,8,0.4)] flex items-center gap-2 text-xs border-2 border-white/20 uppercase tracking-wider"
          >
            <Globe className="w-5 h-5 animate-spin-slow text-emerald-950" />
            Cambiar Sección
          </motion.button>
        )}
      </AnimatePresence>

      {/* FOOTER BAR STICKY (Navegación tipo App de celular) */}
      <nav className="fixed bottom-0 inset-x-0 bg-emerald-900/95 backdrop-blur-md border-t border-emerald-800/80 z-40 pb-safe shadow-xl">
        <div className="max-w-sm mx-auto h-16 px-6 flex items-center justify-between">
          {/* TAB 1: RESUMEN */}
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition ${
              activeTab === 'dashboard' ? 'text-yellow-400 font-extrabold' : 'text-emerald-300/70 hover:text-emerald-100'
            }`}
          >
            <Home className="w-5.5 h-5.5 stroke-[2.5]" />
            <span className="text-[10px] font-bold mt-1 font-sans">Resumen</span>
          </button>

          {/* TAB 3: MIS LÁMINAS */}
          <button
            onClick={() => setActiveTab('collection')}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition tracking-tight ${
              activeTab === 'collection' ? 'text-yellow-400 font-extrabold' : 'text-emerald-300/70 hover:text-emerald-100'
            }`}
          >
            <BookOpen className="w-5.5 h-5.5 stroke-[2.5]" />
            <span className="text-[10px] font-bold mt-1 font-sans">Mis Láminas</span>
          </button>
        </div>
      </nav>

      {/* MODAL GLOBAL PARA SELECCIONAR SECCIÓN */}
      <SectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        sections={sections}
        activeSectionId={activeSectionId}
        onSelectSection={handleJumpToSection}
        collectionState={collectionState}
      />
    </div>
  );
}
