import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { DeckData, decks as initialDecks } from "@/data/decks";
import { getAllDecksFromDB, saveDecksToDB, getIntroductionsFromDB, saveIntroductionsToDB, enqueueSyncOp } from "@/lib/idb";
import { Loader2 } from "lucide-react";
import { scheduleSyncNow } from "@/lib/sync";
import { postMessage } from "@/lib/broadcast";

interface DecksContextType {
  decks: DeckData[];
  setDecks: (newDecks: DeckData[] | ((prevDecks: DeckData[]) => DeckData[])) => void;
  isLoading: boolean;
  introductionsToday: Set<string>;
  addIntroducedCard: (cardId: string) => void;
}

const DecksContext = createContext<DecksContextType | undefined>(undefined);

export const DecksProvider = ({ children }: { children: ReactNode }) => {
  const [decks, setDecksState] = useState<DeckData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [introductionsToday, setIntroductionsToday] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load decks
        let dbDecks = await getAllDecksFromDB();
        if (dbDecks.length === 0) {
          await saveDecksToDB(initialDecks);
          dbDecks = initialDecks;
        }
        setDecksState(dbDecks);

        // Load introductions
        const todayStr = new Date().toISOString().split('T')[0];
        const storedIntroductions = await getIntroductionsFromDB();
        if (storedIntroductions && storedIntroductions.date === todayStr) {
          setIntroductionsToday(new Set(storedIntroductions.ids));
        } else {
          // It's a new day or no data exists, start fresh
          setIntroductionsToday(new Set());
          await saveIntroductionsToDB({ date: todayStr, ids: [] });
        }
      } catch (error) {
        console.error("Failed to load data from IndexedDB, falling back to in-memory data.", error);
        setDecksState(initialDecks);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const setDecks = (newDecks: DeckData[] | ((prevDecks: DeckData[]) => DeckData[])) => {
    setDecksState(prevDecks => {
      const updatedDecks = typeof newDecks === 'function' ? newDecks(prevDecks) : newDecks;
      
      saveDecksToDB(updatedDecks).catch(error => {
        console.error("Failed to save decks to IndexedDB", error);
      });

      // Enqueue sync operation (non-blocking)
      void enqueueSyncOp({ resource: 'decks', opType: 'bulk-upsert', payload: updatedDecks })
        .then(() => scheduleSyncNow())
        .then(() => postMessage({ type: 'storage-write', resource: 'decks' }))
        .catch(() => { /* noop */ });

      return updatedDecks;
    });
  };

  const addIntroducedCard = (cardId: string) => {
    const todayStr = new Date().toISOString().split('T')[0];
    setIntroductionsToday(prev => {
      const newSet = new Set(prev);
      newSet.add(cardId);
      saveIntroductionsToDB({ date: todayStr, ids: Array.from(newSet) });

      // Enqueue sync for introductions metadata (non-blocking)
      void enqueueSyncOp({ resource: 'meta:introductions', opType: 'upsert', payload: { date: todayStr, ids: Array.from(newSet) } })
        .then(() => scheduleSyncNow())
        .then(() => postMessage({ type: 'storage-write', resource: 'meta:introductions' }))
        .catch(() => { /* noop */ });
      return newSet;
    });
  };

  return (
    <DecksContext.Provider value={{ decks, setDecks, isLoading, introductionsToday, addIntroducedCard }}>
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