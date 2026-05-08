import {
  Smartphone, Package, ImageIcon, Zap, Bell, DollarSign,
  Clock, Lock, CreditCard, GitBranch, Download, Gauge
} from 'lucide-react';

export function FeaturesGrid() {
  const features = [
    { icon: Smartphone, title: 'Website to APK', description: 'Convert any website to Android APK instantly' },
    { icon: Package, title: 'Website to AAB', description: 'Generate Android App Bundle for Play Store' },
    { icon: ImageIcon, title: 'Custom App Icon', description: 'Upload your own app icon and branding' },
    { icon: Zap, title: 'Splash Screen Builder', description: 'Design beautiful splash screens' },
    { icon: Bell, title: 'Push Notification Ready', description: 'Built-in push notification support' },
    { icon: DollarSign, title: 'AdMob Ready', description: 'Monetize your app with AdMob integration' },
    { icon: Clock, title: 'Build History', description: 'Track all your app builds in one place' },
    { icon: Lock, title: 'Secure Payments', description: 'Safe and encrypted payment processing' },
    { icon: CreditCard, title: 'Subscription Management', description: 'Easy plan upgrades and billing' },
    { icon: GitBranch, title: 'App Version Control', description: 'Manage multiple app versions' },
    { icon: Download, title: 'Download APK/AAB', description: 'Instant download after build completion' },
    { icon: Gauge, title: 'No-Code Dashboard', description: 'User-friendly control panel' },
  ];

  return (
    <section className="py-20 bg-card">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Powerful Features
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Everything you need to create, customize, and publish your Android app
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="rounded-2xl bg-background/50 backdrop-blur border border-border p-6 hover:shadow-xl hover:scale-105 transition-all duration-300 group"
            >
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <feature.icon className="h-6 w-6 text-white" />
              </div>
              <h3 className="font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
