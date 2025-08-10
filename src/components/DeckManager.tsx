import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { useDecks } from "@/contexts/DecksContext";
import DeckItem from "@/components/DeckItem";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { AddDeckDialog } from "./AddDeckDialog";
import { DndContext, DragEndEvent, useDroppable } from "@dnd-kit/core";
import { moveDeck } from "@/lib/deck-utils";

const RootDroppable = () => {
  const { setNodeRef, isOver } = useDroppable({
    id: 'root-droppable',
  });

  return (
    <div
      ref={setNodeRef}
      className={`mt-4 p-4 border-2 border-dashed rounded-lg text-center text-muted-foreground transition-colors ${
        isOver ? 'bg-primary/10 border-primary' : ''
      }`}
    >
      Drop here to move a deck to the root
    </div>
  );
};

const DeckManager = () => {
  const { decks, setDecks } = useDecks();
  const [isAddDeckOpen, setIsAddDeckOpen] = useState(false);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    // If dropped nowhere, or on itself, do nothing
    if (!over || active.id === over.id) {
      return;
    }

    setDecks((prevDecks) => moveDeck(prevDecks, active.id as string, over.id as string));
  };

  return (
    <DndContext onDragEnd={handleDragEnd}>
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
          {decks.length > 0 && <RootDroppable />}
        </CardContent>
      </Card>
      <AddDeckDialog isOpen={isAddDeckOpen} onOpenChange={setIsAddDeckOpen} />
    </DndContext>
  );
};

export default DeckManager;