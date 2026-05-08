import { ArrowUpCircle, CreditCard, Zap } from 'lucide-react';
import { DashboardLayout } from '../../components/dashboard/dashboard-layout';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { useAuth } from '../../contexts/auth-context';
import { Link } from '../../components/router';

export function SubscriptionsPage() {
  const { user } = useAuth();
  const planRaw = user?.plan?.trim().toLowerCase() ?? '';
  const isPaidPlan = planRaw && planRaw !== 'free';
  const planLabel = planRaw
    ? `${planRaw.charAt(0).toUpperCase()}${planRaw.slice(1)} Plan`
    : 'Free Plan';

  return (
    <DashboardLayout currentPage="subscriptions">
      <div className="space-y-6">
        <div>
          <h1 className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Subscription Management</h1>
          <p className="text-muted-foreground mt-1">Manage your active subscription and billing</p>
        </div>

        {/* Current Plan */}
        <div className="bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10 border border-primary/20 rounded-2xl p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <Zap className="h-8 w-8 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-semibold">{planLabel}</h2>
                  {isPaidPlan ? (
                    <Badge className="bg-success">Active</Badge>
                  ) : (
                    <Badge variant="outline">No paid plan</Badge>
                  )}
                </div>
                <p className="text-muted-foreground mt-1">
                  {isPaidPlan
                    ? 'Billing is managed by your linked payment method.'
                    : "You're on the free tier — upgrade any time to unlock more builds and AAB output."}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link to="/dashboard/plans">
                <Button variant="outline">
                  <ArrowUpCircle className="mr-2 h-4 w-4" />
                  {isPaidPlan ? 'Change plan' : 'Upgrade'}
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Payment Method placeholder */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Payment method</p>
                <p className="text-sm text-muted-foreground">
                  {isPaidPlan
                    ? 'Manage your card or PayPal connection from the billing portal.'
                    : 'No payment method on file. You can add one when you upgrade.'}
                </p>
              </div>
            </div>
            <Link to="/dashboard/plans">
              <Button variant="outline" size="sm">
                {isPaidPlan ? 'Manage' : 'Upgrade'}
              </Button>
            </Link>
          </div>
        </div>

        {/* History placeholder */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="font-semibold mb-2">Subscription History</h3>
          <p className="text-sm text-muted-foreground">
            Renewals, plan changes and cancellations will appear here once you upgrade to
            a paid plan.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
