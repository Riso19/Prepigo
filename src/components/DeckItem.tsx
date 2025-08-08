import { useState } from "react";
import { Link } from "react-router-dom";
import { DeckData, FlashcardData } from "@/data/decks";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "./ui/button";
import { ChevronRight, FileText, Folder, MoreVertical, Plus, BookOpen, Image as ImageIcon, Settings } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { AddSubDeckDialog } from "./AddSubDeckDialog";
import { getAllFlashcardsFromDeck } from "@/lib/deck-utils";

const DeckItem = ({ deck }: { deck: DeckData }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isAddSubDeckOpen, setIsAddSubDeckOpen] = useState(false);

  const hasSubDecks = deck.subDecks && deck.subDecks.length > 0;
  const hasFlashcards = deck.flashcards && deck.flashcards.length > 0;
  const totalFlashcards = getAllFlashcardsFromDeck(deck).length;

  const getCardPreview = (flashcard: FlashcardData) => {
    switch (flashcard.type) {
      case 'basic':
        return { icon: <FileText className="h-5 w-5 text-secondary-foreground/80 flex-shrink-0" />, text: flashcard.question };
      case 'cloze':
        return { icon: <FileText className="h-5 w-5 text-secondary-foreground/80 flex-shrink-0" />, text: flashcard.text };
      case 'imageOcclusion':
        return { icon: <ImageIcon className="h-5 w-5 text-secondary-foreground/80 flex-shrink-0" />, text: 'Image Occlusion Card' };
      default:
        return { icon: <FileText className="h-5 w-5 text-secondary-foreground/80 flex-shrink-0" />, text: 'Unknown card type' };
    }
  };

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-2">
        <div className="flex items-center justify-between space-x-4 pl-2 pr-1 py-1 rounded-lg hover:bg-accent group">
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-3 flex-grow text-left">
              <ChevronRight className={cn("h-5 w-5 transition-transform duration-200", isOpen && "rotate-90")} />
              <Folder className="h-5 w-5 text-primary" />
              <span className="font-semibold">{deck.name}</span>
            </button>
          </CollapsibleTrigger>
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground">{totalFlashcards} cards</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                  <span className="sr-only">Deck options</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to={`/deck/${deck.id}/view`}>
                    <Settings className="mr-2 h-4 w-4" />
                    Manage Cards
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to={`/deck/${deck.id}/add`}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Flashcard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsAddSubDeckOpen(true)}>
                  <Folder className="mr-2 h-4 w-4" />
                  Add Sub-deck
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <CollapsibleContent className="space-y-4 pl-8 border-l-2 border-dashed ml-4">
          {hasSubDecks && (
            <div className="space-y-2 pt-2">
              {deck.subDecks!.map((subDeck) => (
                <DeckItem key={subDeck.id} deck={subDeck} />
              ))}
            </div>
          )}

          {hasFlashcards && (
            <div className="space-y-2 pt-2">
              {deck.flashcards!.map((flashcard) => {
                const { icon, text } = getCardPreview(flashcard);
                return (
                  <Card key={flashcard.id} className="bg-card/50">
                    <CardContent className="p-3 flex items-center gap-3">
                      {icon}
                      <p className="text-sm text-muted-foreground truncate" title={text}>
                        {text}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {(!hasSubDecks && !hasFlashcards) && (
              <p className="text-sm text-muted-foreground py-4 text-center">This deck is empty.</p>
          )}

          {totalFlashcards > 0 && (
              <div className="pt-2">
                  <Button size="sm" variant="outline" asChild>
                    <Link to={`/study/${deck.id}`}>
                      <BookOpen className="mr-2 h-4 w-4" />
                      Study this deck
                    </Link>
                  </Button>
              </div>
          )}
        </CollapsibleContent>
      </Collapsible>
      <AddSubDeckDialog isOpen={isAddSubDeckOpen} onOpenChange={setIsAddSubDeckOpen} parentDeckId={deck.id} />
    </>
  );
};

export default DeckItem;