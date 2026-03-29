// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/supabase/client';
import { signIn, signOut, updatePassword } from '@/supabase/auth';
import type { AppRole, Profile, UserRole as DBUserRole } from '@/types/database.types';

export type UserRole = 'admin' | 'customer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (email: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Ref to track whether the initial session restore has finished.
  // The onAuthStateChange listener must NOT touch loading state until
  // restoreSession has completed — otherwise they race and loading
  // never gets set to false.
  const sessionRestored = useRef(false);

  /* ---------------- LOAD USER PROFILE ---------------- */
  const loadUserProfile = useCallback(async (userId: string): Promise<boolean> => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('name, email')
        .eq('id', userId)
        .single();

      if (profileError || !profileData) throw profileError ?? new Error('No profile data');

      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();

      if (roleError || !roleData) throw roleError ?? new Error('No role data');

      const profile = profileData as Pick<Profile, 'name' | 'email'>;
      const roleRow = roleData as Pick<DBUserRole, 'role'>;

      setUser({
        id: userId,
        name: profile.name,
        email: profile.email,
        role: roleRow.role as AppRole,
      });

      return true;
    } catch (err) {
      console.error('Error loading user profile:', err);
      setUser(null);
      return false;
    }
  }, []);

  /* ---------------- RESTORE SESSION ON MOUNT ---------------- */
  // Strategy: call getSession() once to get the persisted session,
  // then set up the listener. This guarantees setLoading(false) is
  // always called regardless of what the listener does later.
  useEffect(() => {
    let mounted = true;

    const restoreSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && mounted) {
          await loadUserProfile(session.user.id);
        }
      } catch (err) {
        console.error('Session restore failed:', err);
        if (mounted) setUser(null);
      } finally {
        if (mounted) {
          sessionRestored.current = true;
          setLoading(false); // always unblock the UI
        }
      }
    };

    restoreSession();

    // Only respond to changes AFTER the initial restore is done.
    // SIGNED_IN on first load is already handled by getSession() above;
    // listening for it here too causes the race that freezes the app.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Ignore events that fire before restoreSession finishes
        if (!sessionRestored.current) return;

        if (event === 'SIGNED_IN' && session?.user) {
          await loadUserProfile(session.user.id);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          // Session token was silently refreshed — make sure profile is still set
          if (!user) {
            await loadUserProfile(session.user.id);
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadUserProfile]);

  /* ---------------- LOGIN ---------------- */
  const login = useCallback(async (email: string, password: string) => {
    try {
      const result = await signIn(email, password);

      if (!result) {
        return { success: false, error: 'Invalid email or password' };
      }

      await loadUserProfile(result.id);
      return { success: true };
    } catch {
      return { success: false, error: 'Something went wrong. Please try again.' };
    }
  }, [loadUserProfile]);

  /* ---------------- LOGOUT ---------------- */
  const logout = useCallback(async () => {
    await signOut();
    setUser(null);
  }, []);

  /* ---------------- CHANGE PASSWORD ---------------- */
  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    if (!user) return { success: false, error: 'Not logged in' };

    const { error: reAuthError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (reAuthError) {
      return { success: false, error: 'Current password is incorrect' };
    }

    return updatePassword(newPassword);
  }, [user]);

  /* ---------------- RESET PASSWORD ---------------- */
  // Sends a password-reset email. The user clicks the link in the email
  // and lands on /reset-password where they can set a new password via
  // supabase.auth.updateUser(). The newPassword param is intentionally
  // unused here because Supabase handles it through the redirect flow.
  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  }, []);

  /* ---------------- PROVIDER ---------------- */
  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loading,
        login,
        logout,
        changePassword,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/* ---------------- HOOK ---------------- */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}