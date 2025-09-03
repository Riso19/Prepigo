import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { ExamData } from '@/data/exams';
import { enqueueCriticalSyncOp, getAllExamsFromDB, saveExamsToDB, enqueueSyncOp } from '@/lib/idb';
import { scheduleSyncNow } from '@/lib/sync';
import { postMessage, subscribe } from '@/lib/broadcast';

interface ExamsContextType {
  exams: ExamData[];
  setExams: (newExams: ExamData[] | ((prevExams: ExamData[]) => ExamData[])) => void;
  isLoading: boolean;
  addExam: (exam: ExamData) => void;
  updateExam: (exam: ExamData) => void;
  deleteExam: (examId: string) => Promise<void>;
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
      } catch (error: unknown) {
        console.error('Failed to load exams from IndexedDB.', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadExams();

    // Multi-tab: refresh when other tabs write to 'exams'
    const unsubscribe = subscribe(async (msg) => {
      if (msg.type === 'storage-write' && msg.resource === 'exams') {
        try {
          const latest = await getAllExamsFromDB();
          setExamsState(latest);
        } catch (e: unknown) {
          // noop
        }
      }
    });
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const setExams = (newExams: ExamData[] | ((prevExams: ExamData[]) => ExamData[])) => {
    setExamsState((prevExams) => {
      const updatedExams = typeof newExams === 'function' ? newExams(prevExams) : newExams;
      saveExamsToDB(updatedExams).catch((error: unknown) => {
        console.error('Failed to save exams to IndexedDB', error);
      });

      // Enqueue bulk upsert for entire exams set (normal priority)
      void enqueueSyncOp({ resource: 'exams', opType: 'bulk-upsert', payload: updatedExams })
        .then(() => scheduleSyncNow())
        .then(() => postMessage({ type: 'storage-write', resource: 'exams' }))
        .catch(() => {
          /* noop */
        });
      return updatedExams;
    });
  };

  const addExam = (exam: ExamData) => {
    setExams((prev) => [...prev, exam]);
    // Enqueue single create (critical)
    void enqueueCriticalSyncOp({ resource: 'exams', opType: 'create', payload: exam })
      .then(() => scheduleSyncNow())
      .then(() => postMessage({ type: 'storage-write', resource: 'exams' }))
      .catch(() => {
        /* noop */
      });
  };

  const updateExam = (updatedExam: ExamData) => {
    setExams((prev) => prev.map((exam) => (exam.id === updatedExam.id ? updatedExam : exam)));
    // Enqueue single update (critical)
    void enqueueCriticalSyncOp({ resource: 'exams', opType: 'update', payload: updatedExam })
      .then(() => scheduleSyncNow())
      .then(() => postMessage({ type: 'storage-write', resource: 'exams' }))
      .catch(() => {
        /* noop */
      });
  };

  const deleteExam = async (examId: string) => {
    const prev = exams;
    const updated = prev.filter((exam) => exam.id !== examId);
    // Optimistic
    setExamsState(updated);
    try {
      await saveExamsToDB(updated);
      await enqueueCriticalSyncOp({ resource: 'exams', opType: 'delete', payload: { id: examId } });
      await scheduleSyncNow();
      postMessage({ type: 'storage-write', resource: 'exams' });
    } catch (e: unknown) {
      // rollback
      setExamsState(prev);
      throw e;
    }
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
    throw new Error('useExams must be used within an ExamsProvider');
  }
  return context;
};
