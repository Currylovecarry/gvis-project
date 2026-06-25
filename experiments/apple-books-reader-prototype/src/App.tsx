import {
  ArrowLeft,
  BookOpen,
  FileText,
  Library,
  Minus,
  Moon,
  Plus,
  Search,
  Sun,
  Trash2,
  Type,
  Upload,
} from "lucide-react";
import {
  CSSProperties,
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Book, BookFormat, books, getBookTextStats } from "./data/books";
import { parseEpubFile, parseTextFile } from "./utils/epub";

type View = "library" | "reader";
type ReaderTheme = "paper" | "plain" | "night";

type ReaderSettings = {
  fontScale: number;
  lineHeight: number;
  theme: ReaderTheme;
};

const progressKey = "gvis-reader-progress";
const settingsKey = "gvis-reader-settings";

const defaultSettings: ReaderSettings = {
  fontScale: 1,
  lineHeight: 1.72,
  theme: "paper",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatPercent(value: number) {
  return `${Math.round(clamp(value, 0, 1) * 100)}%`;
}

function getSavedProgress(bookId: string) {
  const raw = window.localStorage.getItem(`${progressKey}:${bookId}`);
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

function App() {
  const [view, setView] = useState<View>("library");
  const [query, setQuery] = useState("");
  const [libraryBooks, setLibraryBooks] = useState<Book[]>(books);
  const [activeBook, setActiveBook] = useState<Book>(books[0]);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [settings, setSettings] = useState<ReaderSettings>(readSettings);
  const [progressByBook, setProgressByBook] = useState<Record<string, number>>(() =>
    Object.fromEntries(books.map((book) => [book.id, getSavedProgress(book.id)])),
  );

  const filteredBooks = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return libraryBooks;
    return libraryBooks.filter((book) =>
      `${book.title} ${book.author} ${formatLabel(book.format)}`.toLowerCase().includes(normalized),
    );
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
    window.localStorage.setItem(`${progressKey}:${bookId}`, String(nextProgress));
  }, []);

  const openBook = (book: Book) => {
    setActiveBook(book);
    setProgressByBook((current) => ({
      ...current,
      [book.id]: current[book.id] ?? getSavedProgress(book.id),
    }));
    setView("reader");
  };

  const closeReader = () => {
    setView("library");
  };

  const createPlaceholderBook = (file: File): Book => {
    const lowerName = file.name.toLowerCase();
    const title = file.name.replace(/\.[^/.]+$/, "") || "未命名文件";

    return {
      id: `${Date.now()}-${file.name}`,
      title,
      author: file.type || "本地文件",
      format: lowerName.endsWith(".pdf") ? "pdf" : "sample",
      sections: [
        {
          id: "placeholder",
          label: "1",
          heading: title,
          paragraphs: [
            "这本文件已经添加到书库。",
            "当前基础阅读器已经支持 EPUB 和 TXT 正文解析。PDF 文件会先作为占位书籍加入，之后可以接入 PDF.js 做真实渲染。",
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
          : createPlaceholderBook(file);

      setLibraryBooks((currentBooks) => [importedBook, ...currentBooks]);
      setActiveBook(importedBook);
      updateBookProgress(importedBook.id, 0);
      setView("reader");
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "导入失败");
    } finally {
      setIsImporting(false);
    }
  };

  const deleteBook = (book: Book) => {
    const isBundledSample = books.some((sampleBook) => sampleBook.id === book.id);
    if (isBundledSample) return;

    const confirmed = window.confirm(`确定要从书库删除《${book.title}》吗？`);
    if (!confirmed) return;

    const fallbackBook = libraryBooks.find((currentBook) => currentBook.id !== book.id);
    setLibraryBooks((currentBooks) =>
      currentBooks.filter((currentBook) => currentBook.id !== book.id),
    );
    if (activeBook.id === book.id && fallbackBook) {
      setActiveBook(fallbackBook);
    }
    setProgressByBook((current) => {
      const { [book.id]: _deletedProgress, ...rest } = current;
      return rest;
    });
    window.localStorage.removeItem(`${progressKey}:${book.id}`);
  };

  return (
    <main className="app-shell">
      {view === "library" ? (
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
          onProgressChange={updateBookProgress}
          onSettingsChange={updateSettings}
        />
      )}
    </main>
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

  const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    void onImportBook(file);
    event.target.value = "";
  };

  return (
    <div className="library-layout">
      <aside className="library-sidebar" aria-label="书库导航">
        <div className="brand-block">
          <div className="brand-mark">G</div>
          <div>
            <strong>GVIS Reader</strong>
            <span>基础阅读器</span>
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
          <button className="nav-item active" type="button">
            <Library size={19} strokeWidth={2.1} />
            <span>全部图书</span>
          </button>
          <button className="nav-item" type="button">
            <BookOpen size={19} strokeWidth={2.1} />
            <span>继续阅读</span>
          </button>
        </nav>
      </aside>

      <section className="library-main" aria-label="书库">
        <header className="library-header">
          <div>
            <p>Library</p>
            <h1>书库</h1>
          </div>
          <div className="library-actions">
            <input
              id={fileInputId}
              className="file-input"
              type="file"
              accept=".epub,.txt,.pdf,application/epub+zip,application/pdf,text/plain"
              disabled={isImporting}
              onChange={handleImport}
            />
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

        {libraryBooks.length ? (
          <div className="book-grid">
            {libraryBooks.map((book) => (
              <BookTile
                book={book}
                key={book.id}
                progress={progressByBook[book.id] ?? 0}
                canDelete={!books.some((sampleBook) => sampleBook.id === book.id)}
                onOpenBook={onOpenBook}
                onDeleteBook={onDeleteBook}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <FileText size={34} strokeWidth={1.8} />
            <strong>没有找到匹配的图书</strong>
          </div>
        )}

        <footer className="library-footer">
          <span>{isImporting ? "正在解析文件..." : `${libraryBooks.length} 本书`}</span>
          {importError && <strong>{importError}</strong>}
        </footer>
      </section>
    </div>
  );
}

type BookTileProps = {
  book: Book;
  progress: number;
  canDelete: boolean;
  onOpenBook: (book: Book) => void;
  onDeleteBook: (book: Book) => void;
};

function BookTile({ book, progress, canDelete, onOpenBook, onDeleteBook }: BookTileProps) {
  const stats = getBookTextStats(book);

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
          <div>
            <strong>{book.title}</strong>
            <span>{book.author}</span>
          </div>
          <div className="book-stats">
            <span>{formatLabel(book.format)}</span>
            <span>{stats.sections} 节</span>
            <span>{stats.paragraphs} 段</span>
          </div>
          <div className="book-progress" aria-label={`阅读进度 ${formatPercent(progress)}`}>
            <span style={{ width: formatPercent(progress) }} />
          </div>
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
  return (
    <div className={`book-cover cover-${book.format}`} aria-hidden="true">
      <span className="cover-format">{formatLabel(book.format)}</span>
      <strong>{book.title}</strong>
      <span>{book.author}</span>
    </div>
  );
}

type ReaderViewProps = {
  book: Book;
  progress: number;
  settings: ReaderSettings;
  onBack: () => void;
  onProgressChange: (bookId: string, progress: number) => void;
  onSettingsChange: (settings: ReaderSettings) => void;
};

function ReaderView({
  book,
  progress,
  settings,
  onBack,
  onProgressChange,
  onSettingsChange,
}: ReaderViewProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const restoringRef = useRef(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const stats = useMemo(() => getBookTextStats(book), [book]);
  const documentStyle = {
    "--reader-font-scale": settings.fontScale,
    "--reader-line-height": settings.lineHeight,
  } as CSSProperties;

  const saveCurrentProgress = useCallback(() => {
    const stage = stageRef.current;
    if (!stage || restoringRef.current) return;

    const maxScroll = stage.scrollHeight - stage.clientHeight;
    const nextProgress = maxScroll <= 0 ? 0 : stage.scrollTop / maxScroll;
    onProgressChange(book.id, nextProgress);
  }, [book.id, onProgressChange]);

  const handleScroll = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      saveCurrentProgress();
      frameRef.current = null;
    });
  }, [saveCurrentProgress]);

  const scrollByPage = useCallback((direction: 1 | -1) => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.scrollBy({
      top: direction * stage.clientHeight * 0.82,
      behavior: "smooth",
    });
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    restoringRef.current = true;
    const animationFrame = window.requestAnimationFrame(() => {
      const maxScroll = stage.scrollHeight - stage.clientHeight;
      stage.scrollTop = maxScroll > 0 ? maxScroll * progress : 0;
      restoringRef.current = false;
      saveCurrentProgress();
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [book.id]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onBack();
      if (event.key === "PageDown" || event.key === "ArrowDown") scrollByPage(1);
      if (event.key === "PageUp" || event.key === "ArrowUp") scrollByPage(-1);
      if (event.key === "Home" && stageRef.current) {
        stageRef.current.scrollTo({ top: 0, behavior: "smooth" });
      }
      if (event.key === "End" && stageRef.current) {
        stageRef.current.scrollTo({ top: stageRef.current.scrollHeight, behavior: "smooth" });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onBack, scrollByPage]);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

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

  return (
    <section className={`reader-screen theme-${settings.theme}`} aria-label={`${book.title} 阅读器`}>
      <header className="reader-topbar">
        <button className="icon-button" type="button" onClick={onBack} aria-label="返回书库" title="返回书库">
          <ArrowLeft size={21} strokeWidth={2.2} />
        </button>

        <div className="reader-title">
          <strong>{book.title}</strong>
          <span>{book.author}</span>
        </div>

        <div className="reader-tools">
          <button
            className={`icon-button${settingsOpen ? " active" : ""}`}
            type="button"
            onClick={() => setSettingsOpen((open) => !open)}
            aria-label="打开排版设置"
            title="排版设置"
          >
            <Type size={21} strokeWidth={2.2} />
          </button>
          {settingsOpen && (
            <div className="settings-popover">
              <div className="setting-row">
                <span>字号</span>
                <div className="stepper">
                  <button type="button" onClick={() => setFontScale(-0.04)} aria-label="减小字号">
                    <Minus size={15} strokeWidth={2.4} />
                  </button>
                  <strong>{Math.round(settings.fontScale * 100)}%</strong>
                  <button type="button" onClick={() => setFontScale(0.04)} aria-label="增大字号">
                    <Plus size={15} strokeWidth={2.4} />
                  </button>
                </div>
              </div>
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

      <div className="reader-progress-track" aria-hidden="true">
        <span style={{ width: formatPercent(progress) }} />
      </div>

      <div className="reader-stage" ref={stageRef} onScroll={handleScroll}>
        <article className="reader-document" style={documentStyle}>
          <header className="document-header">
            <p>{formatLabel(book.format)}</p>
            <h1>{book.title}</h1>
            <span>{book.author}</span>
          </header>

          {book.sections.map((section, sectionIndex) => (
            <section className="reader-section" key={section.id}>
              {(section.label || section.heading) && (
                <header className="section-header">
                  {section.label && <span>{section.label}</span>}
                  {section.heading && <h2>{section.heading}</h2>}
                </header>
              )}
              <div className="reader-copy">
                {section.paragraphs.map((paragraph, paragraphIndex) => (
                  <p key={`${section.id}-${paragraphIndex}`}>{paragraph}</p>
                ))}
              </div>
              {sectionIndex < book.sections.length - 1 && <div className="section-divider" aria-hidden="true" />}
            </section>
          ))}
        </article>
      </div>

      <footer className="reader-footer">
        <span>{formatPercent(progress)}</span>
        <span>{stats.sections} 节</span>
        <span>{stats.paragraphs} 段</span>
      </footer>
    </section>
  );
}

export default App;
