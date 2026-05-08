import { Smartphone, Package, Palette, Zap, Bell, DollarSign, Upload, Headphones } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Link } from '../components/router';

export function ProductsPage() {
  const products = [
    {
      icon: Smartphone,
      title: 'Website to Android APK',
      description: 'Convert any website into a native Android APK file ready for installation and testing.',
      price: 'From $9/month',
      features: ['Instant conversion', 'Native performance', 'Offline support', 'Custom branding'],
      badge: 'Popular',
    },
    {
      icon: Package,
      title: 'Website to Android AAB',
      description: 'Generate Android App Bundle files optimized for Google Play Store publishing.',
      price: 'From $29/month',
      features: ['Play Store ready', 'Optimized size', 'Dynamic delivery', 'Automatic updates'],
      badge: 'Pro',
    },
    {
      icon: Palette,
      title: 'App Customization',
      description: 'Full control over your app appearance with custom icons, splash screens, and themes.',
      price: 'Included',
      features: ['Custom app icon', 'Splash screen builder', 'Color themes', 'Brand assets'],
      badge: null,
    },
    {
      icon: Zap,
      title: 'Splash Screen Setup',
      description: 'Design beautiful, professional splash screens that load instantly when your app starts.',
      price: 'Included',
      features: ['Custom logo upload', 'Background colors', 'Animation options', 'Preview mode'],
      badge: null,
    },
    {
      icon: Bell,
      title: 'Push Notification Setup',
      description: 'Integrate push notifications to keep users engaged with timely updates and alerts.',
      price: 'Add-on $9/month',
      features: ['Firebase integration', 'Scheduled messages', 'User segmentation', 'Analytics'],
      badge: 'Add-on',
    },
    {
      icon: DollarSign,
      title: 'AdMob Integration',
      description: 'Monetize your app with Google AdMob banner and interstitial advertisements.',
      price: 'Add-on $12/month',
      features: ['Easy setup', 'Multiple ad formats', 'Revenue tracking', 'Ad placement control'],
      badge: 'Add-on',
    },
    {
      icon: Upload,
      title: 'Store Publishing Support',
      description: 'Get expert help publishing your app to Google Play Store with our step-by-step guidance.',
      price: '$49 one-time',
      features: ['Store listing review', 'ASO optimization', 'Screenshot templates', 'Publishing checklist'],
      badge: 'Premium',
    },
    {
      icon: Headphones,
      title: 'Premium Support',
      description: 'Dedicated support team available 24/7 to help with any technical or publishing questions.',
      price: 'From $79/month',
      features: ['Priority response', 'Direct phone support', 'Custom solutions', 'Dedicated manager'],
      badge: 'Premium',
    },
  ];

  return (
    <div className="min-h-screen">
      <section className="relative overflow-hidden py-20 bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Our Products & Services
            </h1>
            <p className="text-lg text-muted-foreground">
              Everything you need to create, customize, and publish your Android app successfully
            </p>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {products.map((product, index) => (
              <div
                key={index}
                className="rounded-2xl bg-card border border-border p-8 hover:shadow-xl transition-all duration-300 group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center group-hover:scale-110 transition-transform">
                    <product.icon className="h-7 w-7 text-white" />
                  </div>
                  {product.badge && (
                    <Badge className="bg-gradient-to-r from-primary to-secondary">
                      {product.badge}
                    </Badge>
                  )}
                </div>

                <h3 className="text-2xl font-semibold mb-2">{product.title}</h3>
                <p className="text-muted-foreground mb-4">{product.description}</p>

                <div className="mb-6">
                  <span className="text-2xl font-bold text-primary">{product.price}</span>
                </div>

                <ul className="space-y-2 mb-6">
                  {product.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link to="/register">
                  <Button className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90">
                    Get Started
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-card">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Not Sure Which Product You Need?
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Our team is here to help you choose the right solution for your needs
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/contact">
                <Button size="lg" className="bg-gradient-to-r from-primary to-secondary hover:opacity-90">
                  Talk to Sales
                </Button>
              </Link>
              <Link to="/blog">
                <Button size="lg" variant="outline">
                  View Documentation
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
