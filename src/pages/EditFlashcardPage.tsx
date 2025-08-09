import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDecks } from "@/contexts/DecksContext";
import { findFlashcardById, updateFlashcard, deleteFlashcard, addFlashcardToDeck } from "@/lib/deck-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { BasicFlashcard, ClozeFlashcard, DeckData, FlashcardData, FlashcardType, ImageOcclusionFlashcard, Occlusion } from "@/data/decks";
import { ArrowLeft } from "lucide-react";
import HtmlEditor from "@/components/HtmlEditor";
import { showError, showSuccess } from "@/utils/toast";
import ImageOcclusionEditor from "@/components/ImageOcclusionEditor";

const EditFlashcardPage = () => {
  const { deckId, flashcardId } = useParams<{ deckId: string; flashcardId: string }>();
  const { decks, setDecks } = useDecks();
  const navigate = useNavigate();

  const [cardType, setCardType] = useState<FlashcardType | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [clozeText, setClozeText] = useState("");
  const [description, setDescription] = useState("");
  const [originalCard, setOriginalCard] = useState<FlashcardData | null>(null);
  const [originalDeckId, setOriginalDeckId] = useState<string | null>(null);

  useEffect(() => {
    if (flashcardId) {
      const result = findFlashcardById(decks, flashcardId);
      if (result) {
        const { flashcard, deckId: foundDeckId } = result;
        setOriginalCard(flashcard);
        setOriginalDeckId(foundDeckId);
        setCardType(flashcard.type);
        switch (flashcard.type) {
          case 'basic':
            setQuestion((flashcard as BasicFlashcard).question);
            setAnswer((flashcard as BasicFlashcard).answer);
            break;
          case 'cloze':
            setClozeText((flashcard as ClozeFlashcard).text);
            setDescription((flashcard as ClozeFlashcard).description || "");
            break;
          case 'imageOcclusion':
            // Data is passed to the editor via props
            break;
        }
      }
    }
  }, [flashcardId, decks]);

  const handleSaveBasic = () => {
    if (!originalCard) return;
    if (!question || !answer) {
      showError("Question and Answer cannot be empty.");
      return;
    }
    const updatedCard: BasicFlashcard = { ...originalCard, type: 'basic', question, answer };
    setDecks(prevDecks => updateFlashcard(prevDecks, updatedCard));
    showSuccess("Flashcard updated successfully!");
    navigate(`/deck/${deckId}/view`);
  };

  const handleSaveCloze = () => {
    if (!originalCard) return;
    if (!clozeText) {
      showError("Cloze text cannot be empty.");
      return;
    }
    const updatedCard: ClozeFlashcard = { ...originalCard, type: 'cloze', text: clozeText, description };
    setDecks(prevDecks => updateFlashcard(prevDecks, updatedCard));
    showSuccess("Flashcard updated successfully!");
    navigate(`/deck/${deckId}/view`);
  };

  const handleSaveImageOcclusion = (newImageUrl: string, newOcclusions: Occlusion[], newDescription: string) => {
    if (!originalDeckId || !originalCard || originalCard.type !== 'imageOcclusion') return;

    const originalImageUrl = originalCard.imageUrl;
    const originalOcclusionsRef = originalCard.occlusions;

    let cardsToDelete: string[] = [];
    const findCardsToDelete = (d: DeckData[]) => {
        d.forEach(deck => {
            deck.flashcards.forEach(fc => {
                if (fc.type === 'imageOcclusion' && fc.imageUrl === originalImageUrl && fc.occlusions === originalOcclusionsRef) {
                    cardsToDelete.push(fc.id);
                }
            });
            if (deck.subDecks) findCardsToDelete(deck.subDecks);
        });
    };
    findCardsToDelete(decks);
    cardsToDelete = [...new Set(cardsToDelete)];

    let updatedDecks = decks;
    cardsToDelete.forEach(id => {
        updatedDecks = deleteFlashcard(updatedDecks, id);
    });

    const newGroupId = Date.now();
    newOcclusions.forEach(occ => {
        const newCard: ImageOcclusionFlashcard = {
            id: `f${newGroupId}-${occ.id}`,
            type: "imageOcclusion",
            imageUrl: newImageUrl,
            occlusions: newOcclusions,
            questionOcclusionId: occ.id,
            description: newDescription,
        };
        updatedDecks = addFlashcardToDeck(updatedDecks, originalDeckId, newCard);
    });

    setDecks(updatedDecks);
    showSuccess("Image Occlusion group updated successfully!");
    navigate(`/deck/${deckId}/view`);
  };

  if (!originalCard) {
    return <div>Loading flashcard...</div>;
  }

  return (
    <div className="min-h-screen w-full bg-secondary/50 flex flex-col items-center p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-4xl">
        <Button variant="ghost" onClick={() => navigate(`/deck/${deckId}/view`)} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Deck View
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Edit Flashcard</CardTitle>
            <p className="text-muted-foreground pt-2">Card Type: <span className="font-semibold capitalize">{cardType}</span></p>
          </CardHeader>
          <CardContent>
            {cardType === 'basic' && (
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Front (Question)</Label>
                  <HtmlEditor value={question} onChange={setQuestion} placeholder="Who was the first person on the moon?" />
                </div>
                <div className="space-y-2">
                  <Label>Back (Answer)</Label>
                  <HtmlEditor value={answer} onChange={setAnswer} placeholder="Neil Armstrong" />
                </div>
                <div className="flex justify-end mt-6">
                  <Button onClick={handleSaveBasic}>Save Changes</Button>
                </div>
              </div>
            )}
            {cardType === 'cloze' && (
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Text</Label>
                  <HtmlEditor value={clozeText} onChange={setClozeText} placeholder="Text with {{c1::cloze}} deletion." />
                </div>
                <div className="space-y-2">
                  <Label>Extra Info (Optional)</Label>
                  <HtmlEditor value={description} onChange={setDescription} placeholder="Add a hint or extra context..."/>
                </div>
                <div className="flex justify-end mt-6">
                  <Button onClick={handleSaveCloze}>Save Changes</Button>
                </div>
              </div>
            )}
            {cardType === 'imageOcclusion' && originalCard.type === 'imageOcclusion' && (
              <div className="pt-4 space-y-4">
                <ImageOcclusionEditor
                  initialImageUrl={originalCard.imageUrl}
                  initialOcclusions={originalCard.occlusions}
                  initialDescription={originalCard.description}
                  onSave={handleSaveImageOcclusion}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EditFlashcardPage;