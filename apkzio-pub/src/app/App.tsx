import { useEffect } from 'react';
import { ThemeProvider } from './components/theme-provider';
import { RouterProvider, useRouter, navigate } from './components/router';
import { Header } from './components/header';
import { Footer } from './components/footer';
import { AuthProvider, useAuth } from './contexts/auth-context';
import { Toaster } from './components/ui/sonner';
import { HomePage } from './pages/home';
import { AboutPage } from './pages/about';
import { ProductsPage } from './pages/products';
import { PricingPage } from './pages/pricing';
import { ContactPage } from './pages/contact';
import { BlogPage } from './pages/blog';
import { BlogDetailPage } from './pages/blog-detail';
import { TermsPage } from './pages/terms';
import { PrivacyPage } from './pages/privacy';
import { LoginPage } from './pages/auth/login';
import { RegisterPage } from './pages/auth/register';
import { ForgotPasswordPage } from './pages/auth/forgot-password';
import { ResetPasswordPage } from './pages/auth/reset-password';
import { VerifyEmailPage } from './pages/auth/verify-email';
import { DashboardOverviewPage } from './pages/dashboard/overview';
import { CreateAppPage } from './pages/dashboard/create-app';
import { MyAppsPage } from './pages/dashboard/my-apps';
import { BuildsPage } from './pages/dashboard/builds';
import { BuildDetailPage } from './pages/dashboard/build-detail';
import { PlansPage } from './pages/dashboard/plans';
import { CartPage } from './pages/dashboard/cart';
import { CheckoutPage } from './pages/dashboard/checkout';
import { SubscriptionsPage } from './pages/dashboard/subscriptions';
import { PaymentsPage } from './pages/dashboard/payments';
import { InvoicesPage } from './pages/dashboard/invoices';
import { ProfilePage } from './pages/dashboard/profile';
import { SettingsPage } from './pages/dashboard/settings';
import { SupportPage } from './pages/dashboard/support';
import { NotFoundPage } from './pages/not-found';
import { initFirebase } from './lib/firebase';

function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { ready, isAuthenticated } = useAuth();

  useEffect(() => {
    if (ready && !isAuthenticated) {
      navigate('/login');
    }
  }, [ready, isAuthenticated]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return <>{children}</>;
}

function Routes() {
  const { path } = useRouter();
  const route = path.split('?')[0];

  const map: Record<string, React.ReactNode> = {
    '/': <HomePage />,
    '/home': <HomePage />,
    '/about': <PublicLayout><AboutPage /></PublicLayout>,
    '/products': <PublicLayout><ProductsPage /></PublicLayout>,
    '/pricing': <PublicLayout><PricingPage /></PublicLayout>,
    '/contact': <PublicLayout><ContactPage /></PublicLayout>,
    '/blog': <PublicLayout><BlogPage /></PublicLayout>,
    '/blog/detail': <PublicLayout><BlogDetailPage /></PublicLayout>,
    '/terms': <PublicLayout><TermsPage /></PublicLayout>,
    '/privacy': <PublicLayout><PrivacyPage /></PublicLayout>,
    '/builders': <CreateAppPage />,
    '/builder': <CreateAppPage />,
    '/login': <LoginPage />,
    '/register': <RegisterPage />,
    '/forgot-password': <ForgotPasswordPage />,
    '/reset-password': <ResetPasswordPage />,
    '/verify-email': <VerifyEmailPage />,
    '/dashboard': <RequireAuth><DashboardOverviewPage /></RequireAuth>,
    '/dashboard/overview': <RequireAuth><DashboardOverviewPage /></RequireAuth>,
    '/dashboard/create-app': <RequireAuth><CreateAppPage /></RequireAuth>,
    '/dashboard/my-apps': <RequireAuth><MyAppsPage /></RequireAuth>,
    '/dashboard/builds': <RequireAuth><BuildsPage /></RequireAuth>,
    '/dashboard/plans': <RequireAuth><PlansPage /></RequireAuth>,
    '/dashboard/cart': <RequireAuth><CartPage /></RequireAuth>,
    '/dashboard/checkout': <RequireAuth><CheckoutPage /></RequireAuth>,
    '/dashboard/subscriptions': <RequireAuth><SubscriptionsPage /></RequireAuth>,
    '/dashboard/payments': <RequireAuth><PaymentsPage /></RequireAuth>,
    '/dashboard/invoices': <RequireAuth><InvoicesPage /></RequireAuth>,
    '/dashboard/profile': <RequireAuth><ProfilePage /></RequireAuth>,
    '/dashboard/settings': <RequireAuth><SettingsPage /></RequireAuth>,
    '/dashboard/support': <RequireAuth><SupportPage /></RequireAuth>,
  };

  if (map[route]) return <>{map[route]}</>;

  if (route.startsWith('/dashboard/builds/')) {
    return (
      <RequireAuth>
        <BuildDetailPage />
      </RequireAuth>
    );
  }

  return <NotFoundPage />;
}

export default function App() {
  useEffect(() => {
    void initFirebase();
  }, []);

  return (
    <ThemeProvider>
      <RouterProvider>
        <AuthProvider>
          <Routes />
          <Toaster />
        </AuthProvider>
      </RouterProvider>
    </ThemeProvider>
  );
}
