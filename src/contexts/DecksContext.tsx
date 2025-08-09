import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { DeckData, decks as initialDecks } from "@/data/decks";
import { getAllDecksFromDB, saveDecksToDB } from "@/lib/idb";
import { Loader2 } from "lucide-react";

interface DecksContextType {
  decks: DeckData[];
  setDecks: (newDecks: DeckData[] | ((prevDecks: DeckData[]) => DeckData[])) => void;
  isLoading: boolean;
}

const DecksContext = createContext<DecksContextType | undefined>(undefined);

export const DecksProvider = ({ children }: { children: ReactNode }) => {
  const [decks, setDecksState] = useState<DeckData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadDecks = async () => {
      try {
        let dbDecks = await getAllDecksFromDB();
        if (dbDecks.length === 0) {
          // If DB is empty, populate it with initial data and then read it back.
          await saveDecksToDB(initialDecks);
          dbDecks = initialDecks;
        }
        setDecksState(dbDecks);
      } catch (error) {
        console.error("Failed to load decks from IndexedDB, falling back to in-memory data.", error);
        setDecksState(initialDecks);
      } finally {
        setIsLoading(false);
      }
    };

    loadDecks();
  }, []);

  const setDecks = (newDecks: DeckData[] | ((prevDecks: DeckData[]) => DeckData[])) => {
    setDecksState(prevDecks => {
      const updatedDecks = typeof newDecks === 'function' ? newDecks(prevDecks) : newDecks;
      
      saveDecksToDB(updatedDecks).catch(error => {
        console.error("Failed to save decks to IndexedDB", error);
      });

      return updatedDecks;
    });
  };

  return (
    <DecksContext.Provider value={{ decks, setDecks, isLoading }}>
      {isLoading ? (
        <div className="min-h-screen w-full flex flex-col items-center justify-center text-center p-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-lg font-semibold">Loading Decks...</p>
            <p className="text-muted-foreground">Getting your study materials ready.</p>
        </div>
      ) : (
        children
      )}
    </DecksContext.Provider>
  );
};

export const useDecks = () => {
  const context = useContext(DecksContext);
  if (context === undefined) {
    throw new Error("useDecks must be used within a DecksProvider");
  }
  return context;
};