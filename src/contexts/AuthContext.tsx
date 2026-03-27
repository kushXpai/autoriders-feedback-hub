import React, { createContext, useContext, useState, useCallback } from 'react';
export type UserRole = 'admin' | 'customer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => { success: boolean; error?: string };
  logout: () => void;
  resetPassword: (email: string, newPassword: string) => { success: boolean; error?: string };
  changePassword: (currentPassword: string, newPassword: string) => { success: boolean; error?: string };
  isAuthenticated: boolean;
}

const INITIAL_ACCOUNTS: Record<string, { password: string; user: User }> = {
  'admin@exxon.com': {
    password: 'admin123',
    user: { id: '1', name: 'Sarah Mitchell', email: 'admin@exxon.com', role: 'admin' },
  },
  'customer@exxon.com': {
    password: 'customer123',
    user: { id: '2', name: 'James Henderson', email: 'customer@exxon.com', role: 'customer' },
  },
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accounts, setAccounts] = useState(INITIAL_ACCOUNTS);

  const login = useCallback((email: string, password: string) => {
    const account = accounts[email.toLowerCase()];
    if (!account) return { success: false, error: 'Invalid email or password' };
    if (account.password !== password) return { success: false, error: 'Invalid email or password' };
    setUser(account.user);
    return { success: true };
  }, [accounts]);

  const logout = useCallback(() => setUser(null), []);

  const resetPassword = useCallback((email: string, newPassword: string) => {
    const key = email.toLowerCase();
    const account = accounts[key];
    if (!account) return { success: false, error: 'No account found with this email' };
    if (newPassword.length < 6) return { success: false, error: 'Password must be at least 6 characters' };
    setAccounts(prev => ({
      ...prev,
      [key]: { ...prev[key], password: newPassword },
    }));
    return { success: true };
  }, [accounts]);

  const changePassword = useCallback((currentPassword: string, newPassword: string) => {
    if (!user) return { success: false, error: 'Not logged in' };
    const key = user.email.toLowerCase();
    const account = accounts[key];
    if (!account) return { success: false, error: 'Account not found' };
    if (account.password !== currentPassword) return { success: false, error: 'Current password is incorrect' };
    if (newPassword.length < 6) return { success: false, error: 'New password must be at least 6 characters' };
    setAccounts(prev => ({
      ...prev,
      [key]: { ...prev[key], password: newPassword },
    }));
    return { success: true };
  }, [user, accounts]);

  return (
    <AuthContext.Provider value={{ user, login, logout, resetPassword, changePassword, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
