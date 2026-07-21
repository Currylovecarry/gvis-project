import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  CircleOff,
  Download,
  FileText,
  Library,
  Minus,
  Moon,
  Plus,
  Search,
  Sparkles,
  Sun,
  Trash2,
  Type,
  Upload,
  WandSparkles,
} from "lucide-react";
import {
  CSSProperties,
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import booksCoffeeHanddrawn from "./assets/books_coffee_handdrawn.svg";
import readerNotebook from "./assets/reader_notebook.svg";
import logo1 from "./assets/logos/72084966-334c-451a-81b9-b37c9220db74-1782974934891_IMG_1347.svg";
import logo3 from "./assets/logos/31b1e46e-0fe1-4702-936a-bdd805edd20f-1782974934894_IMG_1349.svg";
import logo4 from "./assets/logos/bc34797c-7ded-48bc-87cc-cfcbfe5e204f-1782974934894_IMG_1348.svg";
import logo5 from "./assets/logos/21ce9ae5-90df-4728-9433-34dee7d13417-1782975463348_Oe_2026-07-02_14.55.33.svg";
import { submitExperimentLog } from "./api/experimentLogApi";
import { extractNarrativeJson } from "./api/narrativeApi";
import { CharacterGraph, SidebarCharacterRelations } from "./components/CharacterGraph";
import { SidebarEventTimeline } from "./components/EventTimeline";
import { NarrativeDebugPanel } from "./components/NarrativeDebugPanel";
import { Book, BookFormat, getBookTextStats } from "./data/books";
import {
  DEMO_NARRATIVES,
  getMediumAutoRevealMilestones,
  getProgressiveDemoNarrative,
} from "./data/demoNarratives";
import { SYSTEM_GUIDE_BOOK, SYSTEM_GUIDE_BOOK_ID } from "./data/systemGuide";
import {
  archiveExperimentLog,
  completeExperimentSession,
  downloadExperimentLog,
  recordExperimentAssistanceCall,
  recordExperimentModeSelection,
  recordExperimentVisualizationDetailOpen,
  setExperimentSessionActive,
  startExperimentSession,
  type ExperimentSessionRuntime,
} from "./experiment/experimentLog";
import type {
  ExperimentAiMode,
  ExperimentAssistanceTrigger,
  ExperimentCompletionStatus,
  ExperimentLog,
  ExperimentVisualizationDetail,
} from "./types/experiment";
import type { NarrativeJsonResponse } from "./types/narrative";
import { parseEpubFile, parseTextFile } from "./utils/epub";
import { loadPdfDocument, parsePdfFile, type PDFDocumentProxy } from "./utils/pdf";
import {
  buildReadingScopeIndex,
  getCurrentStoryTextUntilPage,
  type CurrentStoryScope,
  type ReadingScopeIndex,
} from "./utils/readingScope";

type View = "welcome" | "library" | "reader";
type ReaderTheme = "paper" | "plain" | "night";
type AiMode = ExperimentAiMode;

type ExperimentSaveStatus = "saving" | "saved" | "local-only";

type ExperimentReceipt = {
  log: ExperimentLog;
  saveStatus: ExperimentSaveStatus;
  locallyArchived: boolean;
};

type ReaderSettings = {
  fontScale: number;
  lineHeight: number;
  theme: ReaderTheme;
};

const progressKey = "gvis-reader-progress";
const settingsKey = "gvis-reader-settings";

const defaultSettings: ReaderSettings = {
  fontScale: 0.88,
  lineHeight: 1.56,
  theme: "paper",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatPercent(value: number) {
  return `${Math.round(clamp(value, 0, 1) * 100)}%`;
}

function getProgressStorageKey(bookId: string, participantId: string) {
  return `${progressKey}:${encodeURIComponent(participantId)}:${bookId}`;
}

function getSavedProgress(bookId: string, participantId: string) {
  const raw = window.localStorage.getItem(getProgressStorageKey(bookId, participantId));
  const value = raw ? Number.parseFloat(raw) : 0;
  return Number.isFinite(value) ? clamp(value, 0, 1) : 0;
}

function readSettings(): ReaderSettings {
  const raw = window.localStorage.getItem(settingsKey);
  if (!raw) return defaultSettings;

  try {
    const value = JSON.parse(raw) as Partial<ReaderSettings>;
    return {
      fontScale: clamp(Number(value.fontScale ?? defaultSettings.fontScale), 0.88, 1.28),
      lineHeight: clamp(Number(value.lineHeight ?? defaultSettings.lineHeight), 1.48, 1.92),
      theme: value.theme === "plain" || value.theme === "night" ? value.theme : "paper",
    };
  } catch {
    return defaultSettings;
  }
}

function formatLabel(format: BookFormat) {
  const labels: Record<BookFormat, string> = {
    sample: "样本",
    epub: "EPUB",
    txt: "TXT",
    pdf: "PDF",
  };
  return labels[format];
}

function buildFallbackNarrativeJson(scope: CurrentStoryScope): NarrativeJsonResponse {
  return {
    story_title: scope.title,
    range: {
      startIndex: scope.startIndex,
      endIndex: scope.endIndex,
    },
    characters: [
      {
        id: "c1",
        name: "Reader",
        aliases: [],
        description: "A placeholder character for local graph preview.",
        evidence: scope.text.slice(0, 80),
        confidence: 0.5,
      },
    ],
    events: [],
    relations: [],
  };
}

const coverImages = [logo1, logo3, logo4, logo5];

const preloadedBooks = [
  { path: "/books/财神与爱神 - 未知.epub", id: "fortune-and-love" },
  { path: "/books/托宾的手相 - 未知.epub", id: "tobins-palm" },
  { path: "/books/华而不实 - 未知.epub", id: "the-sham" },
  { path: "/books/昙花一现 - 未知.epub", id: "the-brief-debut-of-tildy" },
];

function App() {
  const [view, setView] = useState<View>("welcome");
  const [query, setQuery] = useState("");
  const [libraryBooks, setLibraryBooks] = useState<Book[]>([SYSTEM_GUIDE_BOOK]);
  const [activeBook, setActiveBook] = useState<Book | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [settings, setSettings] = useState<ReaderSettings>(readSettings);
  const nextCoverRef = useRef(0);
  const [progressByBook, setProgressByBook] = useState<Record<string, number>>({});
  const [pendingBook, setPendingBook] = useState<Book | null>(null);
  const [activeParticipantId, setActiveParticipantId] = useState<string | null>(null);
  const [experimentReceipt, setExperimentReceipt] = useState<ExperimentReceipt | null>(null);
  const experimentSessionRef = useRef<ExperimentSessionRuntime | null>(null);

  useEffect(() => {
    const updateSessionActivity = () => {
      const session = experimentSessionRef.current;
      if (!session) return;
      setExperimentSessionActive(session, document.visibilityState === "visible");
    };

    document.addEventListener("visibilitychange", updateSessionActivity);
    return () => document.removeEventListener("visibilitychange", updateSessionActivity);
  }, []);

  useEffect(() => {
    const loadPreloadedBooks = async () => {
      for (const { path, id } of preloadedBooks) {
        try {
          const response = await fetch(path);
          const blob = await response.blob();
          const file = new File([blob], path.split("/").pop() || "book.epub", {
            type: "application/epub+zip",
          });
          const book = await parseEpubFile(file);
          book.id = id;
          book.coverIndex = nextCoverRef.current;
          nextCoverRef.current = (nextCoverRef.current + 1) % coverImages.length;
          setLibraryBooks((prev) => {
            if (prev.some((b) => b.id === id)) return prev;
            return [...prev, book];
          });
        } catch (error) {
          console.error(`Failed to load ${path}:`, error);
        }
      }
    };
    loadPreloadedBooks();
  }, []);

  const filteredBooks = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const guideBook = libraryBooks.find((book) => book.id === SYSTEM_GUIDE_BOOK_ID);
    const searchableBooks = libraryBooks.filter((book) => book.id !== SYSTEM_GUIDE_BOOK_ID);
    const matchingBooks = !normalized ? searchableBooks : searchableBooks.filter((book) =>
      `${book.title} ${book.author} ${formatLabel(book.format)}`.toLowerCase().includes(normalized),
    );
    return guideBook ? [guideBook, ...matchingBooks] : matchingBooks;
  }, [libraryBooks, query]);

  const updateSettings = useCallback((nextSettings: ReaderSettings) => {
    setSettings(nextSettings);
    window.localStorage.setItem(settingsKey, JSON.stringify(nextSettings));
  }, []);

  const updateBookProgress = useCallback((bookId: string, progress: number) => {
    const nextProgress = clamp(progress, 0, 1);
    setProgressByBook((current) => {
      const currentValue = current[bookId] ?? 0;
      if (Math.abs(currentValue - nextProgress) < 0.002) return current;
      return { ...current, [bookId]: nextProgress };
    });
    if (activeParticipantId) {
      window.localStorage.setItem(
        getProgressStorageKey(bookId, activeParticipantId),
        String(nextProgress),
      );
    }
  }, [activeParticipantId]);

  const openBook = (book: Book) => {
    setPendingBook(book);
  };

  const startReadingExperiment = (participantId: string) => {
    if (!pendingBook) return;

    const initialProgress = getSavedProgress(pendingBook.id, participantId);
    experimentSessionRef.current = startExperimentSession({
      participantId,
      book: pendingBook,
      initialProgress,
    });
    setActiveParticipantId(participantId);
    setActiveBook(pendingBook);
    setProgressByBook((current) => ({
      ...current,
      [pendingBook.id]: initialProgress,
    }));
    setPendingBook(null);
    setExperimentReceipt(null);
    setView("reader");
  };

  const recordModeSelection = useCallback((mode: ExperimentAiMode, progress: number) => {
    const session = experimentSessionRef.current;
    if (!session) return;
    recordExperimentModeSelection(session, mode, progress);
  }, []);

  const recordAssistanceCall = useCallback((
    mode: "low" | "medium",
    trigger: ExperimentAssistanceTrigger,
    progress: number,
  ) => {
    const session = experimentSessionRef.current;
    if (!session) return;
    recordExperimentAssistanceCall(session, mode, trigger, progress);
  }, []);

  const recordVisualizationDetailOpen = useCallback((
    visualizationDetail: ExperimentVisualizationDetail,
    mode: ExperimentAiMode,
    progress: number,
  ) => {
    const session = experimentSessionRef.current;
    if (!session) return;
    recordExperimentVisualizationDetailOpen(
      session,
      visualizationDetail,
      mode,
      progress,
    );
  }, []);

  const finishReadingExperiment = useCallback((
    completionStatus: ExperimentCompletionStatus,
    finalProgress: number,
  ) => {
    const session = experimentSessionRef.current;
    if (!session) return;

    const log = completeExperimentSession(session, completionStatus, finalProgress);
    const locallyArchived = archiveExperimentLog(log);
    if (completionStatus === "completed") {
      downloadExperimentLog(log);
    }
    experimentSessionRef.current = null;
    setExperimentReceipt({
      log,
      locallyArchived,
      saveStatus: "saving",
    });
    setActiveParticipantId(null);
    setActiveBook(null);
    setView("library");

    void submitExperimentLog(log)
      .then(() => {
        setExperimentReceipt((current) =>
          current?.log.sessionId === log.sessionId
            ? { ...current, saveStatus: "saved" }
            : current,
        );
      })
      .catch(() => {
        setExperimentReceipt((current) =>
          current?.log.sessionId === log.sessionId
            ? { ...current, saveStatus: "local-only" }
            : current,
        );
      });
  }, []);

  const closeReader = () => {
    const session = experimentSessionRef.current;
    if (!session) {
      setView("library");
      return;
    }

    const confirmed = window.confirm("退出阅读会结束本次实验记录，确定退出吗？");
    if (!confirmed) return;
    const finalProgress = activeBook ? progressByBook[activeBook.id] ?? 0 : 0;
    finishReadingExperiment("abandoned", finalProgress);
  };

  const createPlaceholderBook = (file: File): Book => {
    const title = file.name.replace(/\.[^/.]+$/, "") || "未命名文件";

    return {
      id: `${Date.now()}-${file.name}`,
      title,
      author: file.type || "本地文件",
      format: "sample",
      sections: [
        {
          id: "placeholder",
          label: "1",
          heading: title,
          paragraphs: [
            "这本文件已经添加到书库。",
            "当前基础阅读器支持 EPUB、TXT 和 PDF。这个文件类型暂时还没有专门的解析器。",
          ],
        },
      ],
      importedAt: Date.now(),
    };
  };

  const importBook = async (file: File) => {
    setIsImporting(true);
    setImportError("");

    try {
      const lowerName = file.name.toLowerCase();
      const importedBook = lowerName.endsWith(".epub")
        ? await parseEpubFile(file)
        : lowerName.endsWith(".txt")
          ? await parseTextFile(file)
          : lowerName.endsWith(".pdf")
            ? await parsePdfFile(file)
            : createPlaceholderBook(file);

      importedBook.coverIndex = nextCoverRef.current;
      nextCoverRef.current = (nextCoverRef.current + 1) % coverImages.length;

      setLibraryBooks((currentBooks) => [importedBook, ...currentBooks]);
      setPendingBook(importedBook);
      setView("library");
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "导入失败");
    } finally {
      setIsImporting(false);
    }
  };

  const deleteBook = (book: Book) => {
    const confirmed = window.confirm(`确定要从书库删除《${book.title}》吗？`);
    if (!confirmed) return;

    const fallbackBook = libraryBooks.find((currentBook) => currentBook.id !== book.id);
    setLibraryBooks((currentBooks) =>
      currentBooks.filter((currentBook) => currentBook.id !== book.id),
    );
    if (activeBook?.id === book.id) {
      setActiveBook(fallbackBook ?? null);
    }
    setProgressByBook((current) => {
      const { [book.id]: _deletedProgress, ...rest } = current;
      return rest;
    });
    if (activeParticipantId) {
      window.localStorage.removeItem(getProgressStorageKey(book.id, activeParticipantId));
    }
  };

  return (
    <main className="app-shell">
      {view === "welcome" ? (
        <WelcomeView onEnter={() => setView("library")} />
      ) : view === "library" || !activeBook ? (
        <LibraryView
          books={filteredBooks}
          query={query}
          progressByBook={progressByBook}
          onQueryChange={setQuery}
          onOpenBook={openBook}
          onDeleteBook={deleteBook}
          onImportBook={importBook}
          isImporting={isImporting}
          importError={importError}
        />
      ) : (
        <ReaderView
          book={activeBook}
          progress={progressByBook[activeBook.id] ?? 0}
          settings={settings}
          onBack={closeReader}
          onAssistanceCall={recordAssistanceCall}
          onFinish={(finalProgress) => finishReadingExperiment("completed", finalProgress)}
          onModeSelection={recordModeSelection}
          onProgressChange={updateBookProgress}
          onSettingsChange={updateSettings}
          onVisualizationDetailOpen={recordVisualizationDetailOpen}
        />
      )}
      {pendingBook && (
        <ExperimentParticipantDialog
          book={pendingBook}
          onCancel={() => setPendingBook(null)}
          onStart={startReadingExperiment}
        />
      )}
      {experimentReceipt && (
        <ExperimentReceiptDialog
          receipt={experimentReceipt}
          onClose={() => setExperimentReceipt(null)}
          onDownload={() => downloadExperimentLog(experimentReceipt.log)}
        />
      )}
    </main>
  );
}

type WelcomeViewProps = {
  onEnter: () => void;
};

function WelcomeView({ onEnter }: WelcomeViewProps) {
  useEffect(() => {
    const timer = window.setTimeout(onEnter, 3000);
    return () => window.clearTimeout(timer);
  }, [onEnter]);

  return (
    <section className="welcome-screen" aria-label="Lumen 微光">
      <div className="welcome-journal" aria-hidden="true">
        <img className="journal-sticker sticker-1355" src="/start/IMG_1355.jpg" alt="" />
        <img className="journal-sticker sticker-1356" src="/start/IMG_1356.jpg" alt="" />
        <img className="journal-sticker sticker-1357" src="/start/IMG_1357.jpg" alt="" />
        <img className="journal-sticker sticker-1358" src="/start/IMG_1358.jpg" alt="" />
        <img className="journal-sticker sticker-1359" src="/start/IMG_1359.jpg" alt="" />
        <img className="journal-sticker sticker-1360" src="/start/IMG_1360.jpg" alt="" />
        <img className="journal-sticker sticker-1362" src="/start/IMG_1362.jpg" alt="" />
        <img className="journal-sticker sticker-1363" src="/start/IMG_1363.jpg" alt="" />
        <img className="journal-sticker sticker-1364" src="/start/IMG_1364.jpg" alt="" />
        <img className="journal-sticker sticker-1365" src="/start/IMG_1365.jpg" alt="" />
        <img className="journal-sticker sticker-1366" src="/start/IMG_1366.jpg" alt="" />
        <span className="journal-note note-date">July 02</span>
        <span className="journal-note note-soft">quiet reading</span>
      </div>
      <div className="welcome-card">
        <div className="welcome-brandmark">
          <h1 className="welcome-title">
            <span>Lumen · </span>
            <span className="welcome-title-cn">微光</span>
          </h1>
        </div>
        <p className="welcome-subtitle">A little light, just when you need it.</p>
        <div className="welcome-loading" aria-hidden="true" />
      </div>
    </section>
  );
}

type LibraryViewProps = {
  books: Book[];
  query: string;
  progressByBook: Record<string, number>;
  onQueryChange: (value: string) => void;
  onOpenBook: (book: Book) => void;
  onDeleteBook: (book: Book) => void;
  onImportBook: (file: File) => Promise<void>;
  isImporting: boolean;
  importError: string;
};

function LibraryView({
  books: libraryBooks,
  query,
  progressByBook,
  onQueryChange,
  onOpenBook,
  onDeleteBook,
  onImportBook,
  isImporting,
  importError,
}: LibraryViewProps) {
  const fileInputId = "book-import-input";
  const [libraryPage, setLibraryPage] = useState<"shelf" | "demo">("shelf");
  const [activeDemoId, setActiveDemoId] = useState(DEMO_NARRATIVES[0].id);
  const activeDemo = DEMO_NARRATIVES.find((demo) => demo.id === activeDemoId) ?? DEMO_NARRATIVES[0];
  const guideBooks = libraryBooks.filter((book) => book.id === SYSTEM_GUIDE_BOOK_ID);
  const experimentBooks = libraryBooks.filter((book) => book.id !== SYSTEM_GUIDE_BOOK_ID);
  const openSystemGuide = () => {
    const guideBook = guideBooks[0];
    if (guideBook) onOpenBook(guideBook);
  };

  const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    void onImportBook(file);
    event.target.value = "";
  };

  return (
    <div className="library-layout">
      <input
        id={fileInputId}
        className="file-input"
        type="file"
        accept=".epub,.txt,.pdf,application/epub+zip,application/pdf,text/plain"
        disabled={isImporting}
        onChange={handleImport}
      />
      <header className="mobile-header">
        <strong className="brand-title">
          <img className="brand-emblem" src="/site-icon.png" alt="" aria-hidden="true" />
          <span className="brand-wordmark">
            <span>Lumen · </span>
            <span className="brand-title-cn">微光</span>
          </span>
        </strong>
        <div className="mobile-header-actions">
          <button
            className="mobile-guide-button"
            type="button"
            onClick={openSystemGuide}
            disabled={!guideBooks.length}
            aria-label="开始演示"
            title="演示组"
          >
            <BookOpen size={18} strokeWidth={2.1} />
          </button>
          <label className="import-button" htmlFor={fileInputId} aria-label="导入图书">
            <Upload size={18} strokeWidth={2.2} />
          </label>
        </div>
      </header>

      <div className="mobile-search">
        <Search size={16} strokeWidth={2.2} />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="搜索书名或作者"
          type="search"
        />
      </div>

      <aside className="library-sidebar" aria-label="书库导航">
        <div className="brand-block">
          <div>
            <strong className="brand-title">
              <img className="brand-emblem" src="/site-icon.png" alt="" aria-hidden="true" />
              <span className="brand-wordmark">
                <span>Lumen · </span>
                <span className="brand-title-cn">微光</span>
              </span>
            </strong>
          </div>
        </div>

        <label className="search-field">
          <Search size={18} strokeWidth={2.2} />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="搜索书名或作者"
            type="search"
          />
        </label>

        <nav className="nav-list">
          <button className={`nav-item${libraryPage === "shelf" ? " active" : ""}`} type="button" onClick={() => setLibraryPage("shelf")}>
            <Library size={19} strokeWidth={2.1} />
            <span>全部图书</span>
          </button>
          <button
            className="nav-item"
            type="button"
            onClick={openSystemGuide}
            disabled={!guideBooks.length}
          >
            <BookOpen size={19} strokeWidth={2.1} />
            <span>演示组</span>
          </button>
          <button className={`nav-item${libraryPage === "demo" ? " active" : ""}`} type="button" onClick={() => setLibraryPage("demo")}>
            <Sparkles size={19} strokeWidth={2.1} />
            <span>可视化 Demo</span>
          </button>
        </nav>

        <div className="sidebar-reading-illustration" aria-hidden="true">
          <img src={booksCoffeeHanddrawn} alt="" />
        </div>
      </aside>

      <section className={`library-main${libraryPage === "demo" ? " library-main-demo" : ""}`} aria-label="书库">
        {libraryPage === "demo" ? (
          <section className="library-map-demo" aria-label={`${activeDemo.title}事件地点图示例`}>
            <header>
              <p>Visualization demo · {DEMO_NARRATIVES.length} stories</p>
              <h1>{activeDemo.title}</h1>
              <span>事件进展与地点</span>
              <div className="library-demo-switcher" aria-label="选择实验书籍">
                {DEMO_NARRATIVES.map((demo) => (
                  <button
                    className={demo.id === activeDemo.id ? "active" : ""}
                    type="button"
                    key={demo.id}
                    onClick={() => setActiveDemoId(demo.id)}
                    aria-pressed={demo.id === activeDemo.id}
                  >
                    {demo.title}
                  </button>
                ))}
              </div>
            </header>
            <SidebarEventTimeline
              key={activeDemo.id}
              characters={activeDemo.characters}
              events={activeDemo.events}
              variant="demo"
            />
          </section>
        ) : (
          <>
            <header className="library-header">
              <div>
                <p>Library</p>
                <h1>书库</h1>
              </div>
              <div className="library-actions">
                <label
                  className={`import-button${isImporting ? " importing" : ""}`}
                  htmlFor={fileInputId}
                  aria-label="导入图书"
                  title={isImporting ? "正在导入" : "导入图书"}
                >
                  <Upload size={19} strokeWidth={2.2} />
                  <span>{isImporting ? "导入中" : "导入"}</span>
                </label>
              </div>
            </header>

            {experimentBooks.length ? (
              <div className="library-shelf-scroll">
                <div className="book-grid">
                  {experimentBooks.map((book) => (
                    <BookTile
                      book={book}
                      key={book.id}
                      canDelete
                      onOpenBook={onOpenBook}
                      onDeleteBook={onDeleteBook}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <FileText size={34} strokeWidth={1.8} />
                <strong>没有找到匹配的图书</strong>
              </div>
            )}

            <footer className="library-footer">
              <span>
                {isImporting
                  ? "正在解析文件..."
                  : `${experimentBooks.length} 本书`}
              </span>
              {importError && <strong>{importError}</strong>}
            </footer>
          </>
        )}
      </section>
    </div>
  );
}

type BookTileProps = {
  book: Book;
  canDelete: boolean;
  onOpenBook: (book: Book) => void;
  onDeleteBook: (book: Book) => void;
};

function BookTile({ book, canDelete, onOpenBook, onDeleteBook }: BookTileProps) {
  return (
    <article className="book-card">
      <button
        className="book-tile"
        type="button"
        onClick={() => onOpenBook(book)}
        aria-label={`打开 ${book.title}`}
      >
        <BookCover book={book} />
        <div className="book-tile-body">
          <strong>{book.title}</strong>
        </div>
      </button>
      {canDelete && (
        <button
          className="book-delete-button"
          type="button"
          onClick={() => onDeleteBook(book)}
          aria-label={`删除 ${book.title}`}
          title="删除"
        >
          <Trash2 size={16} strokeWidth={2.1} />
        </button>
      )}
    </article>
  );
}

function BookCover({ book }: { book: Book }) {
  const coverImage = book.coverIndex !== undefined ? coverImages[book.coverIndex % coverImages.length] : null;

  return (
    <div className={`book-cover cover-${book.format}`} aria-hidden="true">
      {coverImage && <img src={coverImage} alt="" className="book-cover-image" />}
    </div>
  );
}

type ExperimentParticipantDialogProps = {
  book: Book;
  onCancel: () => void;
  onStart: (participantId: string) => void;
};

function ExperimentParticipantDialog({
  book,
  onCancel,
  onStart,
}: ExperimentParticipantDialogProps) {
  const [participantId, setParticipantId] = useState("");
  const [validationError, setValidationError] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedId = participantId.trim();
    if (!normalizedId) {
      setValidationError("请输入参与者 ID");
      return;
    }
    onStart(normalizedId);
  };

  return (
    <div className="experiment-dialog-backdrop">
      <section
        className="experiment-dialog experiment-participant-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="experiment-participant-title"
      >
        <form onSubmit={handleSubmit}>
          <p className="experiment-dialog-kicker">阅读实验</p>
          <h2 id="experiment-participant-title">开始阅读《{book.title}》</h2>
          <p className="experiment-dialog-description">
            请输入分配给你的实验编号。本次阅读会记录阅读时长，以及 Low、Medium 辅助的调用情况。
          </p>
          <label className="experiment-id-field">
            <span>参与者 ID</span>
            <input
              autoComplete="off"
              autoFocus
              maxLength={64}
              name="participantId"
              onChange={(event) => {
                setParticipantId(event.target.value);
                if (validationError) setValidationError("");
              }}
              placeholder="例如 P001"
              value={participantId}
            />
          </label>
          {validationError && <p className="experiment-form-error" role="alert">{validationError}</p>}
          <p className="experiment-privacy-note">请只填写实验编号，不要填写姓名或联系方式。</p>
          <div className="experiment-dialog-actions">
            <button className="experiment-secondary-button" type="button" onClick={onCancel}>取消</button>
            <button className="experiment-primary-button" type="submit">开始阅读</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ExperimentReceiptDialog({
  receipt,
  onClose,
  onDownload,
}: {
  receipt: ExperimentReceipt;
  onClose: () => void;
  onDownload: () => void;
}) {
  const { log, locallyArchived, saveStatus } = receipt;
  const saveMessage = saveStatus === "saving"
    ? "正在保存实验记录…"
    : saveStatus === "saved"
      ? locallyArchived
        ? "记录已写入实验服务器，并保留在本浏览器。"
        : "记录已写入实验服务器。"
      : locallyArchived
        ? "服务器暂时未连接；记录已保存在本浏览器，请下载 JSON 备份。"
        : "自动保存未成功，请立即下载 JSON 文件。";

  return (
    <div className="experiment-dialog-backdrop">
      <section
        className="experiment-dialog experiment-receipt-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="experiment-receipt-title"
      >
        <CheckCircle2 aria-hidden="true" className="experiment-receipt-icon" size={30} strokeWidth={1.8} />
        <p className="experiment-dialog-kicker">记录完成</p>
        <h2 id="experiment-receipt-title">
          {log.completionStatus === "completed" ? "本次阅读已结束" : "本次阅读已退出"}
        </h2>
        <dl className="experiment-receipt-summary">
          <div>
            <dt>参与者</dt>
            <dd>{log.participantId}</dd>
          </div>
          <div>
            <dt>活跃阅读时长</dt>
            <dd>{formatExperimentDuration(log.readingDurationSeconds)}</dd>
          </div>
          <div>
            <dt>Low 调用</dt>
            <dd>{log.assistance.low.callCount} 次</dd>
          </div>
          <div>
            <dt>Medium 调用</dt>
            <dd>{log.assistance.medium.callCount} 次</dd>
          </div>
        </dl>
        <p className={`experiment-save-status status-${saveStatus}`} aria-live="polite">{saveMessage}</p>
        <div className="experiment-dialog-actions">
          <button className="experiment-secondary-button" type="button" onClick={onDownload}>
            <Download aria-hidden="true" size={16} strokeWidth={2} />
            下载 JSON
          </button>
          <button
            className="experiment-primary-button"
            type="button"
            disabled={saveStatus === "saving"}
            onClick={onClose}
          >
            {saveStatus === "saving" ? "保存中…" : "完成"}
          </button>
        </div>
      </section>
    </div>
  );
}

function formatExperimentDuration(seconds: number) {
  const totalSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = totalSeconds % 60;
  return minutes > 0 ? `${minutes} 分 ${remainder} 秒` : `${remainder} 秒`;
}

type ReaderViewProps = {
  book: Book;
  progress: number;
  settings: ReaderSettings;
  onBack: () => void;
  onAssistanceCall: (
    mode: "low" | "medium",
    trigger: ExperimentAssistanceTrigger,
    progress: number,
  ) => void;
  onFinish: (finalProgress: number) => void;
  onModeSelection: (mode: ExperimentAiMode, progress: number) => void;
  onProgressChange: (bookId: string, progress: number) => void;
  onSettingsChange: (settings: ReaderSettings) => void;
  onVisualizationDetailOpen: (
    visualizationDetail: ExperimentVisualizationDetail,
    mode: ExperimentAiMode,
    progress: number,
  ) => void;
};

function ReaderView({
  book,
  progress,
  settings,
  onBack,
  onAssistanceCall,
  onFinish,
  onModeSelection,
  onProgressChange,
  onSettingsChange,
  onVisualizationDetailOpen,
}: ReaderViewProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const aiMarkerRef = useRef<HTMLButtonElement>(null);
  const narrativeDebugRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const progressRef = useRef(progress);
  const restoringRef = useRef(true);
  const lastHighAutoUpdateRef = useRef<string | null>(null);
  const previousMediumMarkerProgressRef = useRef<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aiMode, setAiMode] = useState<AiMode>("zero");
  const [areManualVisualizationsRevealed, setAreManualVisualizationsRevealed] = useState(false);
  const [isManualRefreshRequested, setIsManualRefreshRequested] = useState(false);
  const [currentScrollSegment, setCurrentScrollSegment] = useState(0);
  const [narrativeScope, setNarrativeScope] = useState<CurrentStoryScope | null>(null);
  const [narrativeResult, setNarrativeResult] = useState<NarrativeJsonResponse | null>(null);
  const [narrativeError, setNarrativeError] = useState("");
  const [isExtractingNarrative, setIsExtractingNarrative] = useState(false);
  const [isNarrativeDebugVisible, setIsNarrativeDebugVisible] = useState(false);
  const [isNarrativeMapFullscreen, setIsNarrativeMapFullscreen] = useState(false);
  const [isCharacterGraphFullscreen, setIsCharacterGraphFullscreen] = useState(false);
  const [isNarrativeSyncing, setIsNarrativeSyncing] = useState(false);
  const [mediumMarkerEndIndex, setMediumMarkerEndIndex] = useState(0);
  const [highMarkerEndIndex, setHighMarkerEndIndex] = useState(0);
  const stats = useMemo(() => getBookTextStats(book), [book]);
  const isPdf = book.format === "pdf" && book.pdf;
  const isZeroMode = aiMode === "zero";
  const isManualNarrativeMode = aiMode === "low" || aiMode === "medium";
  const areVisualizationsObscured =
    isManualNarrativeMode && !areManualVisualizationsRevealed;
  const documentStyle = {
    "--reader-font-scale": settings.fontScale,
    "--reader-line-height": settings.lineHeight,
  } as CSSProperties;
  const readingScopeIndex = useMemo<ReadingScopeIndex>(
    () => buildReadingScopeIndex(book.sections),
    [book.sections],
  );
  const isProgressiveDemo = getProgressiveDemoNarrative(book.id, 0) !== null;
  const mediumAutoRevealMilestones = useMemo(
    () => getMediumAutoRevealMilestones(book.id),
    [book.id],
  );
  const shouldSyncProgressiveNarrative =
    isProgressiveDemo && isManualNarrativeMode && isManualRefreshRequested;
  const readingProgress = progress;
  const paragraphRangeByKey = useMemo(
    () =>
      new Map(
        readingScopeIndex.paragraphs.map((paragraph) => [
          `${paragraph.sectionId}:${paragraph.paragraphIndex}`,
          paragraph,
        ]),
      ),
    [readingScopeIndex.paragraphs],
  );

  const getTextIndexAtViewportY = useCallback((viewportY: number) => {
    const stage = stageRef.current;
    if (!stage) return 0;
    const paragraphNodes = Array.from(
      stage.querySelectorAll<HTMLElement>("[data-section-id][data-paragraph-index]"),
    );
    if (!paragraphNodes.length) return 0;

    const getRangeForNode = (node: HTMLElement) => {
      const sectionId = node.dataset.sectionId;
      const paragraphIndex = Number(node.dataset.paragraphIndex);
      if (!sectionId || !Number.isFinite(paragraphIndex)) return undefined;
      return paragraphRangeByKey.get(`${sectionId}:${paragraphIndex}`);
    };

    let low = 0;
    let high = paragraphNodes.length - 1;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const node = paragraphNodes[middle];
      const rect = node.getBoundingClientRect();

      if (viewportY < rect.top) {
        high = middle - 1;
        continue;
      }
      if (viewportY > rect.bottom) {
        low = middle + 1;
        continue;
      }

      const paragraphRange = getRangeForNode(node);
      if (!paragraphRange) return 0;

      const paragraphLength = paragraphRange.endIndex - paragraphRange.startIndex;
      const visibleRatio = rect.height <= 0
        ? 0
        : clamp((viewportY - rect.top) / rect.height, 0, 1);
      return clamp(
        paragraphRange.startIndex + Math.floor(paragraphLength * visibleRatio),
        paragraphRange.startIndex,
        paragraphRange.endIndex,
      );
    }

    if (high >= 0) {
      return getRangeForNode(paragraphNodes[high])?.endIndex ?? 0;
    }
    return getRangeForNode(paragraphNodes[Math.min(low, paragraphNodes.length - 1)])?.startIndex ?? 0;
  }, [paragraphRangeByKey]);

  const getScrollViewportStartIndex = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return 0;
    return getTextIndexAtViewportY(stage.getBoundingClientRect().top);
  }, [getTextIndexAtViewportY]);

  const getScrollViewportEndIndex = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return 0;
    return (
      getTextIndexAtViewportY(stage.getBoundingClientRect().bottom) ||
      readingScopeIndex.paragraphs[0]?.endIndex ||
      0
    );
  }, [getTextIndexAtViewportY, readingScopeIndex.paragraphs]);

  const getCurrentStoryScope = useCallback(() => {
    const currentViewportEndIndex = isPdf ? 0 : getScrollViewportEndIndex();

    return getCurrentStoryTextUntilPage(
      readingScopeIndex.fullText,
      currentViewportEndIndex,
      readingScopeIndex.chapters,
    );
  }, [
    getScrollViewportEndIndex,
    isPdf,
    readingScopeIndex.chapters,
    readingScopeIndex.fullText,
  ]);

  const getStoryScopeAtAiMarker = useCallback((anchor: HTMLElement | null) => {
    const stage = stageRef.current;
    if (!stage || !anchor) return getCurrentStoryScope();

    const anchorRect = anchor.getBoundingClientRect();
    const markerY = anchorRect.top + anchorRect.height / 2;
    const markerEndIndex = getTextIndexAtViewportY(markerY);

    if (markerEndIndex <= 0) return getCurrentStoryScope();
    return getCurrentStoryTextUntilPage(
      readingScopeIndex.fullText,
      markerEndIndex,
      readingScopeIndex.chapters,
    );
  }, [
    getCurrentStoryScope,
    getTextIndexAtViewportY,
    readingScopeIndex.chapters,
    readingScopeIndex.fullText,
  ]);

  const handleExtractNarrativeJson = useCallback(async (scope = getCurrentStoryScope()) => {
    setNarrativeScope(scope);
    setNarrativeResult(null);

    if (!scope.text.trim()) {
      setNarrativeError("No reading scope available.");
      return;
    }

    setIsExtractingNarrative(true);
    setNarrativeError("");

    try {
      const result = await extractNarrativeJson({
        story_title: scope.title,
        text: scope.text,
        startIndex: scope.startIndex,
        endIndex: scope.endIndex,
      });
      setNarrativeResult(result);
    } catch (error) {
      setNarrativeResult(buildFallbackNarrativeJson(scope));
      setNarrativeError(
        error instanceof Error
          ? `${error.message} Showing local demo graph instead.`
          : "Narrative JSON extraction failed or backend is not running. Showing local demo graph instead.",
      );
    } finally {
      setIsExtractingNarrative(false);
    }
  }, [getCurrentStoryScope]);

  const handleAiExtractAtMarker = useCallback((anchor: HTMLButtonElement) => {
    const scope = getStoryScopeAtAiMarker(anchor);
    setSettingsOpen(false);
    if (aiMode === "low" || aiMode === "medium") {
      onAssistanceCall(aiMode, "manual", readingProgress);
    }
    if (isManualNarrativeMode) setAreManualVisualizationsRevealed(true);

    if (!scope?.text.trim()) {
      setAreManualVisualizationsRevealed(true);
      if (isProgressiveDemo) setIsManualRefreshRequested(true);
      else void handleExtractNarrativeJson();
      return;
    }

    if (aiMode === "high") {
      setHighMarkerEndIndex(scope.endIndex);
      lastHighAutoUpdateRef.current = `${book.id}:${scope.endIndex}`;
    }

    if (isProgressiveDemo) {
      setNarrativeScope(scope);
      setNarrativeResult(
        getProgressiveDemoNarrative(book.id, scope.endIndex / Math.max(readingScopeIndex.fullText.length, 1)),
      );
      setNarrativeError("");
      setIsNarrativeSyncing(false);
      return;
    }

    void handleExtractNarrativeJson(scope);
  }, [
    aiMode,
    book.id,
    getStoryScopeAtAiMarker,
    handleExtractNarrativeJson,
    isManualNarrativeMode,
    isProgressiveDemo,
    onAssistanceCall,
    readingProgress,
    readingScopeIndex.fullText.length,
  ]);

  useEffect(() => {
    setNarrativeScope(null);
    setNarrativeResult(null);
    setNarrativeError("");
    setIsExtractingNarrative(false);
    setIsNarrativeDebugVisible(false);
    setIsNarrativeMapFullscreen(false);
    setIsCharacterGraphFullscreen(false);
    setIsNarrativeSyncing(false);
    setAreManualVisualizationsRevealed(false);
    setIsManualRefreshRequested(false);
    setMediumMarkerEndIndex(0);
    setHighMarkerEndIndex(0);
    previousMediumMarkerProgressRef.current = null;
  }, [book.id]);

  useEffect(() => {
    if (aiMode !== "low") return;
    setAreManualVisualizationsRevealed(false);
    setIsManualRefreshRequested(false);
  }, [aiMode, readingProgress]);

  useEffect(() => {
    if (aiMode !== "medium") return;
    setAreManualVisualizationsRevealed(false);
    setIsManualRefreshRequested(false);
  }, [aiMode, currentScrollSegment]);

  useEffect(() => {
    if (!shouldSyncProgressiveNarrative) return;

    setIsNarrativeSyncing(true);
    const timer = window.setTimeout(() => {
      const result = getProgressiveDemoNarrative(book.id, readingProgress);
      setNarrativeScope(null);
      setNarrativeResult(result);
      setNarrativeError("");
      setIsNarrativeSyncing(false);
      setIsManualRefreshRequested(false);
    }, 480);

    return () => window.clearTimeout(timer);
  }, [book.id, readingProgress, shouldSyncProgressiveNarrative]);

  useEffect(() => {
    if (aiMode !== "medium") {
      previousMediumMarkerProgressRef.current = null;
      setMediumMarkerEndIndex(0);
      return;
    }
    if (isPdf || mediumMarkerEndIndex <= 0) return;

    const markerProgress = mediumMarkerEndIndex / Math.max(readingScopeIndex.fullText.length, 1);
    const previousProgress = previousMediumMarkerProgressRef.current;
    previousMediumMarkerProgressRef.current = markerProgress;

    // The automatic reveal is tied to the text position indicated by the
    // arrow. On first observation, inspect only the part of the current
    // continuous viewport that is already above the arrow.
    const detectionStart = previousProgress ?? (
      getScrollViewportStartIndex() / Math.max(readingScopeIndex.fullText.length, 1)
      - Number.EPSILON
    );

    setIsManualRefreshRequested(false);
    if (markerProgress <= detectionStart) return;

    const reachedMilestones = mediumAutoRevealMilestones.filter(
      (milestone) =>
        milestone.revealPoint > detectionStart &&
        milestone.revealPoint <= markerProgress,
    );
    if (!reachedMilestones.length) return;

    const result = getProgressiveDemoNarrative(book.id, markerProgress);
    if (!result) return;

    setNarrativeScope(
      getCurrentStoryTextUntilPage(
        readingScopeIndex.fullText,
        mediumMarkerEndIndex,
        readingScopeIndex.chapters,
      ),
    );
    setNarrativeResult(result);
    setNarrativeError("");
    setIsNarrativeSyncing(false);
    setAreManualVisualizationsRevealed(true);
    onAssistanceCall("medium", "automatic", markerProgress);
  }, [
    aiMode,
    book.id,
    getScrollViewportStartIndex,
    isPdf,
    mediumMarkerEndIndex,
    mediumAutoRevealMilestones,
    onAssistanceCall,
    readingScopeIndex.chapters,
    readingScopeIndex.fullText,
  ]);

  useEffect(() => {
    if (aiMode !== "high") {
      lastHighAutoUpdateRef.current = null;
      setHighMarkerEndIndex(0);
      setIsNarrativeSyncing(false);
    }
  }, [aiMode, book.id]);

  useEffect(() => {
    if (aiMode !== "high" || isPdf || highMarkerEndIndex <= 0) return;
    if (isExtractingNarrative) return;

    const scope = getCurrentStoryTextUntilPage(
      readingScopeIndex.fullText,
      highMarkerEndIndex,
      readingScopeIndex.chapters,
    );
    if (!scope.text.trim()) return;

    const scopeKey = `${book.id}:${scope.endIndex}`;
    if (lastHighAutoUpdateRef.current === scopeKey) return;

    setIsNarrativeSyncing(true);
    const timer = window.setTimeout(() => {
      if (lastHighAutoUpdateRef.current === scopeKey) return;
      lastHighAutoUpdateRef.current = scopeKey;
      if (isProgressiveDemo) {
        setNarrativeScope(scope);
        setNarrativeResult(
          getProgressiveDemoNarrative(
            book.id,
            scope.endIndex / Math.max(readingScopeIndex.fullText.length, 1),
          ),
        );
        setNarrativeError("");
        setIsNarrativeSyncing(false);
        return;
      }
      setIsNarrativeSyncing(false);
      void handleExtractNarrativeJson(scope);
    }, 600);

    return () => window.clearTimeout(timer);
  }, [
    aiMode,
    book.id,
    handleExtractNarrativeJson,
    highMarkerEndIndex,
    isExtractingNarrative,
    isPdf,
    isProgressiveDemo,
    readingScopeIndex.chapters,
    readingScopeIndex.fullText,
  ]);

  const updateAiMarkerPosition = useCallback(() => {
    if ((aiMode !== "medium" && aiMode !== "high") || isPdf) return;
    const scope = getStoryScopeAtAiMarker(aiMarkerRef.current);
    if (!scope?.text.trim()) return;
    if (aiMode === "medium") {
      setMediumMarkerEndIndex((current) => current === scope.endIndex ? current : scope.endIndex);
      return;
    }
    setHighMarkerEndIndex((current) => current === scope.endIndex ? current : scope.endIndex);
  }, [aiMode, getStoryScopeAtAiMarker, isPdf]);

  useEffect(() => {
    if ((aiMode !== "medium" && aiMode !== "high") || isPdf) return;
    const animationFrame = window.requestAnimationFrame(updateAiMarkerPosition);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [
    aiMode,
    currentScrollSegment,
    isPdf,
    settings.fontScale,
    settings.lineHeight,
    updateAiMarkerPosition,
  ]);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  const saveCurrentProgress = useCallback(() => {
    const stage = stageRef.current;
    if (restoringRef.current) return;

    const maxScroll = stage ? stage.scrollHeight - stage.clientHeight : 0;
    const nextProgress = !stage || maxScroll <= 0 ? 0 : stage.scrollTop / maxScroll;
    onProgressChange(book.id, nextProgress);
  }, [book.id, onProgressChange]);

  const finishReading = useCallback(() => {
    const stage = stageRef.current;
    const maxScroll = stage ? stage.scrollHeight - stage.clientHeight : 0;
    const finalProgress = !stage || maxScroll <= 0 ? 1 : stage.scrollTop / maxScroll;
    onProgressChange(book.id, finalProgress);
    onFinish(finalProgress);
  }, [book.id, onFinish, onProgressChange]);

  const updateCurrentScrollSegment = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const segmentHeight = Math.max(stage.clientHeight * 0.82, 1);
    const nextSegment = Math.floor(stage.scrollTop / segmentHeight);
    setCurrentScrollSegment((current) => current === nextSegment ? current : nextSegment);
  }, []);

  const updateNarrativeDebugVisibility = useCallback(() => {
    const stage = stageRef.current;
    const panel = narrativeDebugRef.current;
    if (!stage || !panel) {
      setIsNarrativeDebugVisible(false);
      return;
    }

    const stageRect = stage.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const isVisible =
      panelRect.top <= stageRect.bottom - Math.min(stageRect.height * 0.16, 96) &&
      panelRect.bottom >= stageRect.top + 24;

    setIsNarrativeDebugVisible((current) => (current === isVisible ? current : isVisible));
  }, []);

  const handleScroll = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      updateNarrativeDebugVisibility();
      saveCurrentProgress();
      updateCurrentScrollSegment();
      updateAiMarkerPosition();
      frameRef.current = null;
    });
  }, [
    saveCurrentProgress,
    updateAiMarkerPosition,
    updateCurrentScrollSegment,
    updateNarrativeDebugVisibility,
  ]);

  const scrollByViewport = useCallback((direction: 1 | -1) => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.scrollBy({
      top: direction * stage.clientHeight * 0.82,
      behavior: "smooth",
    });
  }, []);

  const scrollVertically = useCallback((direction: 1 | -1) => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.scrollBy({
      top: direction * Math.min(160, stage.clientHeight * 0.28),
      behavior: "smooth",
    });
  }, []);

  useEffect(() => {
    restoringRef.current = true;
    const animationFrame = window.requestAnimationFrame(() => {
      const currentProgress = progressRef.current;
      const stage = stageRef.current;
      if (!stage) {
        restoringRef.current = false;
        return;
      }
      const maxScroll = stage.scrollHeight - stage.clientHeight;
      stage.scrollTop = maxScroll > 0 ? maxScroll * currentProgress : 0;
      updateCurrentScrollSegment();
      restoringRef.current = false;
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [book.id, updateCurrentScrollSegment]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const isEditing =
        target instanceof HTMLElement &&
        (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if (isEditing) return;

      if (event.key === "Escape") onBack();
      if (event.key === "PageDown" || event.key === "ArrowRight") {
        event.preventDefault();
        scrollByViewport(1);
      }
      if (event.key === "PageUp" || event.key === "ArrowLeft") {
        event.preventDefault();
        scrollByViewport(-1);
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        scrollVertically(1);
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        scrollVertically(-1);
      }
      if (event.key === "Home") {
        if (stageRef.current) {
          stageRef.current.scrollTo({ top: 0, behavior: "smooth" });
        }
      }
      if (event.key === "End") {
        if (stageRef.current) {
          stageRef.current.scrollTo({ top: stageRef.current.scrollHeight, behavior: "smooth" });
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onBack, scrollByViewport, scrollVertically]);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(updateNarrativeDebugVisibility);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [
    currentScrollSegment,
    isExtractingNarrative,
    narrativeError,
    narrativeResult,
    narrativeScope,
    updateNarrativeDebugVisibility,
  ]);

  const setFontScale = (delta: number) => {
    onSettingsChange({
      ...settings,
      fontScale: clamp(Number((settings.fontScale + delta).toFixed(2)), 0.88, 1.28),
    });
  };

  const setLineHeight = (lineHeight: number) => {
    onSettingsChange({ ...settings, lineHeight });
  };

  const setTheme = (theme: ReaderTheme) => {
    onSettingsChange({ ...settings, theme });
  };

  const selectAiMode = (mode: AiMode) => {
    if (mode !== aiMode) {
      onModeSelection(mode, readingProgress);
    }
    setAiMode(mode);
    const isManualMode = mode === "low" || mode === "medium";
    setAreManualVisualizationsRevealed(!isManualMode);
    setIsManualRefreshRequested(false);
    previousMediumMarkerProgressRef.current = null;
    if (mode !== "medium") setMediumMarkerEndIndex(0);
    if (mode === "zero" || isManualMode) {
      setIsNarrativeMapFullscreen(false);
      setIsCharacterGraphFullscreen(false);
    }
  };

  return (
    <section
      className={`reader-screen theme-${settings.theme}`}
      aria-label={`${book.title} 阅读器`}
    >
      <header className="reader-topbar">
        <div className="reader-left-tools">
          <div className="reader-primary-nav">
            <button
              className="icon-button reader-nav-button reader-nav-home"
              type="button"
              onClick={onBack}
              aria-label="返回书库"
              title="返回书库"
            >
              <ArrowLeft size={21} strokeWidth={2.2} />
            </button>
          </div>
          <div className="reader-ai-panel">
              <button
                className={`reader-mode-button${aiMode === "zero" ? " active" : ""}`}
                type="button"
                onClick={() => {
                  selectAiMode("zero");
                }}
                aria-label="Zero AI mode"
                title="Zero"
              >
                <CircleOff size={16} strokeWidth={2.2} />
                <span>zero</span>
              </button>
              <button
                className={`reader-mode-button${aiMode === "low" ? " active" : ""}`}
                type="button"
                onClick={() => {
                  selectAiMode("low");
                }}
                aria-label="Low AI mode"
                title="Low"
              >
                <Sparkles size={16} strokeWidth={2.2} />
                <span>low</span>
              </button>
              <button
                className={`reader-mode-button${aiMode === "medium" ? " active" : ""}`}
                type="button"
                onClick={() => {
                  selectAiMode("medium");
                }}
                aria-label="Medium AI mode"
                title="Medium"
              >
                <WandSparkles size={16} strokeWidth={2.2} />
                <span>medium</span>
              </button>
              <button
                className={`reader-mode-button${aiMode === "high" ? " active" : ""}`}
                type="button"
                onClick={() => {
                  selectAiMode("high");
                }}
                aria-label="High AI mode"
                title="High"
              >
                <BrainCircuit size={16} strokeWidth={2.2} />
                <span>high</span>
              </button>
          </div>
          {!isZeroMode && (
            <>
              <div className="reader-ai-action">
                <button
                  ref={aiMarkerRef}
                  className="icon-button reader-nav-button reader-nav-json"
                  type="button"
                  onClick={(event) => {
                    setSettingsOpen(false);
                    if (isManualNarrativeMode || aiMode === "high") {
                      handleAiExtractAtMarker(event.currentTarget);
                      return;
                    }
                    setAreManualVisualizationsRevealed(true);
                    if (!isProgressiveDemo) {
                      void handleExtractNarrativeJson();
                    }
                  }}
                  disabled={isExtractingNarrative}
                  aria-label={
                    aiMode === "high"
                      ? "立即同步到箭头所指位置"
                      : isProgressiveDemo && isManualNarrativeMode
                      ? "更新当前阅读进度的故事线"
                      : isProgressiveDemo
                        ? "故事线会随阅读自动更新"
                        : "抽取叙事 JSON"
                  }
                  title={
                    aiMode === "high"
                      ? "立即同步到箭头处"
                      : isProgressiveDemo && isManualNarrativeMode
                        ? "更新故事线"
                        : isProgressiveDemo
                          ? "故事线随阅读自动更新"
                          : "Extract Narrative JSON"
                  }
                >
                  <BrainCircuit size={20} strokeWidth={2.2} />
                </button>
                {(isManualNarrativeMode || aiMode === "high") && (
                  <span className="reader-ai-cursor" aria-hidden="true">
                    <ArrowRight size={19} strokeWidth={2.1} />
                  </span>
                )}
              </div>
              {(isProgressiveDemo || aiMode === "high") && (
                <p className="reader-live-narrative-status" aria-live="polite">
                  {isNarrativeSyncing || isExtractingNarrative
                    ? aiMode === "high"
                      ? "整理箭头处的内容…"
                      : "整理刚读到的内容…"
                    : isManualNarrativeMode
                      ? aiMode === "medium"
                        ? `点击 AI 更新至箭头处 · 越过关键节点自动显示`
                        : `点击 AI 更新至 ${formatPercent(readingProgress)}`
                      : aiMode === "high"
                        ? `AI 跟随箭头至 ${formatPercent(
                            readingScopeIndex.fullText.length
                              ? highMarkerEndIndex / readingScopeIndex.fullText.length
                              : readingProgress,
                          )}`
                        : `故事线已同步至 ${formatPercent(readingProgress)}`}
                </p>
              )}
              {!isNarrativeDebugVisible && (
                <SidebarEventTimeline
                  characters={narrativeResult?.characters ?? []}
                  events={narrativeResult?.events ?? []}
                  onExpand={() => {
                    onVisualizationDetailOpen("event_map", aiMode, readingProgress);
                    setIsCharacterGraphFullscreen(false);
                    setIsNarrativeMapFullscreen(true);
                  }}
                  showDemoWhenEmpty={false}
                  obscured={areVisualizationsObscured}
                />
              )}
            </>
          )}
        </div>

        <div className="reader-title">
          <div className="reader-brand" aria-hidden="true">
            <span>Lumen · </span>
            <span className="reader-brand-cn">微光</span>
          </div>
          <strong>{book.title}</strong>
        </div>

        <div className="reader-tools">
          <button
            className={`icon-button${settingsOpen ? " active" : ""}`}
            type="button"
            onClick={() => {
              setSettingsOpen((open) => !open);
            }}
            aria-label="打开排版设置"
            title="排版设置"
          >
            <Type size={21} strokeWidth={2.2} />
          </button>
          {settingsOpen && (
            <div className="settings-popover">
              <div className="setting-row">
                <span>{isPdf ? "缩放" : "字号"}</span>
                <div className="stepper">
                  <button type="button" onClick={() => setFontScale(-0.04)} aria-label={isPdf ? "缩小页面" : "减小字号"}>
                    <Minus size={15} strokeWidth={2.4} />
                  </button>
                  <strong>{Math.round(settings.fontScale * 100)}%</strong>
                  <button type="button" onClick={() => setFontScale(0.04)} aria-label={isPdf ? "放大页面" : "增大字号"}>
                    <Plus size={15} strokeWidth={2.4} />
                  </button>
                </div>
              </div>
              {!isPdf && (
                <div className="setting-row">
                  <span>行距</span>
                  <div className="segmented">
                    {[1.56, 1.72, 1.88].map((value) => (
                      <button
                        className={settings.lineHeight === value ? "selected" : ""}
                        key={value}
                        type="button"
                        onClick={() => setLineHeight(value)}
                      >
                        {value === 1.56 ? "紧" : value === 1.72 ? "中" : "松"}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="setting-row">
                <span>主题</span>
                <div className="theme-options">
                  <button
                    className={settings.theme === "paper" ? "selected" : ""}
                    type="button"
                    onClick={() => setTheme("paper")}
                    aria-label="纸张主题"
                  >
                    <Sun size={16} strokeWidth={2.2} />
                    <span>纸张</span>
                  </button>
                  <button
                    className={settings.theme === "plain" ? "selected" : ""}
                    type="button"
                    onClick={() => setTheme("plain")}
                    aria-label="明亮主题"
                  >
                    <Sun size={16} strokeWidth={2.2} />
                    <span>明亮</span>
                  </button>
                  <button
                    className={settings.theme === "night" ? "selected" : ""}
                    type="button"
                    onClick={() => setTheme("night")}
                    aria-label="夜间主题"
                  >
                    <Moon size={16} strokeWidth={2.2} />
                    <span>夜间</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {!isZeroMode && !isNarrativeDebugVisible && (
        <SidebarCharacterRelations
          result={narrativeResult}
          obscured={areVisualizationsObscured}
          onExpand={() => {
            onVisualizationDetailOpen("character_graph", aiMode, readingProgress);
            setIsNarrativeMapFullscreen(false);
            setIsCharacterGraphFullscreen(true);
          }}
        />
      )}

      {!isZeroMode && isNarrativeMapFullscreen && (
        <section className="reader-narrative-fullscreen" aria-label="完整叙事可视化">
          <SidebarEventTimeline
            characters={narrativeResult?.characters ?? []}
            events={narrativeResult?.events ?? []}
            onClose={() => setIsNarrativeMapFullscreen(false)}
            showDemoWhenEmpty={false}
            variant="fullscreen"
          />
        </section>
      )}

      {!isZeroMode && isCharacterGraphFullscreen && (
        <section className="reader-narrative-fullscreen reader-character-graph-fullscreen" aria-label="完整人物关系图">
          <CharacterGraph result={narrativeResult} onClose={() => setIsCharacterGraphFullscreen(false)} />
        </section>
      )}

      <div className="reader-progress-track" aria-hidden="true">
        <span style={{ width: formatPercent(progress) }} />
      </div>

      <div className="reader-stage" ref={stageRef} onScroll={handleScroll}>
        <div className="reader-corner-illustration" aria-hidden="true">
          <img src={readerNotebook} alt="" />
        </div>
        {isPdf ? (
          <PdfDocumentView book={book} zoom={settings.fontScale} />
        ) : (
          <TextDocumentView
            book={book}
            documentStyle={documentStyle}
          />
        )}
        {!isZeroMode && !isProgressiveDemo && (narrativeScope || narrativeResult || narrativeError || isExtractingNarrative) && (
          <div className="narrative-debug-anchor" ref={narrativeDebugRef}>
            <NarrativeDebugPanel
              error={narrativeError}
              isLoading={isExtractingNarrative}
              result={narrativeResult}
              scope={narrativeScope}
            />
          </div>
        )}
        <section className="experiment-finish-panel" aria-labelledby="experiment-finish-title">
          <p>已到达阅读末尾</p>
          <h2 id="experiment-finish-title">结束本次阅读</h2>
          <span>点击后将保存阅读时长和辅助调用记录，并生成可下载的 JSON。</span>
          <button type="button" onClick={finishReading}>结束阅读并保存记录</button>
        </section>
      </div>

    </section>
  );
}

type TextDocumentViewProps = {
  book: Book;
  documentStyle: CSSProperties;
};

function TextDocumentView({ book, documentStyle }: TextDocumentViewProps) {
  return (
    <article className="reader-document" style={documentStyle}>
      <header className="document-header">
        <p>{formatLabel(book.format)}</p>
        <h1>{book.title}</h1>
      </header>

      {book.sections.map((section, sectionIndex) => (
        <section className="reader-section" data-section-id={section.id} key={section.id}>
          {(section.label || section.heading) && (
            <header className="section-header" data-toc-anchor-for={section.id}>
              {section.label && <span>{section.label}</span>}
              {section.heading && <h2>{section.heading}</h2>}
            </header>
          )}
          <div className="reader-copy">
            {section.paragraphs.map((paragraph, paragraphIndex) => (
              <p
                data-section-id={section.id}
                data-paragraph-index={paragraphIndex}
                key={`${section.id}-${paragraphIndex}`}
              >
                {paragraph}
              </p>
            ))}
          </div>
          {sectionIndex < book.sections.length - 1 && <div className="section-divider" aria-hidden="true" />}
        </section>
      ))}
    </article>
  );
}

type PdfDocumentViewProps = {
  book: Book;
  zoom: number;
};

function PdfDocumentView({ book, zoom }: PdfDocumentViewProps) {
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [loadError, setLoadError] = useState("");
  const pageCount = book.pdf?.pageCount ?? 0;

  useEffect(() => {
    if (!book.pdf) return;

    let cancelled = false;
    let loadedDocument: PDFDocumentProxy | null = null;
    setPdfDocument(null);
    setLoadError("");

    const loadingTask = loadPdfDocument(book.pdf.data);
    loadingTask.promise
      .then((document) => {
        loadedDocument = document;
        if (cancelled) {
          void document.cleanup();
          return;
        }
        setPdfDocument(document);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : "PDF 加载失败");
      });

    return () => {
      cancelled = true;
      void loadedDocument?.cleanup();
      void loadingTask.destroy();
    };
  }, [book.id, book.pdf]);

  if (!book.pdf) {
    return (
      <div className="pdf-state">
        <strong>没有可渲染的 PDF 数据</strong>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="pdf-state">
        <strong>PDF 加载失败</strong>
        <span>{loadError}</span>
      </div>
    );
  }

  if (!pdfDocument) {
    return (
      <div className="pdf-state">
        <strong>正在加载 PDF...</strong>
      </div>
    );
  }

  return (
    <article className="pdf-document" aria-label={`${book.title} PDF 页面`}>
      {Array.from({ length: pageCount }, (_, index) => (
        <PdfPageCanvas
          key={`${book.id}-${index + 1}-${zoom}`}
          pageNumber={index + 1}
          pdfDocument={pdfDocument}
          zoom={zoom}
        />
      ))}
    </article>
  );
}

type PdfPageCanvasProps = {
  pdfDocument: PDFDocumentProxy;
  pageNumber: number;
  zoom: number;
};

function PdfPageCanvas({ pdfDocument, pageNumber, zoom }: PdfPageCanvasProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isVisible, setIsVisible] = useState(pageNumber <= 2);
  const [status, setStatus] = useState<"idle" | "loading" | "rendered" | "error">("idle");

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || isVisible) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { root: null, rootMargin: "900px 0px" },
    );
    observer.observe(wrapper);

    return () => observer.disconnect();
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;

    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<void> } | null = null;
    const canvas = canvasRef.current;
    if (!canvas) return;

    setStatus("loading");

    pdfDocument
      .getPage(pageNumber)
      .then((page) => {
        if (cancelled) return;

        const viewport = page.getViewport({ scale: 1.22 * zoom });
        const outputScale = Math.min(window.devicePixelRatio || 1, 2);
        const context = canvas.getContext("2d");
        if (!context) {
          throw new Error("无法创建 PDF canvas");
        }

        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        context.setTransform(outputScale, 0, 0, outputScale, 0, 0);
        renderTask = page.render({
          canvas,
          canvasContext: context,
          viewport,
        });
        return renderTask.promise;
      })
      .then(() => {
        if (!cancelled) setStatus("rendered");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof Error && error.name === "RenderingCancelledException") return;
        setStatus("error");
      });

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [isVisible, pageNumber, pdfDocument, zoom]);

  return (
    <section
      className="pdf-page"
      data-page-number={pageNumber}
      ref={wrapperRef}
      aria-label={`第 ${pageNumber} 页`}
    >
      <canvas ref={canvasRef} />
      {status !== "rendered" && (
        <div className="pdf-page-status">
          {status === "error" ? "页面渲染失败" : `第 ${pageNumber} 页`}
        </div>
      )}
      <span className="pdf-page-number">{pageNumber}</span>
    </section>
  );
}

export default App;
