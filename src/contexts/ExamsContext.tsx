import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { ExamData } from "@/data/exams";
import { getAllExamsFromDB, saveExamsToDB } from "@/lib/idb";
import { Loader2 } from "lucide-react";

interface ExamsContextType {
  exams: ExamData[];
  setExams: (newExams: ExamData[] | ((prevExams: ExamData[]) => ExamData[])) => void;
  isLoading: boolean;
  addExam: (exam: ExamData) => void;
  updateExam: (exam: ExamData) => void;
  deleteExam: (examId: string) => void;
}

const ExamsContext = createContext<ExamsContextType | undefined>(undefined);

export const ExamsProvider = ({ children }: { children: ReactNode }) => {
  const [exams, setExamsState] = useState<ExamData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadExams = async () => {
      setIsLoading(true);
      try {
        const dbExams = await getAllExamsFromDB();
        setExamsState(dbExams);
      } catch (error) {
        console.error("Failed to load exams from IndexedDB.", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadExams();
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

  const addExam = (exam: ExamData) => {
    setExams(prev => [...prev, exam]);
  };

  const updateExam = (updatedExam: ExamData) => {
    setExams(prev => prev.map(exam => exam.id === updatedExam.id ? updatedExam : exam));
  };

  const deleteExam = (examId: string) => {
    setExams(prev => prev.filter(exam => exam.id !== examId));
  };

  return (
    <ExamsContext.Provider value={{ exams, setExams, isLoading, addExam, updateExam, deleteExam }}>
      {!isLoading && children}
    </ExamsContext.Provider>
  );
};

export const useExams = () => {
  const context = useContext(ExamsContext);
  if (context === undefined) {
    throw new Error("useExams must be used within an ExamsProvider");
  }
  return context;
};