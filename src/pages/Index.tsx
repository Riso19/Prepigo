import Header from "@/components/Header";
import FlashcardViewer from "@/components/FlashcardViewer";
import { MadeWithDyad } from "@/components/made-with-dyad";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-grow container mx-auto p-4 md:p-8 flex items-center justify-center">
        <FlashcardViewer />
      </main>
      <MadeWithDyad />
    </div>
  );
};

export default Index;