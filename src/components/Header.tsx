import { Stethoscope, Settings } from "lucide-react";
import { NavLink } from "react-router-dom";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

const Header = () => {
  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "text-base font-medium text-muted-foreground transition-colors hover:text-primary",
      isActive && "text-primary font-semibold"
    );

  return (
    <header className="w-full p-4 border-b">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-8">
          <NavLink to="/" className="flex items-center gap-2">
            <Stethoscope className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-primary">Prepigo</h1>
          </NavLink>
          <nav className="hidden md:flex items-center gap-6">
            <NavLink to="/" className={navLinkClass} end>
              Decks
            </NavLink>
            <NavLink to="/question-bank" className={navLinkClass}>
              Question Bank
            </NavLink>
          </nav>
        </div>
        <Button variant="ghost" size="icon" asChild>
          <NavLink to="/settings">
            <Settings className="h-5 w-5 text-muted-foreground hover:text-primary" />
            <span className="sr-only">Settings</span>
          </NavLink>
        </Button>
      </div>
    </header>
  );
};

export default Header;