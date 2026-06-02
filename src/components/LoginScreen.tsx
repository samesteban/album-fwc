/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * LoginScreen — Google OAuth login and user profile display.
 */

import React from 'react';
import { LogIn, LogOut, User, Loader2 } from 'lucide-react';
import { useAuth } from '../providers/AuthProvider';

export default function LoginScreen() {
  const { user, profile, isLoading, signInWithGoogle, signOut } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-emerald-300 text-xs">
        <Loader2 className="w-4 h-4 animate-spin" />
        Cargando sesión...
      </div>
    );
  }

  if (user && profile) {
    return (
      <div className="flex items-center gap-2">
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={profile.display_name ?? 'User'}
            className="w-7 h-7 rounded-full border-2 border-yellow-400 object-cover shrink-0"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-emerald-700 flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-emerald-200" />
          </div>
        )}
        <span className="text-[11px] font-bold text-emerald-200 truncate max-w-[100px] hidden sm:block">
          {profile.display_name ?? 'Usuario'}
        </span>
        <button
          onClick={signOut}
          className="p-1.5 text-emerald-400 hover:text-red-400 hover:bg-emerald-800/50 rounded-lg transition-all"
          title="Cerrar sesión"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => signInWithGoogle()}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold rounded-xl transition-all border border-emerald-700/50 hover:border-yellow-400/50"
    >
      <LogIn className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">Sync</span>
    </button>
  );
}
