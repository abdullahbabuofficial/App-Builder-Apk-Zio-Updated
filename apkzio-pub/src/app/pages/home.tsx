import { Header } from '../components/header';
import { Footer } from '../components/footer';
import { HeroSection } from '../components/home/hero-section';
import { StatsSection } from '../components/home/stats-section';
import { HowItWorks } from '../components/home/how-it-works';
import { FeaturesGrid } from '../components/home/features-grid';
import { PricingSection } from '../components/home/pricing-section';
import { Testimonials } from '../components/home/testimonials';
import { FAQSection } from '../components/home/faq-section';
import { CTASection } from '../components/home/cta-section';

export function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <HeroSection />
        <StatsSection />
        <HowItWorks />
        <FeaturesGrid />
        <PricingSection />
        <Testimonials />
        <FAQSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
