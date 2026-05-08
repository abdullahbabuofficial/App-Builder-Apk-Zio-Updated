import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../ui/accordion';

export function FAQSection() {
  const faqs = [
    {
      question: 'Can I convert any website?',
      answer: 'Yes! ApkZio can convert any website into an Android app. Whether it\'s a blog, e-commerce store, portfolio, or business website, we\'ve got you covered.',
    },
    {
      question: 'How fast is the build?',
      answer: 'Most builds complete in under 5 minutes. Complex apps with many features might take up to 10 minutes. You\'ll receive real-time updates during the build process.',
    },
    {
      question: 'Can I download APK?',
      answer: 'Absolutely! Once your build is complete, you can download the APK file instantly and install it on any Android device for testing.',
    },
    {
      question: 'Can I build AAB?',
      answer: 'Yes, our Pro and Business plans support AAB (Android App Bundle) generation, which is required for publishing on Google Play Store.',
    },
    {
      question: 'Can I update my app later?',
      answer: 'Of course! You can make unlimited updates to your app configuration and generate new builds anytime. Your build history is saved for reference.',
    },
    {
      question: 'Do I need coding?',
      answer: 'No coding skills required! Our platform is designed for everyone. Simply paste your URL, customize your app, and we handle all the technical work.',
    },
  ];

  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Frequently Asked Questions
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Everything you need to know about ApkZio
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="rounded-2xl bg-card border border-border px-6"
              >
                <AccordionTrigger className="text-left hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
