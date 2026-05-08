import { useEffect, useMemo, useState } from 'react';
import { Mail, CheckCircle2, Rocket, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
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

export function VerifyEmailPage() {
  const { user, isAuthenticated, verifyEmail, resendVerification, refreshUser } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    setToken(readTokenFromSearch());
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setChecking(true);
    (async () => {
      try {
        await verifyEmail(token);
        await refreshUser();
        if (cancelled) return;
        toast.success('Email verified');
        navigate('/dashboard');
      } catch (err) {
        if (cancelled) return;
        toast.error(err instanceof Error ? err.message : 'Could not verify email.');
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, verifyEmail, refreshUser]);

  const email = useMemo(() => user?.email ?? null, [user]);

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 mb-8">
          <Rocket className="h-8 w-8 text-primary" />
          <span className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            ApkZio
          </span>
        </Link>

        <div className="rounded-2xl bg-card border border-border p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-6">
            <Mail className="h-8 w-8 text-white" />
          </div>

          <h1 className="text-3xl font-bold mb-2">Check Your Email</h1>
          <p className="text-muted-foreground mb-8">
            {checking ? (
              'Verifying your email...'
            ) : email ? (
              <>
                We've sent a verification link to <strong>{email}</strong>. Please check your inbox and click the link to verify your account.
              </>
            ) : (
              'We sent you a verification link. Please check your inbox and click the link to verify your account.'
            )}
          </p>

          <div className="rounded-xl bg-primary/10 border border-primary/20 p-4 mb-6">
            <div className="flex items-start gap-3 text-left">
              <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium mb-1">Didn't receive the email?</p>
                <p className="text-muted-foreground">
                  Check your spam folder or click the button below to resend.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Button
              className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90"
              disabled={!isAuthenticated || resending || checking}
              onClick={async () => {
                if (resending || checking) return;
                if (!isAuthenticated) {
                  navigate('/login');
                  return;
                }
                setResending(true);
                try {
                  await resendVerification();
                  toast.success('Verification email sent');
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Could not resend verification email.');
                } finally {
                  setResending(false);
                }
              }}
            >
              {resending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Sending...
                </>
              ) : (
                'Resend Verification Email'
              )}
            </Button>
            <Button variant="outline" className="w-full" onClick={() => navigate('/login')}>
              Back to Sign In
            </Button>
          </div>
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Already verified?{' '}
          <Link to="/login" className="text-primary hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
