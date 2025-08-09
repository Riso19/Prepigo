import { Stethoscope, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "./ui/button";

const Header = () => {
  return (
    <header className="w-full p-4 border-b">
      <div className="container mx-auto flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <Stethoscope className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-primary">Prepigo</h1>
        </Link>
        <Button variant="ghost" size="icon" asChild>
          <Link to="/settings">
            <Settings className="h-5 w-5 text-muted-foreground hover:text-primary" />
            <span className="sr-only">Settings</span>
          </Link>
        </Button>
      </div>
    </header>
  );
};

export default Header;