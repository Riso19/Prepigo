import Header from "@/components/Header";
import DeckManager from "@/components/DeckManager";
import QuestionBankManager from "@/components/QuestionBankManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto p-4 md:p-8 bg-secondary/50 rounded-lg my-4">
        <Tabs defaultValue="decks" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto">
            <TabsTrigger value="decks">Flashcard Decks</TabsTrigger>
            <TabsTrigger value="question-bank">Question Bank</TabsTrigger>
          </TabsList>
          <TabsContent value="decks" className="mt-6">
            <DeckManager />
          </TabsContent>
          <TabsContent value="question-bank" className="mt-6">
            <QuestionBankManager />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;