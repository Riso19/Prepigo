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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <SettingsProvider>
      <DecksProvider>
        <QuestionBankProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/study/:deckId" element={<StudyPage />} />
                <Route path="/deck/:deckId/add" element={<CreateFlashcardPage />} />
                <Route path="/deck/:deckId/view" element={<DeckViewPage />} />
                <Route path="/deck/:deckId/edit/:flashcardId" element={<EditFlashcardPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </QuestionBankProvider>
      </DecksProvider>
    </SettingsProvider>
  </QueryClientProvider>
);

export default App;