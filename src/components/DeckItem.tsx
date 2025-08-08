import { useState } from "react";
import { DeckData } from "@/data/decks";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "./ui/button";
import { ChevronRight, FileText, Folder, Plus } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { cn } from "@/lib/utils";

const DeckItem = ({ deck }: { deck: DeckData }) => {
  const [isOpen, setIsOpen] = useState(false);

  const hasSubDecks = deck.subDecks && deck.subDecks.length > 0;
  const hasFlashcards = deck.flashcards && deck.flashcards.length > 0;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-2">
      <div className="flex items-center justify-between space-x-4 pl-2 pr-1 py-1 rounded-lg hover:bg-accent">
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-3 flex-grow text-left">
            <ChevronRight className={cn("h-5 w-5 transition-transform duration-200", isOpen && "rotate-90")} />
            <Folder className="h-5 w-5 text-primary" />
            <span className="font-semibold">{deck.name}</span>
          </button>
        </CollapsibleTrigger>
        <Button variant="ghost" size="icon">
          <Plus className="h-4 w-4" />
          <span className="sr-only">Add to deck</span>
        </Button>
      </div>
      <CollapsibleContent className="space-y-4 pl-8 border-l-2 border-dashed ml-4">
        {/* Render sub-decks recursively */}
        {hasSubDecks && (
          <div className="space-y-2 pt-2">
            {deck.subDecks!.map((subDeck) => (
              <DeckItem key={subDeck.id} deck={subDeck} />
            ))}
          </div>
        )}

        {/* Render flashcards */}
        {hasFlashcards && (
          <div className="space-y-2 pt-2">
            {deck.flashcards!.map((flashcard) => (
              <Card key={flashcard.id} className="bg-card/50">
                <CardContent className="p-3 flex items-center gap-3">
                  <FileText className="h-5 w-5 text-secondary-foreground/80 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">{flashcard.question}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {(!hasSubDecks && !hasFlashcards) && (
            <p className="text-sm text-muted-foreground py-4 text-center">This deck is empty.</p>
        )}

        {/* Actions */}
        {hasFlashcards && (
            <div className="pt-2">
                <Button size="sm" variant="outline">Study this deck</Button>
            </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};

export default DeckItem;