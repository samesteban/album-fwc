/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback } from 'react';
import { nanoid } from 'nanoid';
import { Share2, Copy, Check, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { CollectionState, ShareGenerationState } from '../types';

interface ShareButtonProps {
  collectionState: CollectionState;
  displayName: string | null;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export default function ShareButton({ collectionState, displayName }: ShareButtonProps) {
  const [state, setState] = useState<ShareGenerationState>('idle');
  const [shareUrl, setShareUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const isCollectionEmpty = Object.keys(collectionState).length === 0;

  const handleShare = useCallback(async () => {
    setState('generating');

    try {
      const shareId = nanoid(7);
      const createdAt = new Date().toISOString();

      const blob: { name: string | null; collectionState: CollectionState; createdAt: string } = {
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
          upsert: false,
        });

      if (uploadError) {
        console.error('Error al subir el share:', uploadError);
        setState('error');
        return;
      }

      const url = `${SUPABASE_URL}/storage/v1/object/public/album-shares/public/${shareId}.json`;
      const displayUrl = `${window.location.origin}/album/${shareId}`;

      setShareUrl(displayUrl);
      setState('done');
    } catch (err) {
      console.error('Error al generar el share:', err);
      setState('error');
    }
  }, [collectionState, displayName]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the text manually
      setCopied(false);
    }
  }, [shareUrl]);

  const handleReset = useCallback(() => {
    setState('idle');
    setShareUrl('');
    setCopied(false);
  }, []);

  if (isCollectionEmpty) return null;

  return (
    <div className="bg-emerald-900/60 border border-emerald-800/80 p-4 rounded-3xl shadow-md">
      {state === 'idle' && (
        <button
          onClick={handleShare}
          className="w-full bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-emerald-950 font-black py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 text-sm uppercase tracking-wider shadow-lg transition-all active:scale-[0.98] border border-yellow-300/40"
        >
          <Share2 className="w-5 h-5 stroke-[2.5]" />
          Compartir mi Álbum
        </button>
      )}

      {state === 'generating' && (
        <div className="flex items-center justify-center gap-2.5 py-3">
          <Loader2 className="w-5 h-5 animate-spin text-yellow-400" />
          <span className="text-sm font-bold text-emerald-200">
            Generando enlace...
          </span>
        </div>
      )}

      {state === 'done' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-yellow-400 uppercase tracking-wider font-mono">
              Enlace generado
            </h3>
            <button
              onClick={handleReset}
              className="text-[10px] text-emerald-400 hover:text-emerald-200 font-bold uppercase tracking-wider transition"
            >
              Nuevo
            </button>
          </div>

          <div className="flex items-center gap-2 bg-emerald-950 border border-emerald-700/60 rounded-2xl px-3.5 py-3">
            <span className="flex-1 text-xs font-mono text-emerald-100 truncate select-all">
              {shareUrl}
            </span>
            <button
              onClick={handleCopy}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-yellow-400 hover:bg-yellow-300 text-emerald-950'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copiar
                </>
              )}
            </button>
          </div>

          <p className="text-[10px] text-emerald-400 leading-relaxed text-center font-medium">
            Cualquier persona con este enlace puede ver tu álbum actual.
          </p>
        </div>
      )}

      {state === 'error' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 py-2">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <p className="text-xs font-bold text-red-300">
              No se pudo generar el enlace. Intentá de nuevo.
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
