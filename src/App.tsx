import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// BrowserRouter configuration
import Index from './pages/Index';
import NotFound from './pages/NotFound';
import { DecksProvider } from '@/contexts/DecksContext';
import { SettingsProvider } from '@/contexts/SettingsContext';
import StudyPage from './pages/StudyPage';
import CreateFlashcardPage from './pages/CreateFlashcardPage';
import DeckViewPage from './pages/DeckViewPage';
import EditFlashcardPage from './pages/EditFlashcardPage';
import SettingsPage from './pages/SettingsPage';
import { QuestionBankProvider } from './contexts/QuestionBankContext';
import QuestionBankPage from './pages/QuestionBankPage';
import CreateMcqPage from './pages/CreateMcqPage';
import QuestionBankViewPage from './pages/QuestionBankViewPage';
import EditMcqPage from './pages/EditMcqPage';
import PracticeMcqPage from './pages/PracticeMcqPage';
import ReviewMcqPage from './pages/ReviewMcqPage';
import McqSettingsPage from './pages/McqSettingsPage';
import CustomStudySetupPage from './pages/CustomStudySetupPage';
import { ExamsProvider } from './contexts/ExamsContext';
import ExamSchedulerPage from './pages/ExamSchedulerPage';
import CreateExamPage from './pages/CreateExamPage';
import EditExamPage from './pages/EditExamPage';
import StatisticsPage from './pages/StatisticsPage';
import { ThemeProvider } from '@/components/ThemeProvider';
import CustomMcqPracticeSetupPage from './pages/CustomMcqPracticeSetupPage';
import ExamSessionPage from './pages/ExamSessionPage';
import ExamResultsPage from './pages/ExamResultsPage';
import ExamHistoryPage from './pages/ExamHistoryPage';
import ExamProgressPage from './pages/ExamProgressPage';
import MistakeReviewSetupPage from './pages/MistakeReviewSetupPage';
import ImportExportGuidePage from './pages/ImportExportGuidePage';
import AlgorithmGuidePage from './pages/AlgorithmGuidePage';
import StatisticsGuidePage from './pages/StatisticsGuidePage';
import OfflineIndicator from '@/components/OfflineIndicator';
import SyncProvider from '@/contexts/SyncProvider';
import SyncStatusIndicator from '@/components/SyncStatusIndicator';
import ConflictCenter from '@/components/ConflictCenter';
import { ResourcesProvider } from '@/contexts/ResourcesContext';
import ResourcesPage from './pages/ResourcesPage';
import ResourceViewerPage from './pages/ResourceViewerPage';
import MobileBottomNav, { NAV_HEIGHT } from '@/components/MobileBottomNav';

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <SettingsProvider>
        <DecksProvider>
          <QuestionBankProvider>
            <ExamsProvider>
              <ResourcesProvider>
                <TooltipProvider>
                  <Toaster />
                  <Sonner />
                  <OfflineIndicator />
                  <div className="fixed bottom-2 right-3 flex gap-2 items-end pointer-events-none">
                    <SyncStatusIndicator />
                    <ConflictCenter className="pointer-events-auto" />
                  </div>
                  <SyncProvider />
                  <BrowserRouter>
                    <Routes>
                      <Route path="/" element={<Index />} />
                      <Route path="/resources" element={<ResourcesPage />} />
                      <Route path="/resources/:id/view" element={<ResourceViewerPage />} />
                      <Route path="/question-bank" element={<QuestionBankPage />} />
                      <Route path="/question-bank/:bankId/add" element={<CreateMcqPage />} />
                      <Route
                        path="/question-bank/:bankId/view"
                        element={<QuestionBankViewPage />}
                      />
                      <Route path="/question-bank/:bankId/edit/:mcqId" element={<EditMcqPage />} />
                      <Route path="/question-bank/:bankId/practice" element={<PracticeMcqPage />} />
                      <Route path="/mcq-review/all" element={<ReviewMcqPage />} />
                      <Route path="/mcq-review/:bankId" element={<ReviewMcqPage />} />
                      <Route path="/mcq-practice/:bankId" element={<PracticeMcqPage />} />
                      <Route path="/mcq-practice/setup" element={<CustomMcqPracticeSetupPage />} />
                      <Route path="/custom-study" element={<CustomStudySetupPage />} />
                      <Route path="/study/:deckId" element={<StudyPage />} />
                      <Route path="/deck/:deckId/add" element={<CreateFlashcardPage />} />
                      <Route path="/deck/:deckId/view" element={<DeckViewPage />} />
                      <Route
                        path="/deck/:deckId/edit/:flashcardId"
                        element={<EditFlashcardPage />}
                      />
                      <Route path="/settings" element={<SettingsPage />} />
                      <Route path="/settings/mcq" element={<McqSettingsPage />} />
                      <Route
                        path="/settings/import-export-guide"
                        element={<ImportExportGuidePage />}
                      />
                      <Route path="/settings/algorithm-guide" element={<AlgorithmGuidePage />} />
                      <Route path="/exams" element={<ExamSchedulerPage />} />
                      <Route path="/exams/new" element={<CreateExamPage />} />
                      <Route path="/exams/:examId/edit" element={<EditExamPage />} />
                      <Route path="/exams/:examId/progress" element={<ExamProgressPage />} />
                      <Route path="/exam-history" element={<ExamHistoryPage />} />
                      <Route path="/exam/session" element={<ExamSessionPage />} />
                      <Route path="/exam/results/:logId" element={<ExamResultsPage />} />
                      <Route
                        path="/exam/mistakes/:logId/setup"
                        element={<MistakeReviewSetupPage />}
                      />
                      <Route path="/statistics" element={<StatisticsPage />} />
                      <Route path="/statistics/guide" element={<StatisticsGuidePage />} />
                      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                    {/* Spacer to prevent content from being hidden behind the fixed bottom nav on mobile */}
                    <div
                      className="md:hidden"
                      style={{ height: `calc(${NAV_HEIGHT}px + env(safe-area-inset-bottom))` }}
                      aria-hidden
                    />
                    <MobileBottomNav />
                  </BrowserRouter>
                </TooltipProvider>
              </ResourcesProvider>
            </ExamsProvider>
          </QuestionBankProvider>
        </DecksProvider>
      </SettingsProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
