import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { DecksProvider } from "@/contexts/DecksContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import StudyPage from "./pages/StudyPage";
import CreateFlashcardPage from "./pages/CreateFlashcardPage";
import DeckViewPage from "./pages/DeckViewPage";
import EditFlashcardPage from "./pages/EditFlashcardPage";
import SettingsPage from "./pages/SettingsPage";
import { QuestionBankProvider } from "./contexts/QuestionBankContext";
import QuestionBankPage from "./pages/QuestionBankPage";
import CreateMcqPage from "./pages/CreateMcqPage";
import QuestionBankViewPage from "./pages/QuestionBankViewPage";
import EditMcqPage from "./pages/EditMcqPage";
import PracticeMcqPage from "./pages/PracticeMcqPage";
import ReviewMcqPage from "./pages/ReviewMcqPage";
import McqSettingsPage from "./pages/McqSettingsPage";
import CustomStudySetupPage from "./pages/CustomStudySetupPage";
import { ExamsProvider } from "./contexts/ExamsContext";
import ExamSchedulerPage from "./pages/ExamSchedulerPage";
import CreateExamPage from "./pages/CreateExamPage";
import EditExamPage from "./pages/EditExamPage";
import StatisticsPage from "./pages/StatisticsPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <SettingsProvider>
      <DecksProvider>
        <QuestionBankProvider>
          <ExamsProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/question-bank" element={<QuestionBankPage />} />
                  <Route path="/question-bank/:bankId/add" element={<CreateMcqPage />} />
                  <Route path="/question-bank/:bankId/view" element={<QuestionBankViewPage />} />
                  <Route path="/question-bank/:bankId/edit/:mcqId" element={<EditMcqPage />} />
                  <Route path="/question-bank/:bankId/practice" element={<PracticeMcqPage />} />
                  <Route path="/mcq-review/all" element={<ReviewMcqPage />} />
                  <Route path="/mcq-review/:bankId" element={<ReviewMcqPage />} />
                  <Route path="/custom-study" element={<CustomStudySetupPage />} />
                  <Route path="/study/:deckId" element={<StudyPage />} />
                  <Route path="/deck/:deckId/add" element={<CreateFlashcardPage />} />
                  <Route path="/deck/:deckId/view" element={<DeckViewPage />} />
                  <Route path="/deck/:deckId/edit/:flashcardId" element={<EditFlashcardPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/settings/mcq" element={<McqSettingsPage />} />
                  <Route path="/exams" element={<ExamSchedulerPage />} />
                  <Route path="/exams/new" element={<CreateExamPage />} />
                  <Route path="/exams/:examId/edit" element={<EditExamPage />} />
                  <Route path="/statistics" element={<StatisticsPage />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </ExamsProvider>
        </QuestionBankProvider>
      </DecksProvider>
    </SettingsProvider>
  </QueryClientProvider>
);

export default App;