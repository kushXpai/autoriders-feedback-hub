import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Car, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const { login, resetPassword } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Reset password state
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetNewPw, setResetNewPw] = useState('');
  const [resetConfirmPw, setResetConfirmPw] = useState('');
  const [resetError, setResetError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    setTimeout(() => {
      const result = login(email, password);
      setLoading(false);
      if (result.success) {
        const account = email.toLowerCase();
        navigate(account === 'admin@exxon.com' ? '/admin' : '/customer');
      } else {
        setError(result.error || 'Login failed');
      }
    }, 400);
  };

  const handleReset = () => {
    setResetError('');
    if (!resetEmail) { setResetError('Enter your email'); return; }
    if (resetNewPw.length < 6) { setResetError('Password must be at least 6 characters'); return; }
    if (resetNewPw !== resetConfirmPw) { setResetError('Passwords do not match'); return; }
    const result = resetPassword(resetEmail, resetNewPw);
    if (result.success) {
      toast({ title: 'Password reset', description: 'Your password has been updated. You can now sign in.' });
      setResetOpen(false);
      setResetEmail('');
      setResetNewPw('');
      setResetConfirmPw('');
    } else {
      setResetError(result.error || 'Reset failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md animate-fade-in-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary mb-4">
            <Car className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">
            ExxonMobil Car Rental
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Feedback Management System</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <Input id="email" type="email" placeholder="Enter your email" value={email} onChange={e => setEmail(e.target.value)} required className="h-11" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} required className="h-11 pr-10" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2 animate-fade-in">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <button
            onClick={() => { setResetOpen(true); setResetEmail(email); setResetError(''); setResetNewPw(''); setResetConfirmPw(''); }}
            className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors mt-4"
          >
            Forgot password?
          </button>

          <div className="mt-6 pt-5 border-t border-border">
            <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wider">Demo Accounts</p>
            <div className="space-y-2">
              <button
                onClick={() => { setEmail('admin@exxon.com'); setPassword('admin123'); }}
                className="w-full text-left text-xs px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors active:scale-[0.98]"
              >
                <span className="font-medium text-foreground">Admin:</span>{' '}
                <span className="text-muted-foreground">admin@exxon.com / admin123</span>
              </button>
              <button
                onClick={() => { setEmail('customer@exxon.com'); setPassword('customer123'); }}
                className="w-full text-left text-xs px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors active:scale-[0.98]"
              >
                <span className="font-medium text-foreground">Customer:</span>{' '}
                <span className="text-muted-foreground">customer@exxon.com / customer123</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Reset Password Dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>Enter your email and choose a new password.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} placeholder="your@email.com" />
            </div>
            <div className="space-y-1.5">
              <Label>New Password</Label>
              <Input type="password" value={resetNewPw} onChange={e => setResetNewPw(e.target.value)} placeholder="Min 6 characters" />
            </div>
            <div className="space-y-1.5">
              <Label>Confirm Password</Label>
              <Input type="password" value={resetConfirmPw} onChange={e => setResetConfirmPw(e.target.value)} placeholder="Confirm new password" />
            </div>
            {resetError && (
              <p className="text-sm text-destructive">{resetError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>Cancel</Button>
            <Button onClick={handleReset} className="bg-accent hover:bg-accent/90 text-accent-foreground">Reset Password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
