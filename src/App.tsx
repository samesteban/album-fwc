/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Section, CollectionState } from './types';
import {
  buildInitialSections,
  loadCollectionState,
  loadTimestamps,
  saveCollectionState,
  updateCardCount,
  migrateFromV1,
  hasLegacyData,
} from './data';
import { useAuth } from './providers/AuthProvider';
import { useSync } from './hooks/useSync';
import Dashboard from './components/Dashboard';
import SectionModal from './components/SectionModal';
import CardGrid from './components/CardGrid';
import LoginScreen from './components/LoginScreen';
import AlbumPage from './components/AlbumPage';
import TradeMatchPage from './components/TradeMatchPage';
import { Home, BookOpen, Globe, Info, Sparkles, Sliders } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const { user, profile } = useAuth();
  const sync = useSync();

  // ── SPA route matching ──────────────────────────────────────

  const [currentRoute, setCurrentRoute] = useState<'app' | 'album' | 'trade-match'>(() => {
    if (window.location.pathname.match(/^\/album\/([a-zA-Z0-9_-]+)$/)) return 'album';
    if (window.location.pathname === '/match') return 'trade-match';
    return 'app';
  });

  const [albumShareId, setAlbumShareId] = useState<string | null>(() => {
    const match = window.location.pathname.match(/^\/album\/([a-zA-Z0-9_-]+)$/);
    return match ? match[1] : null;
  });

  useEffect(() => {
    const handleLocationChange = () => {
      const path = window.location.pathname;
      if (path === '/match') {
        setCurrentRoute('trade-match');
        setAlbumShareId(null);
      } else {
        const match = path.match(/^\/album\/([a-zA-Z0-9_-]+)$/);
        if (match) {
          setCurrentRoute('album');
          setAlbumShareId(match[1]);
        } else {
          setCurrentRoute('app');
          setAlbumShareId(null);
        }
      }
    };

    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  // Lista persistente de secciones con su estructura original
  const sections = useMemo(() => buildInitialSections(), []);

  // Estado reactivo para los contadores de las láminas
  const [collectionState, setCollectionState] = useState<CollectionState>(() => {
    return loadCollectionState();
  });

  // Estado reactivo para los timestamps por lámina
  const [timestamps, setTimestamps] = useState<Record<string, string>>(() => {
    return loadTimestamps();
  });

  // Pestaña activa actual
  const [activeTab, setActiveTab] = useState<'dashboard' | 'collection'>('dashboard');

  // Sección activa
  const [activeSectionId, setActiveSectionId] = useState<string>('MEX');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);

  // ── Sync on login ──────────────────────────────────────────

  const [hasRunFirstSync, setHasRunFirstSync] = useState(false);

  useEffect(() => {
    if (!user || hasRunFirstSync) return;

    // Check if we need to migrate from v1
    const isFirstSync = hasLegacyData();
    const localTimestamps = isFirstSync ? migrateFromV1() : timestamps;

    sync.triggerSync(user.id, collectionState, localTimestamps, isFirstSync).then(result => {
      if (result) {
        setCollectionState(result.merged);
        setTimestamps(result.timestamps);
        saveCollectionState(result.merged, result.timestamps);
      }
    });

    setHasRunFirstSync(true);
  }, [user, hasRunFirstSync]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Guardado automático en LocalStorage ─────────────────────

  useEffect(() => {
    saveCollectionState(collectionState, timestamps);
  }, [collectionState, timestamps]);

  // ── Mutations ──────────────────────────────────────────────

  const handleUpdateCount = useCallback(
    (cardId: string, delta: number) => {
      setCollectionState(prevCollection => {
        setTimestamps(prevTimestamps => {
          const { collection, timestamps: newTimestamps } = updateCardCount(
            prevCollection,
            prevTimestamps,
            cardId,
            delta
          );

          // Trigger debounced sync
          if (user) {
            sync.onCardUpdate(user.id, collection, newTimestamps);
          }

          saveCollectionState(collection, newTimestamps);
          return newTimestamps;
        });

        const current = prevCollection[cardId] || 0;
        const next = Math.max(0, current + delta);
        return { ...prevCollection, [cardId]: next };
      });
    },
    [user, sync]
  );

  // Acciones rápidas para marcar/limpiar sección completa
  const handleSetSectionAllState = useCallback(
    (sectionId: string, stateValue: number) => {
      const targetSection = sections.find(s => s.id === sectionId);
      if (!targetSection) return;

      setCollectionState(prevCollection => {
        const nextState = { ...prevCollection };
        const now = new Date().toISOString();

        setTimestamps(prevTimestamps => {
          const nextTimestamps = { ...prevTimestamps };
          targetSection.cards.forEach(card => {
            nextState[card.id] = stateValue;
            nextTimestamps[card.id] = now;
          });

          if (user) {
            sync.onCardUpdate(user.id, nextState, nextTimestamps);
          }

          saveCollectionState(nextState, nextTimestamps);
          return nextTimestamps;
        });

        return nextState;
      });
    },
    [sections, user, sync]
  );

  // Reiniciar colección
  const handleResetCollection = useCallback(() => {
    const now = new Date().toISOString();
    setCollectionState({});
    setTimestamps({});
    saveCollectionState({}, {});
  }, []);

  // ── Helper ──────────────────────────────────────────────────

  const activeSection = useMemo(() => {
    return sections.find(s => s.id === activeSectionId) || sections[0];
  }, [sections, activeSectionId]);

  const handleJumpToSection = (sectionId: string) => {
    setActiveSectionId(sectionId);
    setActiveTab('collection');
  };

  const syncStatus = sync.status;

  // ── Toast de sync al cargar la página ───────────────────────
  const [syncToast, setSyncToast] = useState<string | null>(null);
  const hasShownSyncToast = useRef(false);

  useEffect(() => {
    if (hasShownSyncToast.current) return;
    if (syncStatus === 'synced') {
      hasShownSyncToast.current = true;
      setSyncToast('Sincronizado');
      setTimeout(() => setSyncToast(null), 3000);
    } else if (syncStatus === 'error' || syncStatus === 'offline') {
      hasShownSyncToast.current = true;
      setSyncToast('Sin conexión');
      setTimeout(() => setSyncToast(null), 4000);
    }
  }, [syncStatus]);

  // ── SPA route rendering ─────────────────────────────────────

  if (currentRoute === 'trade-match') {
    return <TradeMatchPage />;
  }

  if (currentRoute === 'album' && albumShareId) {
    return <AlbumPage shareId={albumShareId} />;
  }

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
        <div className="flex items-center gap-2">
          <LoginScreen />
          {user && (
            <div className={`text-[9px] font-bold font-mono tracking-wider px-2.5 py-1 rounded-full uppercase border transition-all ${
              syncStatus === 'synced'
                ? 'text-emerald-300 bg-emerald-850 border-emerald-700/80'
                : syncStatus === 'syncing'
                ? 'text-yellow-400 bg-yellow-400/10 border-yellow-400/40 animate-pulse'
                : syncStatus === 'error' || syncStatus === 'offline'
                ? 'text-red-400 bg-red-400/10 border-red-400/40'
                : 'text-emerald-400 bg-emerald-850 border-emerald-700/80'
            }`}>
              {syncStatus === 'synced' && 'Sync OK'}
              {syncStatus === 'syncing' && 'Sync...'}
              {syncStatus === 'error' && 'Error'}
              {syncStatus === 'offline' && 'Offline'}
              {syncStatus === 'idle' && 'Local'}
            </div>
          )}
          {!user && (
            <div className="text-[9px] font-bold text-emerald-400 font-mono tracking-wider bg-emerald-850 px-2.5 py-1 rounded-full border border-emerald-700/80 uppercase">
              Local
            </div>
          )}
        </div>
      </header>

      {/* MAIN CONTAINER */}
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
                userDisplayName={user ? (profile?.display_name ?? null) : undefined}
                userShareId={profile?.share_id}
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

      {/* FLOATING BUTTON */}
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

      {/* FOOTER BAR */}
      <nav className="fixed bottom-0 inset-x-0 bg-emerald-900/95 backdrop-blur-md border-t border-emerald-800/80 z-40 pb-safe shadow-xl">
        <div className="max-w-sm mx-auto h-16 px-3 flex items-center justify-between">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition ${
              activeTab === 'dashboard' ? 'text-yellow-400 font-extrabold' : 'text-emerald-300/70 hover:text-emerald-100'
            }`}
          >
            <Home className="w-5.5 h-5.5 stroke-[2.5]" />
            <span className="text-[10px] font-bold mt-1 font-sans">Resumen</span>
          </button>

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

      {/* SECTION MODAL */}
      <SectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        sections={sections}
        activeSectionId={activeSectionId}
        onSelectSection={handleJumpToSection}
        collectionState={collectionState}
      />

      {/* SYNC TOAST */}
      {syncToast && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50"
        >
          <div className="bg-emerald-900/95 backdrop-blur-md border border-emerald-700/70 px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2.5">
            <div className={`w-2 h-2 rounded-full ${
              syncToast === 'Sincronizado' ? 'bg-emerald-400' : 'bg-red-400'
            }`} />
            <span className="text-[11px] font-bold text-emerald-100 font-sans">{syncToast}</span>
          </div>
        </motion.div>
      )}
    </div>
  );
}
