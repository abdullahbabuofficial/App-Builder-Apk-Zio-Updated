import { Smartphone, Bell, Shield, Cpu } from 'lucide-react';

export function StatsSection() {
  const highlights = [
    {
      icon: Smartphone,
      label: 'Android APK & AAB',
      description: 'Build installable APKs and Play Store-ready AABs from any URL.',
    },
    {
      icon: Bell,
      label: 'Push notifications',
      description: 'FCM-ready WebView shell with opt-in subscriber tokens.',
    },
    {
      icon: Shield,
      label: 'Your branding',
      description: 'Custom icon, splash, colors and orientation — no boilerplate.',
    },
    {
      icon: Cpu,
      label: 'Made for builders',
      description: 'Built for indie developers, agencies and growing site owners.',
    },
  ];

  return (
    <section className="py-16 bg-card">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
          {highlights.map((item, index) => (
            <div key={index} className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary text-white">
                <item.icon className="h-6 w-6" />
              </div>
              <p className="text-base font-semibold mb-1">{item.label}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
