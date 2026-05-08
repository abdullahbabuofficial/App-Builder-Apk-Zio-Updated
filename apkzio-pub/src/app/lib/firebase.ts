import { initializeApp, type FirebaseApp } from 'firebase/app';

type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
};

let app: FirebaseApp | null = null;
let initPromise: Promise<void> | null = null;

function readConfig(): FirebaseConfig | null {
  const apiKey = String(import.meta.env.VITE_FIREBASE_API_KEY ?? '').trim();
  const authDomain = String(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '').trim();
  const projectId = String(import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '').trim();
  const storageBucket = String(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? '').trim();
  const messagingSenderId = String(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '').trim();
  const appId = String(import.meta.env.VITE_FIREBASE_APP_ID ?? '').trim();
  const measurementIdRaw = String(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ?? '').trim();

  if (!apiKey || !authDomain || !projectId || !storageBucket || !messagingSenderId || !appId) {
    return null;
  }

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
    measurementId: measurementIdRaw || undefined,
  };
}

export async function initFirebase(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (typeof window === 'undefined') return;
    const config = readConfig();
    if (!config) return;

    app = app ?? initializeApp(config);

    try {
      const analytics = await import('firebase/analytics');
      const supported = await analytics.isSupported().catch(() => false);
      if (supported) analytics.getAnalytics(app);
    } catch {
      return;
    }
  })();
  return initPromise;
}

export function getFirebaseApp(): FirebaseApp | null {
  return app;
}

export async function trackEvent(name: string, params?: Record<string, unknown>): Promise<void> {
  if (!name) return;
  await initFirebase();
  if (!app) return;
  try {
    const analytics = await import('firebase/analytics');
    const supported = await analytics.isSupported().catch(() => false);
    if (!supported) return;
    const a = analytics.getAnalytics(app);
    analytics.logEvent(a, name, params);
  } catch {
    return;
  }
}

export async function registerBrowserPushToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  if (!('Notification' in window)) return null;

  const vapidKey = String(import.meta.env.VITE_FIREBASE_VAPID_KEY ?? '').trim();
  if (!vapidKey) return null;

  const perm = await window.Notification.requestPermission().catch(() => 'denied' as NotificationPermission);
  if (perm !== 'granted') return null;

  await initFirebase();
  if (!app) return null;

  const reg = await navigator.serviceWorker
    .register('/firebase-messaging-sw.js')
    .catch(() => null);
  if (!reg) return null;

  try {
    const messaging = await import('firebase/messaging');
    const supported = await messaging.isSupported().catch(() => false);
    if (!supported) return null;
    const m = messaging.getMessaging(app);
    const token = await messaging.getToken(m, { vapidKey, serviceWorkerRegistration: reg }).catch(() => null);
    return token ? String(token) : null;
  } catch {
    return null;
  }
}
