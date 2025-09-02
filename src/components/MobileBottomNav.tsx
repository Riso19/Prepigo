import { NavLink } from 'react-router-dom';
import { Brain, BookOpen, ListChecks, Calendar, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Fixed height for the bottom nav; keep in sync with spacer/padding in App
const NAV_HEIGHT = 64; // px

const items = [
  { to: '/home', label: 'Home', icon: Brain },
  { to: '/resources', label: 'Resources', icon: BookOpen },
  { to: '/question-bank', label: 'MCQs', icon: ListChecks },
  { to: '/exams', label: 'Exams', icon: Calendar },
  { to: '/statistics', label: 'Stats', icon: BarChart3 },
];

export default function MobileBottomNav() {
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      style={{ height: NAV_HEIGHT }}
      role="navigation"
      aria-label="Primary"
    >
      <ul className="grid grid-cols-5 h-full">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to} className="contents">
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center gap-1 text-xs select-none',
                  'text-muted-foreground hover:text-foreground',
                  isActive && 'text-foreground',
                )
              }
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span className="leading-none">{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
      {/* iOS safe area inset */}
      <div className="pointer-events-none h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}

export { NAV_HEIGHT };
