import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  KeyRound,
  Loader2,
  Lock,
  Rocket,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Link, navigate } from '../../components/router';
import { useAuth } from '../../contexts/auth-context';

function readTokenFromSearch(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token');
    return t && t.trim() ? t.trim() : null;
  } catch {
    return null;
  }
}

export function ResetPasswordPage() {
  const { resetPassword } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [tokenChecked, setTokenChecked] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setToken(readTokenFromSearch());
    setTokenChecked(true);
  }, []);

  const passwordError = useMemo(() => {
    if (!password) return null;
    if (password.length < 8) return 'Password must be at least 8 characters.';
    if (confirm && confirm !== password) return 'Passwords do not match.';
    return null;
  }, [password, confirm]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    if (!token) return;
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      toast.error('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword(token, password);
      toast.success('Password reset');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not reset your password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 mb-8">
          <Rocket className="h-8 w-8 text-primary" />
          <span className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            ApkZio
          </span>
        </Link>

        <div className="rounded-2xl bg-card border border-border p-8">
          <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Reset your password</h1>
          <p className="text-muted-foreground mb-8">
            Choose a new password for your ApkZio account. You'll be signed in automatically
            once it's saved.
          </p>

          {tokenChecked && !token ? (
            <div className="space-y-6">
              <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-4">
                <div className="flex items-start gap-3 text-left">
                  <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Reset link is missing a token</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Open this page from the link in your reset email, or request a new one.
                    </p>
                  </div>
                </div>
              </div>
              <Link
                to="/forgot-password"
                className="inline-flex w-full items-center justify-center rounded-md bg-gradient-to-r from-primary to-secondary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Request a new reset email
              </Link>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => navigate('/login')}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Sign In
              </Button>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit} noValidate>
              <div>
                <label htmlFor="reset-password" className="block text-sm font-medium mb-2">
                  New password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="reset-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    className="pl-10"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    minLength={8}
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="reset-confirm" className="block text-sm font-medium mb-2">
                  Confirm new password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="reset-confirm"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Re-enter your new password"
                    className="pl-10"
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                    minLength={8}
                    required
                  />
                </div>
                {passwordError && (
                  <p className="mt-2 text-xs text-destructive">{passwordError}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90"
                disabled={submitting || !token}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (
                  'Reset password'
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => navigate('/login')}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Sign In
              </Button>
            </form>
          )}
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Need a fresh email?{' '}
          <Link to="/forgot-password" className="text-primary hover:underline font-medium">
            Request reset link
          </Link>
        </p>
      </div>
    </div>
  );
}
