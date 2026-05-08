import { useState } from 'react';
import { Menu, X, Moon, Sun, Rocket, Hammer, LogIn, UserPlus } from 'lucide-react';
import { useTheme } from './theme-provider';
import { Button } from './ui/button';
import { Link } from './router';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const links = [
    { label: 'Home', href: '/' },
    { label: 'Builder', href: '/builders' },
    { label: 'Products', href: '/products' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Blogs', href: '/blog' },
    { label: 'Contact', href: '/contact' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Rocket className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">ApkZio</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            {links.map((l) => (
              <Link key={l.href} to={l.href} className="text-sm hover:text-primary transition-colors">{l.label}</Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-accent/10 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </button>
            <Link to="/login"><Button variant="ghost"><LogIn className="h-4 w-4" /> Sign in</Button></Link>
            <Link to="/register"><Button variant="outline"><UserPlus className="h-4 w-4" /> Sign up</Button></Link>
            <Link to="/builders">
              <Button className="bg-gradient-to-r from-primary to-secondary hover:opacity-90">
                <Hammer className="h-4 w-4" /> Free Builder
              </Button>
            </Link>
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-border">
            <nav className="flex flex-col gap-4">
              {links.map((l) => (
                <Link key={l.href} to={l.href} onClick={() => setMobileMenuOpen(false)} className="text-sm hover:text-primary transition-colors">{l.label}</Link>
              ))}
              <div className="flex items-center gap-4 pt-4 border-t border-border">
                <button
                  onClick={toggleTheme}
                  className="p-2 rounded-lg hover:bg-accent/10 transition-colors"
                >
                  {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                </button>
                <Link to="/login" className="flex-1" onClick={() => setMobileMenuOpen(false)}><Button variant="ghost" className="w-full">Sign in</Button></Link>
                <Link to="/register" className="flex-1" onClick={() => setMobileMenuOpen(false)}><Button variant="outline" className="w-full">Sign up</Button></Link>
                <Link to="/builders" className="flex-1" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full bg-gradient-to-r from-primary to-secondary">
                    Free Builder
                  </Button>
                </Link>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
