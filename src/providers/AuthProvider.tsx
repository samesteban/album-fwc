/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AuthProvider — Supabase Auth context with Google OAuth.
 * Wraps the app and provides session state, login, and logout.
 */

import React, { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface ProfileRow {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface AuthState {
  session: Session | null;
  user: User | null;
  profile: ProfileRow | null;
  isLoading: boolean;
}

export interface AuthContextValue extends AuthState {
  signInWithGoogle: () => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    profile: null,
    isLoading: true,
  });

  // Fetch or create the user's profile row
  const syncProfile = useCallback(async (userId: string, userMeta?: User['user_metadata']) => {
    // Try to get existing profile
    const { data: existing } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single<ProfileRow>();

    if (existing) {
      setState(prev => ({ ...prev, profile: existing }));
      return existing;
    }

    // Create new profile from Google metadata
    const { data: created } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        display_name: userMeta?.name ?? userMeta?.full_name ?? null,
        avatar_url: userMeta?.avatar_url ?? userMeta?.picture ?? null,
      })
      .select()
      .single();

    const profile: ProfileRow = created as ProfileRow ?? {
      id: userId,
      display_name: null,
      avatar_url: null,
      created_at: new Date().toISOString(),
    };

    setState(prev => ({ ...prev, profile }));
    return profile;
  }, []);

  // Initial session check
  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (cancelled) return;

      if (session?.user) {
        const profile = await syncProfile(session.user.id, session.user.user_metadata);
        if (!cancelled) {
          setState({
            session,
            user: session.user,
            profile,
            isLoading: false,
          });
        }
      } else {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (cancelled) return;

        if (session?.user) {
          const profile = await syncProfile(session.user.id, session.user.user_metadata);
          if (!cancelled) {
            setState({
              session,
              user: session.user,
              profile,
              isLoading: false,
            });
          }
        } else {
          setState({
            session: null,
            user: null,
            profile: null,
            isLoading: false,
          });
        }
      }
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [syncProfile]);

  const signInWithGoogle = useCallback(async () => {
    const result = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
    return { error: result.error };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }
  return ctx;
}
