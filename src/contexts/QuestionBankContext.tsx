import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { QuestionBankData, questionBanks as initialQuestionBanks } from "@/data/questionBanks";
import { getAllQuestionBanksFromDB, saveQuestionBanksToDB, getMcqIntroductionsFromDB, saveMcqIntroductionsToDB, enqueueSyncOp } from "@/lib/idb";
import { Loader2 } from "lucide-react";
import { scheduleSyncNow } from "@/lib/sync";
import { postMessage } from "@/lib/broadcast";

interface QuestionBankContextType {
  questionBanks: QuestionBankData[];
  setQuestionBanks: (newBanks: QuestionBankData[] | ((prevBanks: QuestionBankData[]) => QuestionBankData[])) => void;
  isLoading: boolean;
  mcqIntroductionsToday: Set<string>;
  addIntroducedMcq: (mcqId: string) => void;
}

const QuestionBankContext = createContext<QuestionBankContextType | undefined>(undefined);

export const QuestionBankProvider = ({ children }: { children: ReactNode }) => {
  const [questionBanks, setQuestionBanksState] = useState<QuestionBankData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mcqIntroductionsToday, setMcqIntroductionsToday] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load question banks
        let dbBanks = await getAllQuestionBanksFromDB();
        if (dbBanks.length === 0) {
          await saveQuestionBanksToDB(initialQuestionBanks);
          dbBanks = initialQuestionBanks;
        }
        setQuestionBanksState(dbBanks);

        // Load MCQ introductions
        const todayStr = new Date().toISOString().split('T')[0];
        const storedMcqIntroductions = await getMcqIntroductionsFromDB();
        if (storedMcqIntroductions && storedMcqIntroductions.date === todayStr) {
          setMcqIntroductionsToday(new Set(storedMcqIntroductions.ids));
        } else {
          setMcqIntroductionsToday(new Set());
          await saveMcqIntroductionsToDB({ date: todayStr, ids: [] });
        }
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

      // Enqueue sync operation (non-blocking)
      void enqueueSyncOp({ resource: 'questionBanks', opType: 'bulk-upsert', payload: updatedBanks })
        .then(() => scheduleSyncNow())
        .then(() => postMessage({ type: 'storage-write', resource: 'questionBanks' }))
        .catch(() => { /* noop */ });

      return updatedBanks;
    });
  };

  const addIntroducedMcq = (mcqId: string) => {
    const todayStr = new Date().toISOString().split('T')[0];
    setMcqIntroductionsToday(prev => {
      const newSet = new Set(prev);
      newSet.add(mcqId);
      saveMcqIntroductionsToDB({ date: todayStr, ids: Array.from(newSet) });

      // Enqueue sync for MCQ introductions metadata (non-blocking)
      void enqueueSyncOp({ resource: 'meta:mcqIntroductions', opType: 'upsert', payload: { date: todayStr, ids: Array.from(newSet) } })
        .then(() => scheduleSyncNow())
        .then(() => postMessage({ type: 'storage-write', resource: 'meta:mcqIntroductions' }))
        .catch(() => { /* noop */ });
      return newSet;
    });
  };

  return (
    <QuestionBankContext.Provider value={{ questionBanks, setQuestionBanks, isLoading, mcqIntroductionsToday, addIntroducedMcq }}>
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