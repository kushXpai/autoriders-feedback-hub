// src/pages/LoginPage.tsx
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';

export default function LoginPage() {
  const { login, resetPassword, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');

  /* AUTO REDIRECT */
  if (!authLoading && isAuthenticated) {
    navigate('/', { replace: true });
  }

  /* LOGIN */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(email, password);
    setLoading(false);

    if (result.success) {
      navigate('/', { replace: true });
    } else {
      setError(result.error || 'Login failed');
    }
  };

  /* RESET PASSWORD */
  const handleReset = async () => {
    setResetError('');

    if (!resetEmail) {
      setResetError('Enter your email');
      return;
    }

    setResetLoading(true);
    const result = await resetPassword(resetEmail, '');
    setResetLoading(false);

    if (result.success) {
      toast({
        title: 'Reset email sent',
        description: 'Check your inbox for a password reset link.',
      });
      setResetOpen(false);
      setResetEmail('');
    } else {
      setResetError(result.error || 'Reset failed');
    }
  };

  return (
    <div className="flex min-h-screen bg-background">

      {/* ───────── LEFT PANEL ───────── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-[#0f172a] p-10 relative overflow-hidden">

        {/* Background effects */}
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-blue-500/10 animate-pulse" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-blue-400/5 animate-pulse" />

        {/* Logo */}
        <div className="relative z-10">
          <img
            src="/autoriders.webp"
            alt="Autoriders Logo"
            className="w-28 object-contain"
          />
        </div>

        {/* Text */}
        <div className="relative z-10 space-y-6">
          <h2 className="text-4xl font-bold text-white leading-tight">
            Feedback system
            <br />
            <span className="text-blue-400">made simple.</span>
          </h2>

          <p className="text-slate-400 max-w-md">
            Manage customer feedback, track responses, and improve service quality — all in one place.
          </p>

          <div className="flex gap-8 pt-4">
            <div>
              <p className="text-2xl font-bold text-white">100+</p>
              <p className="text-sm text-slate-400">Responses</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">8+</p>
              <p className="text-sm text-slate-400">Branches</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">99%</p>
              <p className="text-sm text-slate-400">Uptime</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 text-xs text-slate-500">
          © 2026 Autoriders International Limited
        </div>
      </div>

      {/* ───────── RIGHT PANEL ───────── */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md space-y-8">

          {/* Mobile logo */}
          <div className="flex justify-center lg:hidden">
            <img
              src="/autoriders.webp"
              alt="Autoriders Logo"
              className="w-40 object-contain"
            />
          </div>

          {/* Heading */}
          <div>
            <h1 className="text-3xl font-bold">Welcome back</h1>
            <p className="text-muted-foreground mt-2">
              Sign in to continue
            </p>
          </div>

          {/* FORM */}
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Email */}
            <div className="space-y-2">
              <Label>Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="pl-10 h-11"
                  placeholder="name@company.com"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label>Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="pl-10 pr-10 h-11"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">
                {error}
              </div>
            )}

            {/* Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          {/* Forgot */}
          <button
            onClick={() => {
              setResetOpen(true);
              setResetEmail(email);
              setResetError('');
            }}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Forgot password?
          </button>
        </div>
      </div>

      {/* RESET MODAL */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Enter your email to receive reset link
            </DialogDescription>
          </DialogHeader>

          <Input
            value={resetEmail}
            onChange={e => setResetEmail(e.target.value)}
            placeholder="your@email.com"
          />

          {resetError && (
            <p className="text-sm text-destructive">{resetError}</p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleReset} disabled={resetLoading}>
              {resetLoading ? 'Sending...' : 'Send'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}