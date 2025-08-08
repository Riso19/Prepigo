import { createContext, useContext, useState, ReactNode } from "react";
import { DeckData, decks as initialDecks } from "@/data/decks";

interface DecksContextType {
  decks: DeckData[];
  setDecks: React.Dispatch<React.SetStateAction<DeckData[]>>;
}

const DecksContext = createContext<DecksContextType | undefined>(undefined);

export const DecksProvider = ({ children }: { children: ReactNode }) => {
  const [decks, setDecks] = useState<DeckData[]>(initialDecks);

  return (
    <DecksContext.Provider value={{ decks, setDecks }}>
      {children}
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