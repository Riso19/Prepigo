import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2 } from "lucide-react";
import { useDecks } from "@/contexts/DecksContext";
import DeckItem from "@/components/DeckItem";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { AddDeckDialog } from "./AddDeckDialog";
import { DndContext, DragEndEvent, useDroppable } from "@dnd-kit/core";
import { moveDeck, buildSessionQueue } from "@/lib/deck-utils";
import { Link, useNavigate } from "react-router-dom";
import { useSettings } from "@/contexts/SettingsContext";
import { useExams } from "@/contexts/ExamsContext";
import { useQuery } from "@tanstack/react-query";
import { getAllReviewLogsFromDB } from "@/lib/idb";

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
  const { decks, setDecks, introductionsToday } = useDecks();
  const { settings } = useSettings();
  const { exams } = useExams();
  const [isAddDeckOpen, setIsAddDeckOpen] = useState(false);
  const [dueCount, setDueCount] = useState(0);
  const navigate = useNavigate();

  const { data: logs, isLoading } = useQuery({
    queryKey: ['cardReviewLogs'],
    queryFn: getAllReviewLogsFromDB,
  });

  useEffect(() => {
    if (decks.length > 0) {
      const { queue } = buildSessionQueue(decks, decks, settings, introductionsToday, exams);
      setDueCount(queue.length);
    } else {
      setDueCount(0);
    }
  }, [decks, settings, introductionsToday, exams]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

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
            <div className="flex items-center gap-2">
              <Button asChild variant="outline">
                <Link to="/custom-study">Custom Study</Link>
              </Button>
              {dueCount > 0 && (
                <Button onClick={() => navigate('/study/all')} className="relative">
                  Study Now
                  <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                    {dueCount}
                  </span>
                </Button>
              )}
              <Button onClick={() => setIsAddDeckOpen(true)}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Deck
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : decks.length > 0 ? (
            <div className="space-y-2">
              {decks.map((deck) => (
                <DeckItem key={deck.id} deck={deck} allLogs={logs || []} />
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