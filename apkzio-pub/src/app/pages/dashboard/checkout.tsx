import { ShoppingCart, ArrowRight } from 'lucide-react';
import { DashboardLayout } from '../../components/dashboard/dashboard-layout';
import { Button } from '../../components/ui/button';
import { Link } from '../../components/router';

export function CheckoutPage() {
  return (
    <DashboardLayout currentPage="checkout">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Checkout</h1>
          <p className="text-muted-foreground mt-1">Complete your purchase securely</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-12 text-center">
          <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <ShoppingCart className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Nothing to check out yet</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            Add a plan to your cart first — billing details and a secure payment summary
            will appear here once there's something to buy.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/dashboard/plans">
              <Button className="bg-gradient-to-r from-primary to-secondary hover:opacity-90">
                Browse plans
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/dashboard/cart">
              <Button variant="outline">Open cart</Button>
            </Link>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
