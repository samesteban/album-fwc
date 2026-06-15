/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import { nanoid } from 'nanoid';
import { Share2, RefreshCw, Copy, Check, Loader2, AlertCircle, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { CollectionState, ShareGenerationState, ShareMetadata } from '../types';

interface ShareButtonProps {
  collectionState: CollectionState;
  displayName: string | null;
  userShareId?: string | null;
  userId?: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const STORAGE_KEY = 'album_share_metadata';

export default function ShareButton({ collectionState, displayName, userShareId, userId }: ShareButtonProps) {
  const [state, setState] = useState<ShareGenerationState>('idle');
  const [shareUrl, setShareUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [savedMeta, setSavedMeta] = useState<ShareMetadata | null>(null);

  const isCollectionEmpty = Object.keys(collectionState).length === 0;

  // Load saved share metadata on mount
  useEffect(() => {
    if (userShareId) {
      // Logged in: short ID from Supabase profile (same across devices)
      setSavedMeta({ shareId: userShareId, createdAt: '' });
      setShareUrl(`${window.location.origin}/album/${userShareId}`);
      return;
    }

    // Anonymous: load from localStorage
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const meta: ShareMetadata = JSON.parse(raw);
        if (meta.shareId) {
          setSavedMeta(meta);
          setShareUrl(`${window.location.origin}/album/${meta.shareId}`);
        }
      }
    } catch {
      // Ignore corrupted data
    }
  }, [userShareId]);

  const saveMetadata = (shareId: string) => {
    const meta: ShareMetadata = { shareId, createdAt: new Date().toISOString() };
    if (!userShareId) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
    }
    setSavedMeta(meta);
  };

  const persistShareId = useCallback(async (shareId: string) => {
    if (!userId) return;
    const { error } = await supabase
      .from('profiles')
      .update({ share_id: shareId })
      .eq('id', userId)
      .is('share_id', null);
    if (error) console.error('Failed to persist share_id:', error);
  }, [userId]);

  const clearMetadata = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSavedMeta(null);
  };

  const handleShare = useCallback(async () => {
    setState('generating');

    try {
      // Always prefer profile ID (same across devices), then localStorage, then generate new
      const shareId = userShareId ?? savedMeta?.shareId ?? nanoid(7);
      const createdAt = new Date().toISOString();

      const blob = {
        name: displayName,
        collectionState,
        createdAt,
      };

      const jsonContent = JSON.stringify(blob);
      const file = new File([jsonContent], `${shareId}.json`, { type: 'application/json' });

      const { error: uploadError } = await supabase.storage
        .from('album-shares')
        .upload(`public/${shareId}.json`, file, {
          contentType: 'application/json',
          upsert: true, // Allow overwriting existing share
        });

      if (uploadError) {
        console.error('Error uploading share:', { message: uploadError.message, cause: uploadError.cause, shareId });
        setState('error');
        return;
      }

      // Persist ID on first generation
      if (!savedMeta) {
        saveMetadata(shareId);
      }

      // Persist short ID to Supabase profile for cross-device consistency
      if (!userShareId) {
        persistShareId(shareId);
      }

      setShareUrl(`${window.location.origin}/album/${shareId}`);
      setState('done');
    } catch (err) {
      console.error('Error sharing album:', err);
      setState('error');
    }
  }, [collectionState, displayName, savedMeta, userShareId, persistShareId]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [shareUrl]);

  const handleCopyId = useCallback(async () => {
    try {
      const id = savedMeta?.shareId ?? (shareUrl.split('/').pop() || '');
      await navigator.clipboard.writeText(id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      setCopiedId(false);
    }
  }, [shareUrl, savedMeta]);

  const handleReset = useCallback(() => {
    setState('idle');
    setCopied(false);
    setCopiedId(false);
    // Keep savedMeta — user can still update the existing link
  }, []);

  const handleUnlink = useCallback(() => {
    clearMetadata();
    setState('idle');
    setShareUrl('');
    setCopied(false);
    setCopiedId(false);
  }, []);

  if (isCollectionEmpty) return null;

  return (
    <div className="bg-emerald-900/60 border border-emerald-800/80 p-4 rounded-3xl shadow-md">
      {/* ── IDLE: No existing share ─────────────────────────── */}
      {state === 'idle' && !savedMeta && (
        <button
          onClick={handleShare}
          className="w-full bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-emerald-950 font-black py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 text-sm uppercase tracking-wider shadow-lg transition-all active:scale-[0.98] border border-yellow-300/40"
        >
          <Share2 className="w-5 h-5 stroke-[2.5]" />
          Compartir mi Álbum
        </button>
      )}

      {/* ── IDLE: Existing share — show update option ──────── */}
      {state === 'idle' && savedMeta && (
        <div className="space-y-2">
          <button
            onClick={handleShare}
            className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-black py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 text-sm uppercase tracking-wider shadow-lg transition-all active:scale-[0.98] border border-emerald-400/30"
          >
            <RefreshCw className="w-5 h-5 stroke-[2.5]" />
            Actualizar mi Álbum
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleCopy}
              className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-800 hover:bg-emerald-700 text-white'
              }`}
            >
              {copied ? (
                <><Check className="w-3.5 h-3.5" /> Copiado</>
              ) : (
                <><Copy className="w-3.5 h-3.5" /> Copiar URL</>
              )}
            </button>
            <button
              onClick={handleCopyId}
              className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${
                copiedId
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-800 hover:bg-emerald-700 text-white'
              }`}
            >
              {copiedId ? (
                <><Check className="w-3.5 h-3.5" /> Copiado</>
              ) : (
                <><Copy className="w-3.5 h-3.5" /> Copiar ID</>
              )}
            </button>
          </div>
          <button
            onClick={handleUnlink}
            className="w-full text-[11px] text-red-400/70 hover:text-red-300 font-bold uppercase tracking-wider transition flex items-center justify-center gap-1.5 py-2"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Desvincular
          </button>
        </div>
      )}

      {/* ── GENERATING ──────────────────────────────────────── */}
      {state === 'generating' && (
        <div className="flex items-center justify-center gap-2.5 py-3">
          <Loader2 className="w-5 h-5 animate-spin text-yellow-400" />
          <span className="text-sm font-bold text-emerald-200">
            {savedMeta ? 'Actualizando...' : 'Generando enlace...'}
          </span>
        </div>
      )}

      {/* ── DONE ────────────────────────────────────────────── */}
      {state === 'done' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-yellow-400 uppercase tracking-wider font-mono">
              {savedMeta ? 'Álbum actualizado' : 'Enlace generado'}
            </h3>
            <button
              onClick={handleReset}
              className="text-[10px] text-emerald-400 hover:text-emerald-200 font-bold uppercase tracking-wider transition"
            >
              Nuevo
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleCopy}
              className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-yellow-400 hover:bg-yellow-300 text-emerald-950'
              }`}
            >
              {copied ? (
                <><Check className="w-3.5 h-3.5" /> Copiado</>
              ) : (
                <><Copy className="w-3.5 h-3.5" /> Copiar URL</>
              )}
            </button>
            <button
              onClick={handleCopyId}
              className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${
                copiedId
                  ? 'bg-emerald-600 text-white'
                  : 'bg-yellow-400 hover:bg-yellow-300 text-emerald-950'
              }`}
            >
              {copiedId ? (
                <><Check className="w-3.5 h-3.5" /> Copiado</>
              ) : (
                <><Copy className="w-3.5 h-3.5" /> Copiar ID</>
              )}
            </button>
          </div>

          <p className="text-[10px] text-emerald-400 leading-relaxed text-center font-medium">
            {savedMeta
              ? 'Tus cambios están publicados. Cualquier persona con el enlace ve la versión actualizada.'
              : 'Cualquier persona con este enlace puede ver tu álbum actual.'}
          </p>
        </div>
      )}

      {/* ── ERROR ───────────────────────────────────────────── */}
      {state === 'error' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 py-2">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <p className="text-xs font-bold text-red-300">
              No se pudo {savedMeta ? 'actualizar' : 'generar'} el enlace. Intenta de nuevo.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleShare}
              className="flex-1 bg-emerald-800 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider transition"
            >
              Reintentar
            </button>
            <button
              onClick={handleReset}
              className="flex-1 bg-emerald-950 border border-emerald-700/60 hover:bg-emerald-900 text-emerald-300 font-bold py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
