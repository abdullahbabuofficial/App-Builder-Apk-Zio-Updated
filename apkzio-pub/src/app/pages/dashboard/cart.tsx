import { ShoppingCart, ArrowRight } from 'lucide-react';
import { DashboardLayout } from '../../components/dashboard/dashboard-layout';
import { Button } from '../../components/ui/button';
import { Link } from '../../components/router';

export function CartPage() {
  return (
    <DashboardLayout currentPage="cart">
      <div className="space-y-6">
        <div>
          <h1 className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Shopping Cart</h1>
          <p className="text-muted-foreground mt-1">Review your selected plans and add-ons before checkout</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-12 text-center">
          <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <ShoppingCart className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Your cart is empty</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            Pick a plan that fits your project and it will land here, ready for checkout.
          </p>
          <Link to="/dashboard/plans">
            <Button className="bg-gradient-to-r from-primary to-secondary hover:opacity-90">
              Browse plans
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </DashboardLayout>
  );
}
