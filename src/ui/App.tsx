import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppStateProvider } from './state/AppState';
import { PomodoroProvider } from './state/PomodoroProvider';
import { Shell } from './components/Shell';
import { Skeleton } from './components/primitives';
import { HomePage } from './pages/HomePage';
import { FocusPage } from './pages/FocusPage';
import { BooksPage } from './pages/BooksPage';
import { AskPage } from './pages/AskPage';
import { LabsPage } from './pages/LabsPage';
import { SubjectPage } from './pages/SubjectPage';
import { TopicPage } from './pages/TopicPage';
import { ResearchPage } from './pages/ResearchPage';
import { FormulasPage } from './pages/FormulasPage';
import { FactsPage } from './pages/FactsPage';
import { TimelinePage } from './pages/TimelinePage';
import { NotesPage } from './pages/NotesPage';
import { QuestionsPage } from './pages/QuestionsPage';
import { SavedPage } from './pages/SavedPage';
import { SettingsPage } from './pages/SettingsPage';
import { PersonPage } from './pages/PersonPage';
import { NotFoundPage } from './pages/NotFoundPage';

// The writing room pulls in the editor (~ProseMirror) and, on demand, the Word
// and PowerPoint format libraries — all kept out of the initial bundle.
const DocumentsPage = lazy(() =>
  import('./pages/documents/DocumentsPage').then((m) => ({ default: m.DocumentsPage })),
);
const DocumentEditorPage = lazy(() =>
  import('./pages/documents/DocumentEditorPage').then((m) => ({ default: m.DocumentEditorPage })),
);

/**
 * App root: providers → router → shell → routes.
 *
 * Every route referenced by the navigation, search results, and the daily
 * edition links has an entry here. Pages that are not built out yet render a
 * lightweight placeholder rather than 404, so the shell stays navigable.
 */
export function App() {
  return (
    <BrowserRouter>
      <AppStateProvider>
        <PomodoroProvider>
          <Shell>
            <Suspense fallback={<div className="page"><Skeleton height={120} count={3} /></div>}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/focus" element={<FocusPage />} />
                <Route path="/ask" element={<AskPage />} />
                <Route path="/books" element={<BooksPage />} />
                <Route path="/write" element={<DocumentsPage />} />
                <Route path="/write/:id" element={<DocumentEditorPage />} />
                <Route path="/labs" element={<LabsPage />} />
                <Route path="/labs/:subjectId" element={<SubjectPage />} />
                <Route path="/topics/:topicId" element={<TopicPage />} />
                <Route path="/research" element={<ResearchPage />} />
                <Route path="/formulas" element={<FormulasPage />} />
                <Route path="/facts" element={<FactsPage />} />
                <Route path="/timeline" element={<TimelinePage />} />
                <Route path="/notes" element={<NotesPage />} />
                <Route path="/questions" element={<QuestionsPage />} />
                <Route path="/saved" element={<SavedPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/people/:personId" element={<PersonPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </Shell>
        </PomodoroProvider>
      </AppStateProvider>
    </BrowserRouter>
  );
}
