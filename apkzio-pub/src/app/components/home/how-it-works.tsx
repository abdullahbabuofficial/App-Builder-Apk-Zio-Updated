import { Link, Settings, Wand2, Download, Rocket } from 'lucide-react';

export function HowItWorks() {
  const steps = [
    {
      icon: Link,
      title: 'Paste Your Website URL',
      description: 'Simply enter your website URL to get started',
    },
    {
      icon: Settings,
      title: 'Choose Your Plan',
      description: 'Select the plan that fits your needs',
    },
    {
      icon: Wand2,
      title: 'Customize Your App',
      description: 'Add your branding, colors, and features',
    },
    {
      icon: Rocket,
      title: 'Generate APK/AAB',
      description: 'Our system builds your app in seconds',
    },
    {
      icon: Download,
      title: 'Download and Publish',
      description: 'Get your APK/AAB ready for Play Store',
    },
  ];

  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            How It Works
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Transform your website into a native Android app in just 5 simple steps
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          {steps.map((step, index) => (
            <div key={index} className="relative">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center mb-4 shadow-lg">
                  <step.icon className="h-8 w-8 text-white" />
                </div>
                <div className="absolute top-8 left-1/2 w-full h-0.5 bg-gradient-to-r from-primary to-secondary hidden md:block"
                     style={{ display: index === steps.length - 1 ? 'none' : 'block' }} />
                <h3 className="font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
