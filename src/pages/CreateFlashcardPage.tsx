import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDecks } from "@/contexts/DecksContext";
import { findDeckById, addFlashcardToDeck } from "@/lib/deck-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { BasicFlashcard, ClozeFlashcard, FlashcardType, ImageOcclusionFlashcard, Occlusion } from "@/data/decks";
import { ArrowLeft, ChevronDown, FileText, Type, Image as ImageIcon } from "lucide-react";
import ImageOcclusionEditor from "@/components/ImageOcclusionEditor";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import HtmlEditor from "@/components/HtmlEditor";
import { showError } from "@/utils/toast";

const CreateFlashcardPage = () => {
  const { deckId } = useParams<{ deckId: string }>();
  const { decks, setDecks } = useDecks();
  const navigate = useNavigate();

  const [cardType, setCardType] = useState<FlashcardType>("basic");
  
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [createReverse, setCreateReverse] = useState(false);
  const [clozeText, setClozeText] = useState("");
  const [description, setDescription] = useState("");

  const deck = deckId ? findDeckById(decks, deckId) : null;

  useEffect(() => {
    setQuestion("");
    setAnswer("");
    setCreateReverse(false);
    setClozeText("");
    setDescription("");
  }, [cardType]);

  const cardTypeOptions = {
    basic: { label: 'Basic', icon: <FileText className="mr-2 h-4 w-4" /> },
    cloze: { label: 'Cloze', icon: <Type className="mr-2 h-4 w-4" /> },
    imageOcclusion: { label: 'Image Occlusion', icon: <ImageIcon className="mr-2 h-4 w-4" /> },
  };

  const handleClozeClick = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      showError("Please select some text in the editor to make a cloze.");
      return;
    }

    const clozeRegex = /{{c(\d+)::/g;
    let maxId = 0;
    let match;
    while ((match = clozeRegex.exec(clozeText)) !== null) {
      maxId = Math.max(maxId, parseInt(match[1], 10));
    }
    const newId = maxId + 1;

    const selectedText = selection.toString();
    const newCloze = `{{c${newId}::${selectedText}}}`;

    document.execCommand('insertText', false, newCloze);
  };

  const handleSaveBasic = () => {
    if (!deckId || !question || !answer) return;
    const newCard: BasicFlashcard = { id: `f${Date.now()}`, type: "basic", question, answer };
    setDecks(decks => addFlashcardToDeck(decks, deckId, newCard));
    if (createReverse) {
      const reverseCard: BasicFlashcard = { id: `f${Date.now() + 1}`, type: "basic", question: answer, answer: question };
      setDecks(decks => addFlashcardToDeck(decks, deckId, reverseCard));
    }
    navigate("/");
  };

  const handleSaveCloze = () => {
    if (!deckId || !clozeText) return;
    const newCard: ClozeFlashcard = { id: `f${Date.now()}`, type: "cloze", text: clozeText, description };
    setDecks(decks => addFlashcardToDeck(decks, deckId, newCard));
    navigate("/");
  };

  const handleSaveImageOcclusion = (imageUrl: string, occlusions: Occlusion[], description: string) => {
    if (!deckId) return;
    let currentDecks = decks;
    const groupId = Date.now();
    occlusions.forEach(occ => {
      const newCard: ImageOcclusionFlashcard = {
        id: `f${groupId}-${occ.id}`,
        type: "imageOcclusion",
        imageUrl,
        occlusions,
        questionOcclusionId: occ.id,
        description,
      };
      currentDecks = addFlashcardToDeck(currentDecks, deckId, newCard);
    });
    setDecks(currentDecks);
    navigate("/");
  };

  if (!deck) {
    return <div>Deck not found</div>;
  }

  return (
    <div className="min-h-screen w-full bg-secondary/50 flex flex-col items-center p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-4xl">
        <Button variant="ghost" onClick={() => navigate("/")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Decks
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Add Flashcard to "{deck.name}"</CardTitle>
            <div className="pt-2">
              <Label>Card Type</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between sm:w-64">
                    <div className="flex items-center">
                      {cardTypeOptions[cardType].icon}
                      {cardTypeOptions[cardType].label}
                    </div>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                  <DropdownMenuItem onSelect={() => setCardType('basic')}>
                    {cardTypeOptions.basic.icon}
                    {cardTypeOptions.basic.label}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setCardType('cloze')}>
                    {cardTypeOptions.cloze.icon}
                    {cardTypeOptions.cloze.label}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setCardType('imageOcclusion')}>
                    {cardTypeOptions.imageOcclusion.icon}
                    {cardTypeOptions.imageOcclusion.label}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
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
                <div className="flex items-center space-x-2">
                  <Checkbox id="reverse" checked={createReverse} onCheckedChange={(checked) => setCreateReverse(!!checked)} />
                  <Label htmlFor="reverse">Create reverse card</Label>
                </div>
                <div className="flex justify-end mt-6">
                  <Button onClick={handleSaveBasic}>Save Flashcard</Button>
                </div>
              </div>
            )}
            {cardType === 'cloze' && (
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center mb-2">
                    <Label>Text</Label>
                    <Button variant="outline" size="sm" onMouseDown={(e) => { e.preventDefault(); handleClozeClick(); }}>
                      Make Cloze [...]
                    </Button>
                  </div>
                  <HtmlEditor value={clozeText} onChange={setClozeText} placeholder="Highlight text and click 'Make Cloze'..." />
                  <p className="text-sm text-muted-foreground">
                    Or manually wrap text like this: {`{{c1::your text}}`}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Extra Info (Optional)</Label>
                  <HtmlEditor value={description} onChange={setDescription} placeholder="Add a hint or extra context..."/>
                </div>
                <div className="flex justify-end mt-6">
                  <Button onClick={handleSaveCloze}>Save Flashcard</Button>
                </div>
              </div>
            )}
            {cardType === 'imageOcclusion' && (
              <div className="pt-4 space-y-4">
                <ImageOcclusionEditor onSave={handleSaveImageOcclusion} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CreateFlashcardPage;