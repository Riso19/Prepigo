import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { QuestionBankData, questionBanks as initialQuestionBanks } from "@/data/questionBanks";
import { getAllQuestionBanksFromDB, saveQuestionBanksToDB } from "@/lib/idb";
import { Loader2 } from "lucide-react";

interface QuestionBankContextType {
  questionBanks: QuestionBankData[];
  setQuestionBanks: (newBanks: QuestionBankData[] | ((prevBanks: QuestionBankData[]) => QuestionBankData[])) => void;
  isLoading: boolean;
}

const QuestionBankContext = createContext<QuestionBankContextType | undefined>(undefined);

export const QuestionBankProvider = ({ children }: { children: ReactNode }) => {
  const [questionBanks, setQuestionBanksState] = useState<QuestionBankData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        let dbBanks = await getAllQuestionBanksFromDB();
        if (dbBanks.length === 0) {
          await saveQuestionBanksToDB(initialQuestionBanks);
          dbBanks = initialQuestionBanks;
        }
        setQuestionBanksState(dbBanks);
      } catch (error) {
        console.error("Failed to load question banks from IndexedDB, falling back to in-memory data.", error);
        setQuestionBanksState(initialQuestionBanks);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const setQuestionBanks = (newBanks: QuestionBankData[] | ((prevBanks: QuestionBankData[]) => QuestionBankData[])) => {
    setQuestionBanksState(prevBanks => {
      const updatedBanks = typeof newBanks === 'function' ? newBanks(prevBanks) : newBanks;
      
      saveQuestionBanksToDB(updatedBanks).catch(error => {
        console.error("Failed to save question banks to IndexedDB", error);
      });

      return updatedBanks;
    });
  };

  return (
    <QuestionBankContext.Provider value={{ questionBanks, setQuestionBanks, isLoading }}>
      {isLoading ? (
        <div className="min-h-screen w-full flex flex-col items-center justify-center text-center p-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-lg font-semibold">Loading Question Banks...</p>
            <p className="text-muted-foreground">Getting your questions ready.</p>
        </div>
      ) : (
        children
      )}
    </QuestionBankContext.Provider>
  );
};

export const useQuestionBanks = () => {
  const context = useContext(QuestionBankContext);
  if (context === undefined) {
    throw new Error("useQuestionBanks must be used within a QuestionBankProvider");
  }
  return context;
};