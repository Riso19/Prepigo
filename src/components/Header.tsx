import {
  Stethoscope,
  Settings,
  BookCopy,
  HelpCircle,
  CalendarCheck2,
  BarChart3,
  FileText,
  Brain,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import { ThemeToggle } from './ThemeToggle';

const Header = () => {
  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-2 text-sm md:text-base font-medium text-muted-foreground transition-colors hover:text-primary',
      isActive && 'text-primary font-semibold',
    );

  return (
    <header className="w-full sticky top-0 z-50 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-3 py-2 sm:px-4 sm:py-3">
      {/* Skip to content link for keyboard users */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-8">
          <NavLink to="/" className="flex items-center gap-2">
            <Stethoscope className="h-6 w-6 text-primary" />
            <h1 className="text-xl md:text-2xl font-bold text-primary">Prepigo</h1>
          </NavLink>
          <nav className="hidden md:flex items-center gap-6" aria-label="Primary">
            <NavLink to="/home" className={navLinkClass}>
              <Brain className="h-4 w-4" /> AI Home
            </NavLink>
            <NavLink to="/" className={navLinkClass} end>
              <BookCopy className="h-4 w-4" /> Decks
            </NavLink>
            <NavLink to="/question-bank" className={navLinkClass}>
              <HelpCircle className="h-4 w-4" /> Question Bank
            </NavLink>
            <NavLink to="/resources" className={navLinkClass}>
              <FileText className="h-4 w-4" /> Resources
            </NavLink>
            <NavLink to="/exams" className={navLinkClass}>
              <CalendarCheck2 className="h-4 w-4" /> Exams
            </NavLink>
            <NavLink to="/statistics" className={navLinkClass}>
              <BarChart3 className="h-4 w-4" /> Statistics
            </NavLink>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" size="icon" asChild>
            <NavLink to="/settings">
              <Settings className="h-5 w-5 text-muted-foreground hover:text-primary" />
              <span className="sr-only">Settings</span>
            </NavLink>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
