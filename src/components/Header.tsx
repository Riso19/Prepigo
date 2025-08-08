import { Stethoscope } from "lucide-react";

const Header = () => {
  return (
    <header className="w-full p-4 border-b">
      <div className="container mx-auto flex items-center gap-2">
        <Stethoscope className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-primary">Prepigo</h1>
      </div>
    </header>
  );
};

export default Header;