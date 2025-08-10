import Header from "@/components/Header";
import DeckManager from "@/components/DeckManager";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto p-4 md:p-8 bg-secondary/50 rounded-lg my-4">
        <DeckManager />
      </main>
    </div>
  );
};

export default Index;