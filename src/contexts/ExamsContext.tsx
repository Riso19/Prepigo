import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { ExamData } from "@/data/exams";
import { getAllExamsFromDB, saveExamsToDB } from "@/lib/idb";
import { Loader2 } from "lucide-react";

interface ExamsContextType {
  exams: ExamData[];
  setExams: (newExams: ExamData[] | ((prevExams: ExamData[]) => ExamData[])) => void;
  isLoading: boolean;
}

const ExamsContext = createContext<ExamsContextType | undefined>(undefined);

export const ExamsProvider = ({ children }: { children: ReactNode }) => {
  const [exams, setExamsState] = useState<ExamData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const dbExams = await getAllExamsFromDB();
        setExamsState(dbExams);
      } catch (error) {
        console.error("Failed to load exams from IndexedDB.", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const setExams = (newExams: ExamData[] | ((prevExams: ExamData[]) => ExamData[])) => {
    setExamsState(prevExams => {
      const updatedExams = typeof newExams === 'function' ? newExams(prevExams) : newExams;
      
      saveExamsToDB(updatedExams).catch(error => {
        console.error("Failed to save exams to IndexedDB", error);
      });

      return updatedExams;
    });
  };

  return (
    <ExamsContext.Provider value={{ exams, setExams, isLoading }}>
      {isLoading ? (
        <div className="min-h-screen w-full flex flex-col items-center justify-center text-center p-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-lg font-semibold">Loading Exam Schedules...</p>
        </div>
      ) : (
        children
      )}
    </ExamsContext.Provider>
  );
};

export const useExams = () => {
  const context = useContext(ExamsContext);
  if (context === undefined) {
    throw new Error("useExams must be used within a ExamsProvider");
  }
  return context;
};