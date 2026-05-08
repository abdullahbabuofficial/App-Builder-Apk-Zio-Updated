import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirebaseApp, initFirebase } from './firebase';

export function formatGoogleSignInError(err: unknown): string {
  if (err instanceof Error && err.message.includes('Firebase is not configured')) {
    return err.message;
  }
  if (err && typeof err === 'object' && 'code' in err) {
    const code = String((err as { code?: string }).code);
    if (code === 'auth/popup-closed-by-user') return 'Sign-in was cancelled.';
    if (code === 'auth/cancelled-popup-request') return 'Sign-in was interrupted.';
    if (code === 'auth/popup-blocked-by-browser') {
      return 'Your browser blocked the sign-in window. Allow pop-ups for this site and try again.';
    }
    if (code === 'auth/unauthorized-domain') {
      return 'This domain is not authorized for Firebase Auth. Add it under Firebase Console → Authentication → Settings → Authorized domains.';
    }
    if (code === 'auth/account-exists-with-different-credential') {
      return 'An account already exists with this email using a different sign-in method.';
    }
  }
  if (err instanceof Error) return err.message;
  return 'Google sign-in failed. Try again or use email and password.';
}

/**
 * Opens Google OAuth via Firebase Auth and returns a fresh ID token for `POST /api/auth/google`.
 * Requires Firebase Console → Authentication → Sign-in method → Google enabled,
 * plus matching web app config in `VITE_FIREBASE_*`.
 */
export async function signInWithGoogleAndGetIdToken(): Promise<string> {
  await initFirebase();
  const app = getFirebaseApp();
  if (!app) {
    throw new Error(
      'Firebase is not configured. Set VITE_FIREBASE_* environment variables.',
    );
  }
  const auth = getAuth(app);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const cred = await signInWithPopup(auth, provider);
  return cred.user.getIdToken();
}
