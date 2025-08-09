import { useState, useMemo, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useDecks } from "@/contexts/DecksContext";
import { findDeckById, getAllFlashcardsFromDeck } from "@/lib/deck-utils";
import Flashcard from "@/components/Flashcard";
import ClozePlayer from "@/components/ClozePlayer";
import ImageOcclusionPlayer from "@/components/ImageOcclusionPlayer";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home } from "lucide-react";

const StudyPage = () => {
  const { deckId } = useParams<{ deckId: string }>();
  const { decks } = useDecks();
  const navigate = useNavigate();

  const deck = useMemo(() => (deckId ? findDeckById(decks, deckId) : null), [decks, deckId]);
  const flashcards = useMemo(() => (deck ? getAllFlashcardsFromDeck(deck) : []), [deck]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const handleRating = useCallback(() => {
    setIsFlipped(false);
    // Add a small delay to allow the card to flip back before changing content
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % flashcards.length);
    }, 150);
  }, [flashcards.length]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !isFlipped) {
        event.preventDefault();
        setIsFlipped(true);
        return;
      }

      if (isFlipped) {
        switch (event.key) {
          case '1':
            handleRating();
            break;
          case '2':
            handleRating();
            break;
          case '3':
            handleRating();
            break;
          case '4':
            handleRating();
            break;
          default:
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFlipped, handleRating]);

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

  const handleCardClick = () => {
    if (!isFlipped) {
      setIsFlipped(true);
    }
  };

  const renderCard = () => {
    switch (currentCard.type) {
      case 'basic':
        return <Flashcard question={currentCard.question} answer={currentCard.answer} isFlipped={isFlipped} onClick={handleCardClick} />;
      case 'cloze':
        return <ClozePlayer text={currentCard.text} description={currentCard.description} isFlipped={isFlipped} onClick={handleCardClick} />;
      case 'imageOcclusion':
        return <ImageOcclusionPlayer imageUrl={currentCard.imageUrl} occlusions={currentCard.occlusions} questionOcclusionId={currentCard.questionOcclusionId} description={currentCard.description} isFlipped={isFlipped} onClick={handleCardClick} />;
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
        
        <div className="w-full mt-4">
          {isFlipped ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full">
              <Button onClick={handleRating} className="relative bg-red-500 hover:bg-red-600 text-white font-bold h-16 text-base">
                Again
                <span className="absolute bottom-1 right-1 text-xs p-1 bg-black/20 rounded-sm">1</span>
              </Button>
              <Button onClick={handleRating} className="relative bg-orange-400 hover:bg-orange-500 text-white font-bold h-16 text-base">
                Hard
                <span className="absolute bottom-1 right-1 text-xs p-1 bg-black/20 rounded-sm">2</span>
              </Button>
              <Button onClick={handleRating} className="relative bg-green-500 hover:bg-green-600 text-white font-bold h-16 text-base">
                Good
                <span className="absolute bottom-1 right-1 text-xs p-1 bg-black/20 rounded-sm">3</span>
              </Button>
              <Button onClick={handleRating} className="relative bg-blue-500 hover:bg-blue-600 text-white font-bold h-16 text-base">
                Easy
                <span className="absolute bottom-1 right-1 text-xs p-1 bg-black/20 rounded-sm">4</span>
              </Button>
            </div>
          ) : (
            <Button onClick={() => setIsFlipped(true)} className="w-full h-16 text-lg relative">
              Show Answer
              <span className="absolute bottom-1 right-1 text-xs p-1 bg-black/20 rounded-sm">Space</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudyPage;