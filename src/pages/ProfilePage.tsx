import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { User, Lock, Eye, EyeOff, KeyRound } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ProfilePage() {
  const { user, changePassword, resetPassword } = useAuth();
  const { toast } = useToast();

  // Change password state
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [error, setError] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  // Forgot password dialog
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotNewPw, setForgotNewPw] = useState('');
  const [forgotConfirmPw, setForgotConfirmPw] = useState('');
  const [forgotError, setForgotError] = useState('');

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!currentPw) { setError('Enter your current password'); return; }
    if (newPw.length < 6) { setError('New password must be at least 6 characters'); return; }
    if (newPw !== confirmPw) { setError('New passwords do not match'); return; }
    if (currentPw === newPw) { setError('New password must be different from current password'); return; }
    const result = changePassword(currentPw, newPw);
    if (result.success) {
      toast({ title: 'Password updated', description: 'Your password has been changed successfully.' });
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    } else {
      setError(result.error || 'Failed to change password');
    }
  };

  const handleForgotReset = () => {
    setForgotError('');
    if (!user) return;
    if (forgotNewPw.length < 6) { setForgotError('Password must be at least 6 characters'); return; }
    if (forgotNewPw !== forgotConfirmPw) { setForgotError('Passwords do not match'); return; }
    const result = resetPassword(user.email, forgotNewPw);
    if (result.success) {
      toast({ title: 'Password reset', description: 'Your password has been reset successfully.' });
      setForgotOpen(false);
      setForgotNewPw('');
      setForgotConfirmPw('');
    } else {
      setForgotError(result.error || 'Reset failed');
    }
  };

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Profile</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your account settings</p>
      </div>

      {/* User Info Card */}
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

      {/* Change Password Card */}
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
              />
              <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
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
              />
              <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Confirm New Password</Label>
            <Input
              type="password"
              value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)}
              placeholder="Confirm new password"
            />
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2 animate-fade-in">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => { setForgotOpen(true); setForgotError(''); setForgotNewPw(''); setForgotConfirmPw(''); }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              <KeyRound className="w-3 h-3" />
              Forgot current password?
            </button>
            <Button type="submit" size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
              Update Password
            </Button>
          </div>
        </form>
      </div>

      {/* Forgot Password Dialog */}
      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>Set a new password for {user?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>New Password</Label>
              <Input type="password" value={forgotNewPw} onChange={e => setForgotNewPw(e.target.value)} placeholder="Min 6 characters" />
            </div>
            <div className="space-y-1.5">
              <Label>Confirm Password</Label>
              <Input type="password" value={forgotConfirmPw} onChange={e => setForgotConfirmPw(e.target.value)} placeholder="Confirm new password" />
            </div>
            {forgotError && <p className="text-sm text-destructive">{forgotError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setForgotOpen(false)}>Cancel</Button>
            <Button onClick={handleForgotReset} className="bg-accent hover:bg-accent/90 text-accent-foreground">Reset Password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
