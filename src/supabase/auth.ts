// src/supabase/auth.ts
import { supabase } from './client';
import type { User } from '@/contexts/AuthContext';
import type { Profile, UserRole as DBUserRole } from '@/types/database.types';

export const signIn = async (
  email: string,
  password: string
): Promise<User | null> => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error('Login error:', error.message);
    return null;
  }
  if (!data.user) return null;

  // Fetch profile — maybeSingle() returns null instead of 406 when RLS blocks or row missing
  const { data: profileRaw, error: profileError } = await supabase
    .from('profiles')
    .select('name, email')
    .eq('id', data.user.id)
    .maybeSingle();

  if (profileError) {
    console.error('Failed to fetch profile:', profileError.message);
    return null;
  }
  if (!profileRaw) {
    console.error('No profile row found for user:', data.user.id);
    return null;
  }

  const profile = profileRaw as Pick<Profile, 'name' | 'email'>;

  // Fetch role — maybeSingle() returns null instead of 406 when RLS blocks or row missing
  const { data: roleRaw, error: roleError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', data.user.id)
    .maybeSingle();

  if (roleError) {
    console.error('Failed to fetch role:', roleError.message);
    return null;
  }
  if (!roleRaw) {
    console.error('No role row found for user:', data.user.id);
    return null;
  }

  const roleRow = roleRaw as Pick<DBUserRole, 'role'>;

  return {
    id: data.user.id,
    name: profile.name,
    email: profile.email,
    role: roleRow.role,
  };
};

export const signOut = async (): Promise<void> => {
  const { error } = await supabase.auth.signOut();
  if (error) console.error('Logout error:', error.message);
};

export const sendPasswordResetEmail = async (email: string): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
};

export const updatePassword = async (newPassword: string): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { success: false, error: error.message };
  return { success: true };
};