import { useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useDecks } from "@/contexts/DecksContext";
import { findDeckById, getAllFlashcardsFromDeck } from "@/lib/deck-utils";
import Flashcard from "@/components/Flashcard";
import ClozePlayer from "@/components/ClozePlayer";
import ImageOcclusionPlayer from "@/components/ImageOcclusionPlayer";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, Home, X } from "lucide-react";

const StudyPage = () => {
  const { deckId } = useParams<{ deckId: string }>();
  const { decks } = useDecks();
  const navigate = useNavigate();

  const deck = useMemo(() => deckId ? findDeckById(decks, deckId) : null, [decks, deckId]);
  const flashcards = useMemo(() => deck ? getAllFlashcardsFromDeck(deck) : [], [deck]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const handleNext = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % flashcards.length);
    }, 150);
  };

  if (!deck) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
        <h2 className="text-2xl font-bold mb-4">Deck not found</h2>
        <p className="text-muted-foreground mb-6">The deck you're looking for doesn't exist.</p>
        <Button asChild>
          <Link to="/"><Home className="mr-2 h-4 w-4" /> Go back to My Decks</Link>
        </Button>
      </div>
    );
  }

  if (flashcards.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
        <h2 className="text-2xl font-bold mb-4">This deck is empty!</h2>
        <p className="text-muted-foreground mb-6">Add some flashcards to this deck to start studying.</p>
        <Button asChild>
          <Link to="/"><Home className="mr-2 h-4 w-4" /> Go back to My Decks</Link>
        </Button>
      </div>
    );
  }

  const currentCard = flashcards[currentIndex];

  const renderCard = () => {
    switch (currentCard.type) {
      case 'basic':
        return <Flashcard question={currentCard.question} answer={currentCard.answer} isFlipped={isFlipped} onClick={() => setIsFlipped(!isFlipped)} />;
      case 'cloze':
        return <ClozePlayer text={currentCard.text} description={currentCard.description} isFlipped={isFlipped} onClick={() => setIsFlipped(!isFlipped)} />;
      case 'imageOcclusion':
        return <ImageOcclusionPlayer imageUrl={currentCard.imageUrl} occlusions={currentCard.occlusions} questionOcclusionId={currentCard.questionOcclusionId} description={currentCard.description} isFlipped={isFlipped} onClick={() => setIsFlipped(!isFlipped)} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen w-full bg-secondary/50 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8">
       <Button variant="ghost" onClick={() => navigate("/")} className="absolute top-4 left-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Decks
      </Button>
      <div className="w-full max-w-2xl mx-auto flex flex-col items-center gap-6">
        <h1 className="text-3xl font-bold text-center">Studying: {deck.name}</h1>
        
        {renderCard()}

        <div className="text-sm text-muted-foreground">
          Card {currentIndex + 1} of {flashcards.length}
        </div>
        <div className="grid grid-cols-2 gap-4 w-full">
          <Button variant="destructive" className="flex-grow" onClick={handleNext}>
            <X className="mr-2 h-4 w-4" /> I was wrong
          </Button>
          <Button className="flex-grow bg-green-500 hover:bg-green-600" onClick={handleNext}>
            <Check className="mr-2 h-4 w-4" /> I was right
          </Button>
        </div>
      </div>
    </div>
  );
};

export default StudyPage;