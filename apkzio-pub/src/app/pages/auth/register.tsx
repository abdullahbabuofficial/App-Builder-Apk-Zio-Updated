import { useMemo, useState, type FormEvent } from 'react';
import { Mail, Lock, User, Rocket, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Checkbox } from '../../components/ui/checkbox';
import { Link, navigate } from '../../components/router';
import { useAuth } from '../../contexts/auth-context';

export function RegisterPage() {
  const { register, loginWithGoogle } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const passwordError = useMemo(() => {
    if (!password) return null;
    if (password.length < 8) return 'Password must be at least 8 characters.';
    if (confirm && confirm !== password) return 'Passwords do not match.';
    return null;
  }, [password, confirm]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    if (!fullName.trim()) {
      toast.error('Full name is required.');
      return;
    }
    if (!email.trim()) {
      toast.error('Email is required.');
      return;
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      toast.error('Passwords do not match.');
      return;
    }
    if (!acceptedTerms) {
      toast.error('Please accept the terms to continue.');
      return;
    }
    setSubmitting(true);
    try {
      await register({ email: email.trim(), password, full_name: fullName.trim() });
      toast.success('Account created. Check your email to verify.');
      navigate('/verify-email');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create your account.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleRegister = async () => {
    if (submitting || googleLoading) return;
    if (!acceptedTerms) {
      toast.error('Please accept the terms to continue.');
      return;
    }
    const { formatGoogleSignInError } = await import('../../lib/firebase-google-auth');
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
      toast.success('Account ready — signed in with Google');
      navigate('/dashboard');
    } catch (err) {
      toast.error(formatGoogleSignInError(err));
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 mb-8">
            <Rocket className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              ApkZio
            </span>
          </div>

          <h1 className="text-3xl font-bold mb-2">Create Your Account</h1>
          <p className="text-muted-foreground mb-8">
            Start building your Android app today. No credit card required.
          </p>

          <form className="space-y-6" onSubmit={handleSubmit} noValidate>
            <div>
              <label className="block text-sm font-medium mb-2">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="John Doe"
                  className="pl-10"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="you@example.com"
                  className="pl-10"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="Create a strong password"
                  className="pl-10"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={8}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="Confirm your password"
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

            <div className="flex items-start gap-2">
              <Checkbox
                id="terms"
                className="mt-1"
                checked={acceptedTerms}
                onCheckedChange={(value) => setAcceptedTerms(Boolean(value))}
              />
              <label htmlFor="terms" className="text-sm text-muted-foreground">
                I agree to the{' '}
                <Link to="/terms" className="text-primary hover:underline">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link to="/privacy" className="text-primary hover:underline">
                  Privacy Policy
                </Link>
              </label>
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Creating...
                </>
              ) : (
                'Create Account'
              )}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-background px-4 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={submitting || googleLoading}
              onClick={() => void handleGoogleRegister()}
            >
              <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              {googleLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Connecting…
                </>
              ) : (
                'Continue with Google'
              )}
            </Button>

            <p className="text-center text-xs text-muted-foreground leading-relaxed">
              Google skips password setup; Google must mark your email verified. By continuing you accept the
              same terms as email registration — we merge with an existing password account when the email
              matches.
            </p>
          </form>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      <div className="hidden lg:flex items-center justify-center bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10 p-12 relative overflow-hidden">
        <div className="absolute top-10 right-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-10 w-96 h-96 bg-secondary/20 rounded-full blur-3xl" />

        <div className="relative z-10 max-w-md text-center">
          <h2 className="text-4xl font-bold mb-6">
            Build the Android version of your site
          </h2>
          <p className="text-muted-foreground mb-8">
            No coding skills required. Convert any URL into a signed APK or AAB in minutes.
          </p>

          <div className="grid grid-cols-1 gap-3 text-left">
            <div className="rounded-xl bg-card/50 backdrop-blur border border-border p-4">
              <p className="text-sm font-semibold mb-1">APK & AAB output</p>
              <p className="text-xs text-muted-foreground">
                Install directly or upload straight to the Play Store.
              </p>
            </div>
            <div className="rounded-xl bg-card/50 backdrop-blur border border-border p-4">
              <p className="text-sm font-semibold mb-1">Push notifications, ready</p>
              <p className="text-xs text-muted-foreground">
                FCM hooks come pre-wired so subscribers can opt in from day one.
              </p>
            </div>
            <div className="rounded-xl bg-card/50 backdrop-blur border border-border p-4">
              <p className="text-sm font-semibold mb-1">Your branding</p>
              <p className="text-xs text-muted-foreground">
                Custom icon, splash, colours and orientation on every build.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
