import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { decks } from "@/data/decks";
import DeckItem from "@/components/DeckItem";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

const DeckManager = () => {
  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <CardTitle className="text-2xl">My Decks</CardTitle>
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Deck
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {decks.map((deck) => (
            <DeckItem key={deck.id} deck={deck} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default DeckManager;