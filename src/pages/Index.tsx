import Header from "@/components/Header";
import DeckManager from "@/components/DeckManager";
import { MadeWithDyad } from "@/components/made-with-dyad";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col bg-secondary/50">
      <Header />
      <main className="flex-grow container mx-auto p-4 md:p-8">
        <DeckManager />
      </main>
      <MadeWithDyad />
    </div>
  );
};

export default Index;