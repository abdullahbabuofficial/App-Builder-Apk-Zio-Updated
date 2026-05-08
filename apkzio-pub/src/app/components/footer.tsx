import { Rocket, Facebook, Twitter, Linkedin, Github, Mail, Shield, Lock, CheckCircle2, Zap } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Link } from './router';

export function Footer() {
  return (
    <footer className="relative border-t border-border/40 bg-gradient-to-b from-card via-card to-background overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-secondary/5 to-accent/5 pointer-events-none" />

      <div className="container mx-auto px-4 py-16 relative">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <img 
                src="/logo.png" 
                alt="ApkZio" 
                className="h-10 w-auto dark:hidden" 
              />
              <img 
                src="/logo-dark.png" 
                alt="ApkZio" 
                className="h-10 w-auto hidden dark:block" 
              />
            </div>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm leading-relaxed">
              Turn your website into an Android app in seconds. No coding required —
              ApkZio handles the build, signing and Play Store-ready output for you.
            </p>

            <div className="flex gap-3 mb-6">
              <a href="https://www.facebook.com/" className="w-10 h-10 rounded-xl border border-border bg-card hover:bg-primary hover:border-primary hover:text-white transition-all flex items-center justify-center group">
                <Facebook className="h-4 w-4" />
              </a>
              <a href="https://x.com/" className="w-10 h-10 rounded-xl border border-border bg-card hover:bg-primary hover:border-primary hover:text-white transition-all flex items-center justify-center group">
                <Twitter className="h-4 w-4" />
              </a>
              <a href="https://www.linkedin.com/" className="w-10 h-10 rounded-xl border border-border bg-card hover:bg-primary hover:border-primary hover:text-white transition-all flex items-center justify-center group">
                <Linkedin className="h-4 w-4" />
              </a>
              <a href="https://github.com/abdullahbabuofficial/App-Builder-Apk-Zio-Updated" className="w-10 h-10 rounded-xl border border-border bg-card hover:bg-primary hover:border-primary hover:text-white transition-all flex items-center justify-center group">
                <Github className="h-4 w-4" />
              </a>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-success/10 border border-success/20">
                <Shield className="h-3.5 w-3.5 text-success" />
                <span className="text-xs font-medium text-success">SSL Secured</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20">
                <Lock className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium text-primary">256-bit Encryption</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/10 border border-secondary/20">
                <CheckCircle2 className="h-3.5 w-3.5 text-secondary" />
                <span className="text-xs font-medium text-secondary">GDPR Compliant</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-4 flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Product
            </h4>
            <ul className="space-y-3 text-sm">
              <li><Link to="/products" className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2 group">
                <span className="w-1 h-1 rounded-full bg-muted-foreground group-hover:bg-primary transition-colors" />
                Website to APK
              </Link></li>
              <li><Link to="/products" className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2 group">
                <span className="w-1 h-1 rounded-full bg-muted-foreground group-hover:bg-primary transition-colors" />
                Website to AAB
              </Link></li>
              <li><Link to="/builders" className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2 group">
                <span className="w-1 h-1 rounded-full bg-muted-foreground group-hover:bg-primary transition-colors" />
                App Builder
              </Link></li>
              <li><Link to="/pricing" className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2 group">
                <span className="w-1 h-1 rounded-full bg-muted-foreground group-hover:bg-primary transition-colors" />
                Pricing
              </Link></li>
              <li><Link to="/products" className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2 group">
                <span className="w-1 h-1 rounded-full bg-muted-foreground group-hover:bg-primary transition-colors" />
                API Access
              </Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4 flex items-center gap-2">
              <Rocket className="h-4 w-4 text-secondary" />
              Company
            </h4>
            <ul className="space-y-3 text-sm">
              <li><Link to="/about" className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2 group">
                <span className="w-1 h-1 rounded-full bg-muted-foreground group-hover:bg-primary transition-colors" />
                About Us
              </Link></li>
              <li><Link to="/blog" className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2 group">
                <span className="w-1 h-1 rounded-full bg-muted-foreground group-hover:bg-primary transition-colors" />
                Blog
              </Link></li>
              <li><Link to="/contact" className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2 group">
                <span className="w-1 h-1 rounded-full bg-muted-foreground group-hover:bg-primary transition-colors" />
                Contact
              </Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4 flex items-center gap-2">
              <Shield className="h-4 w-4 text-accent" />
              Legal
            </h4>
            <ul className="space-y-3 text-sm">
              <li><Link to="/privacy" className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2 group">
                <span className="w-1 h-1 rounded-full bg-muted-foreground group-hover:bg-primary transition-colors" />
                Privacy Policy
              </Link></li>
              <li><Link to="/terms" className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2 group">
                <span className="w-1 h-1 rounded-full bg-muted-foreground group-hover:bg-primary transition-colors" />
                Terms of Service
              </Link></li>
              <li><Link to="/terms" className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2 group">
                <span className="w-1 h-1 rounded-full bg-muted-foreground group-hover:bg-primary transition-colors" />
                Cookie Policy
              </Link></li>
              <li><Link to="/terms" className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2 group">
                <span className="w-1 h-1 rounded-full bg-muted-foreground group-hover:bg-primary transition-colors" />
                Refund Policy
              </Link></li>
              <li><Link to="/terms" className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2 group">
                <span className="w-1 h-1 rounded-full bg-muted-foreground group-hover:bg-primary transition-colors" />
                SLA
              </Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-border/40">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6 mb-8">
            <div className="flex flex-col md:flex-row items-center gap-6 flex-1">
              <p className="text-sm text-muted-foreground">
                © 2026 ApkZio. All rights reserved.
              </p>

              <div className="flex items-center gap-4">
                <span className="text-xs text-muted-foreground">Built with:</span>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>Android</span>
                  <span aria-hidden>·</span>
                  <span>WebView</span>
                  <span aria-hidden>·</span>
                  <span>FCM</span>
                  <span aria-hidden>·</span>
                  <span>Play Store ready</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full lg:w-auto lg:max-w-md">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="Enter your email for updates"
                  className="pl-10 bg-card/50 backdrop-blur-sm"
                />
              </div>
              <Button className="bg-gradient-to-r from-primary via-secondary to-accent hover:opacity-90 shadow-lg shadow-primary/25">
                Subscribe
              </Button>
            </div>
          </div>

          <div className="text-center p-6 rounded-2xl bg-gradient-to-r from-primary/10 via-secondary/10 to-accent/10 border border-primary/20">
            <p className="text-xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent mb-2">
              Start building your Android app today
            </p>
            <p className="text-sm text-muted-foreground">
              Free first build · Sign up to save your apps and rebuild any time
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
