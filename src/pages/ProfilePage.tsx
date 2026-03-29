// src/pages/ProfilePage.tsx
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { User, Lock, Eye, EyeOff, KeyRound, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Change password state
  const [currentPw, setCurrentPw]     = useState('');
  const [newPw, setNewPw]             = useState('');
  const [confirmPw, setConfirmPw]     = useState('');
  const [error, setError]             = useState('');
  const [loading, setLoading]         = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Forgot password dialog state
  const [forgotOpen, setForgotOpen]         = useState(false);
  const [resetSent, setResetSent]           = useState(false);
  const [resetLoading, setResetLoading]     = useState(false);

  // ── Change password (requires knowing current password) ──────────────────
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!currentPw)          { setError('Enter your current password'); return; }
    if (newPw.length < 6)    { setError('New password must be at least 6 characters'); return; }
    if (newPw !== confirmPw) { setError('New passwords do not match'); return; }
    if (currentPw === newPw) { setError('New password must be different from current password'); return; }
    if (!user?.email)        { setError('No user email found'); return; }

    setLoading(true);
    try {
      // Step 1: verify current password by re-signing in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPw,
      });
      if (signInError) {
        setError('Current password is incorrect');
        return;
      }

      // Step 2: update to new password
      const { error: updateError } = await supabase.auth.updateUser({ password: newPw });
      if (updateError) throw updateError;

      toast({ title: 'Password updated', description: 'Your password has been changed successfully.' });
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    } catch (err: any) {
      setError(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot password: send reset email via Supabase ───────────────────────
  const handleForgotPassword = async () => {
    if (!user?.email) return;
    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setResetSent(true);
    } catch (err: any) {
      toast({
        title: 'Failed to send reset email',
        description: err.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setResetLoading(false);
    }
  };

  const handleForgotClose = () => {
    setForgotOpen(false);
    setResetSent(false);
  };

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Profile</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your account settings</p>
      </div>

      {/* ── User Info Card ─────────────────────────────────────────────────── */}
      <div className="bg-card rounded-xl border border-border p-6 animate-fade-in-up" style={{ animationFillMode: 'both' }}>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">{user?.name}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            <span className={cn(
              'inline-block mt-1 text-[11px] font-medium px-2 py-0.5 rounded-full capitalize',
              user?.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent'
            )}>
              {user?.role}
            </span>
          </div>
        </div>
      </div>

      {/* ── Change Password Card ───────────────────────────────────────────── */}
      <div
        className="bg-card rounded-xl border border-border p-6 animate-fade-in-up"
        style={{ animationDelay: '80ms', animationFillMode: 'both' }}
      >
        <div className="flex items-center gap-2 mb-5">
          <Lock className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Change Password</h2>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Current Password</Label>
            <div className="relative">
              <Input
                type={showCurrent ? 'text' : 'password'}
                value={currentPw}
                onChange={e => setCurrentPw(e.target.value)}
                placeholder="Enter current password"
                className="pr-10"
                disabled={loading}
              />
              <button type="button" onClick={() => setShowCurrent(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">New Password</Label>
            <div className="relative">
              <Input
                type={showNew ? 'text' : 'password'}
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                placeholder="Min 6 characters"
                className="pr-10"
                disabled={loading}
              />
              <button type="button" onClick={() => setShowNew(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Confirm New Password</Label>
            <div className="relative">
              <Input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                placeholder="Confirm new password"
                className="pr-10"
                disabled={loading}
              />
              <button type="button" onClick={() => setShowConfirm(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2 animate-fade-in">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => { setForgotOpen(true); setResetSent(false); }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              <KeyRound className="w-3 h-3" />
              Forgot current password?
            </button>
            <Button type="submit" size="sm" disabled={loading}
              className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {loading ? 'Updating…' : 'Update Password'}
            </Button>
          </div>
        </form>
      </div>

      {/* Hint for customers */}
      {user?.role === 'customer' && (
        <p className="text-xs text-muted-foreground px-1">
          Your default password is your registered phone number. Update it here after your first login.
        </p>
      )}

      {/* ── Forgot Password Dialog ─────────────────────────────────────────── */}
      <Dialog open={forgotOpen} onOpenChange={handleForgotClose}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              {resetSent
                ? 'Check your email for the reset link.'
                : `We'll send a password reset link to ${user?.email}`}
            </DialogDescription>
          </DialogHeader>

          {resetSent ? (
            // ── Success state ──────────────────────────────────────────────
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Mail className="w-5 h-5 text-emerald-600" />
              </div>
              <p className="text-sm text-center text-muted-foreground">
                A reset link has been sent to <span className="font-medium text-foreground">{user?.email}</span>.
                Open it to set a new password, then log back in.
              </p>
            </div>
          ) : (
            // ── Confirmation state ─────────────────────────────────────────
            <div className="py-2">
              <p className="text-sm text-muted-foreground">
                You'll be sent an email with a secure link to set a new password. This won't affect your current session.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleForgotClose}>
              {resetSent ? 'Close' : 'Cancel'}
            </Button>
            {!resetSent && (
              <Button
                onClick={handleForgotPassword}
                disabled={resetLoading}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {resetLoading ? 'Sending…' : 'Send Reset Email'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}