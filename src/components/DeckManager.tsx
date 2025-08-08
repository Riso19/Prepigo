import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { useDecks } from "@/contexts/DecksContext";
import DeckItem from "@/components/DeckItem";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { AddDeckDialog } from "./AddDeckDialog";

const DeckManager = () => {
  const { decks } = useDecks();
  const [isAddDeckOpen, setIsAddDeckOpen] = useState(false);

  return (
    <>
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle className="text-2xl">My Decks</CardTitle>
            <Button onClick={() => setIsAddDeckOpen(true)}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Deck
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {decks.length > 0 ? (
            <div className="space-y-2">
              {decks.map((deck) => (
                <DeckItem key={deck.id} deck={deck} />
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-12">
              <p className="mb-2">You don't have any decks yet.</p>
              <p>Click "Add New Deck" to get started!</p>
            </div>
          )}
        </CardContent>
      </Card>
      <AddDeckDialog isOpen={isAddDeckOpen} onOpenChange={setIsAddDeckOpen} />
    </>
  );
};

export default DeckManager;