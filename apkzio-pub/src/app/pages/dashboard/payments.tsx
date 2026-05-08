import { DollarSign, Search } from 'lucide-react';
import { DashboardLayout } from '../../components/dashboard/dashboard-layout';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Link } from '../../components/router';

export function PaymentsPage() {
  return (
    <DashboardLayout currentPage="payments">
      <div className="space-y-6">
        <div>
          <h1 className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Payment History</h1>
          <p className="text-muted-foreground mt-1">Track every charge, refund and payment method on your account</p>
        </div>

        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search transactions..." className="pl-9" disabled />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-12 text-center">
          <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <DollarSign className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-semibold mb-2">No payments yet</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            Successful charges, refunds and failed attempts will appear here once you
            subscribe to a paid plan.
          </p>
          <Link to="/dashboard/plans">
            <Button className="bg-gradient-to-r from-primary to-secondary hover:opacity-90">
              View plans
            </Button>
          </Link>
        </div>
      </div>
    </DashboardLayout>
  );
}
