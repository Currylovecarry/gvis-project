import {
  ArrowLeft,
  BookOpen,
  FileText,
  Library,
  List,
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
import booksCoffeeHanddrawn from "./assets/books_coffee_handdrawn.svg";
import readerNotebook from "./assets/reader_notebook.svg";
import logo1 from "./assets/logos/72084966-334c-451a-81b9-b37c9220db74-1782974934891_IMG_1347.svg";
import logo3 from "./assets/logos/31b1e46e-0fe1-4702-936a-bdd805edd20f-1782974934894_IMG_1349.svg";
import logo4 from "./assets/logos/bc34797c-7ded-48bc-87cc-cfcbfe5e204f-1782974934894_IMG_1348.svg";
import logo5 from "./assets/logos/21ce9ae5-90df-4728-9433-34dee7d13417-1782975463348_Oe_2026-07-02_14.55.33.svg";
import { Book, BookFormat, books, getBookTextStats } from "./data/books";
import { parseEpubFile, parseTextFile } from "./utils/epub";
import { loadPdfDocument, parsePdfFile, type PDFDocumentProxy } from "./utils/pdf";

type View = "library" | "reader";
type ReaderTheme = "paper" | "plain" | "night";
type ReaderMode = "scroll" | "paged";

type ReaderSettings = {
  fontScale: number;
  lineHeight: number;
  theme: ReaderTheme;
};

type PagedSection = {
  sectionId: string;
  label?: string;
  heading?: string;
  paragraphs: string[];
};

type PagedDocumentPage = {
  id: string;
  items: PagedSection[];
};

type TocItem = {
  id: string;
  label: string;
  meta: string;
  pageNumber?: number;
  pageIndex?: number;
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

function paginateSections(
  sections: Book["sections"],
  settings: ReaderSettings,
): {
  pages: PagedDocumentPage[];
  firstPageIndexBySection: Record<string, number>;
} {
  const density = settings.fontScale * (settings.lineHeight / defaultSettings.lineHeight);
  const targetCharsPerPage = Math.max(420, Math.round(920 / density));
  const pages: PagedDocumentPage[] = [];
  const firstPageIndexBySection: Record<string, number> = {};

  let currentPage: PagedDocumentPage = { id: "page-1", items: [] };
  let currentChars = 0;

  const pushPage = () => {
    if (!currentPage.items.length) return;
    pages.push(currentPage);
    currentPage = { id: `page-${pages.length + 1}`, items: [] };
    currentChars = 0;
  };

  sections.forEach((section, sectionIndex) => {
    let currentItem: PagedSection | null = null;
    let itemChars = 0;
    const headingCost = (section.heading?.length ?? 0) + (section.label?.length ?? 0) + 80;

    if (currentPage.items.length > 0) {
      pushPage();
    }

    const pushItem = () => {
      if (!currentItem || !currentItem.paragraphs.length) return;
      currentPage.items.push(currentItem);
      currentChars += itemChars;
      if (firstPageIndexBySection[section.id] === undefined) {
        firstPageIndexBySection[section.id] = pages.length;
      }
      currentItem = null;
      itemChars = 0;
    };

    section.paragraphs.forEach((paragraph, paragraphIndex) => {
      const paragraphCost = Math.max(80, paragraph.length + 32);
      const needsNewPage =
        currentChars + itemChars + paragraphCost + (currentItem ? 0 : headingCost) >
          targetCharsPerPage &&
        (currentChars > 0 || itemChars > 0);

      if (needsNewPage) {
        pushItem();
        pushPage();
      }

      if (!currentItem) {
        currentItem = {
          sectionId: section.id,
          label: paragraphIndex === 0 ? section.label : undefined,
          heading: paragraphIndex === 0 ? section.heading : undefined,
          paragraphs: [],
        };
        itemChars += headingCost;
      }

      currentItem.paragraphs.push(paragraph);
      itemChars += paragraphCost;

      const isLastParagraph = paragraphIndex === section.paragraphs.length - 1;
      if (isLastParagraph) {
        pushItem();
        const isLastSection = sectionIndex === sections.length - 1;
        if (!isLastSection && currentChars >= targetCharsPerPage * 0.72) {
          pushPage();
        }
      }
    });
  });

  pushPage();

  return {
    pages: pages.length ? pages : [{ id: "page-1", items: [] }],
    firstPageIndexBySection,
  };
}

const coverImages = [logo1, logo3, logo4, logo5];

const preloadedBooks = [
  { path: "/books/the-deal.epub", id: "the-deal" },
  { path: "/books/o-henry.epub", id: "o-henry" },
];

function App() {
  const [view, setView] = useState<View>("library");
  const [query, setQuery] = useState("");
  const [libraryBooks, setLibraryBooks] = useState<Book[]>(books);
  const [activeBook, setActiveBook] = useState<Book>(books[0]);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [settings, setSettings] = useState<ReaderSettings>(readSettings);
  const nextCoverRef = useRef(1);
  const [progressByBook, setProgressByBook] = useState<Record<string, number>>(() =>
    Object.fromEntries(books.map((book) => [book.id, getSavedProgress(book.id)])),
  );

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
      <header className="mobile-header">
        <strong className="brand-title">
          <img className="brand-emblem" src="/site-icon.png" alt="" aria-hidden="true" />
          <span>Lumen · </span>
          <span className="brand-title-cn">微光</span>
        </strong>
        <label className="import-button" htmlFor={fileInputId} aria-label="导入图书">
          <Upload size={18} strokeWidth={2.2} />
        </label>
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
              <span>Lumen · </span>
              <span className="brand-title-cn">微光</span>
            </strong>
            <span>A little light, just when you need it.</span>
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

        <div className="sidebar-reading-illustration" aria-hidden="true">
          <img src={booksCoffeeHanddrawn} alt="" />
        </div>
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
  const tertiaryStat = book.format === "pdf" ? `${stats.pages} 页` : `${stats.paragraphs} 段`;

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
            {book.format !== "pdf" && <span>{stats.sections} 节</span>}
            <span>{tertiaryStat}</span>
          </div>
          <div className="book-progress-block">
            <div className="book-progress-meta" aria-hidden="true">
              <span>阅读进度</span>
              <span>{formatPercent(progress)}</span>
            </div>
            <div className="book-progress" aria-label={`阅读进度 ${formatPercent(progress)}`}>
              <span style={{ width: formatPercent(progress) }} />
            </div>
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
  const coverImage = book.coverIndex !== undefined ? coverImages[book.coverIndex % coverImages.length] : null;

  return (
    <div className={`book-cover cover-${book.format}`} aria-hidden="true">
      {coverImage && <img src={coverImage} alt="" className="book-cover-image" />}
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
  const tocItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const progressRef = useRef(progress);
  const restoringRef = useRef(true);
  const [tocOpen, setTocOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pagesOpen, setPagesOpen] = useState(false);
  const [readerMode, setReaderMode] = useState<ReaderMode>("paged");
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [activeTocItemId, setActiveTocItemId] = useState("");
  const stats = useMemo(() => getBookTextStats(book), [book]);
  const isPdf = book.format === "pdf" && book.pdf;
  const isPagedTextMode = readerMode === "paged" && !isPdf;
  const documentStyle = {
    "--reader-font-scale": settings.fontScale,
    "--reader-line-height": settings.lineHeight,
  } as CSSProperties;
  const { pages: pagedPages, firstPageIndexBySection } = useMemo(
    () => paginateSections(book.sections, settings),
    [book.sections, settings],
  );
  const tocItems = useMemo<TocItem[]>(() => {
    if (isPdf) {
      return Array.from({ length: book.pdf?.pageCount ?? 0 }, (_, index) => ({
        id: `page-${index + 1}`,
        label: `第 ${index + 1} 页`,
        meta: String(index + 1),
        pageNumber: index + 1,
      }));
    }

    return book.sections.map((section, index) => ({
      id: section.id,
      label: section.heading || `第 ${index + 1} 节`,
      meta: section.label || String(index + 1),
      pageIndex: firstPageIndexBySection[section.id],
    }));
  }, [book.pdf?.pageCount, book.sections, firstPageIndexBySection, isPdf]);
  const activeTocItem = tocItems.find((item) => item.id === activeTocItemId) ?? null;

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  const syncActiveTocItem = useCallback(() => {
    const stage = stageRef.current;
    if (!stage || isPagedTextMode) return;

    const nodes = Array.from(
      stage.querySelectorAll<HTMLElement>(isPdf ? "[data-page-number]" : "[data-section-id]"),
    );
    if (nodes.length === 0) return;

    const anchorY = stage.getBoundingClientRect().top + Math.min(stage.clientHeight * 0.28, 180);
    let nextActiveId =
      (isPdf ? nodes[0]?.dataset.pageNumber && `page-${nodes[0].dataset.pageNumber}` : nodes[0]?.dataset.sectionId) ??
      "";

    for (const node of nodes) {
      const rect = node.getBoundingClientRect();
      const candidateId =
        isPdf ? node.dataset.pageNumber && `page-${node.dataset.pageNumber}` : node.dataset.sectionId;
      if (!candidateId) continue;
      if (rect.top <= anchorY) {
        nextActiveId = candidateId;
        continue;
      }
      break;
    }

    if (nextActiveId) {
      setActiveTocItemId((current) => (current === nextActiveId ? current : nextActiveId));
    }
  }, [isPagedTextMode, isPdf]);

  const saveCurrentProgress = useCallback(() => {
    const stage = stageRef.current;
    if (restoringRef.current) return;

    const nextProgress = isPagedTextMode
      ? pagedPages.length <= 1
        ? 0
        : currentPageIndex / (pagedPages.length - 1)
      : !stage
        ? 0
        : (() => {
            const maxScroll = stage.scrollHeight - stage.clientHeight;
            return maxScroll <= 0 ? 0 : stage.scrollTop / maxScroll;
          })();
    onProgressChange(book.id, nextProgress);
  }, [book.id, currentPageIndex, isPagedTextMode, onProgressChange, pagedPages.length]);

  const handleScroll = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      const stage = stageRef.current;
      if (stage) {
        syncActiveTocItem();
      }
      saveCurrentProgress();
      frameRef.current = null;
    });
  }, [saveCurrentProgress, syncActiveTocItem]);

  const scrollByPage = useCallback((direction: 1 | -1) => {
    if (isPagedTextMode) {
      setCurrentPageIndex((current) => clamp(current + direction, 0, Math.max(pagedPages.length - 1, 0)));
      return;
    }
    const stage = stageRef.current;
    if (!stage) return;
    stage.scrollBy({
      top: direction * stage.clientHeight * 0.82,
      behavior: "smooth",
    });
  }, [isPagedTextMode, pagedPages.length]);

  const jumpToTocItem = useCallback(
    (item: TocItem) => {
      const stage = stageRef.current;
      if (isPagedTextMode && item.pageIndex !== undefined) {
        setCurrentPageIndex(item.pageIndex);
        setTocOpen(false);
        return;
      }

      if (!stage) return;

      const selector =
        item.pageNumber !== undefined
          ? `[data-page-number="${item.pageNumber}"]`
          : `[data-toc-anchor-for="${item.id}"], [data-section-id="${item.id}"]`;
      const target = stage.querySelector<HTMLElement>(selector);
      if (!target) return;

      const stageRect = stage.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const scrollTop = stage.scrollTop;
      const relativeTop = targetRect.top - stageRect.top + scrollTop;

      stage.scrollTo({
        top: Math.max(relativeTop, 0),
        behavior: "auto",
      });
      setTocOpen(false);
    },
    [isPagedTextMode],
  );

  useEffect(() => {
    restoringRef.current = true;
    const animationFrame = window.requestAnimationFrame(() => {
      const currentProgress = progressRef.current;
      if (isPagedTextMode) {
        const nextPageIndex = pagedPages.length <= 1 ? 0 : Math.round(currentProgress * (pagedPages.length - 1));
        setCurrentPageIndex(clamp(nextPageIndex, 0, Math.max(pagedPages.length - 1, 0)));
      } else {
        const stage = stageRef.current;
        if (!stage) {
          restoringRef.current = false;
          return;
        }
        const maxScroll = stage.scrollHeight - stage.clientHeight;
        stage.scrollTop = maxScroll > 0 ? maxScroll * currentProgress : 0;
      }
      restoringRef.current = false;
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [book.id, isPagedTextMode, pagedPages.length]);

  useEffect(() => {
    if (!isPagedTextMode) return;
    const stage = stageRef.current;
    if (!stage) return;
    stage.scrollTo({ top: 0, behavior: "auto" });
  }, [currentPageIndex, isPagedTextMode]);

  useEffect(() => {
    if (!isPagedTextMode) return;
    const nextActiveId =
      [...tocItems].reverse().find((item) => item.pageIndex !== undefined && item.pageIndex <= currentPageIndex)?.id ??
      tocItems[0]?.id ??
      "";
    setActiveTocItemId((current) => (current === nextActiveId ? current : nextActiveId));
  }, [currentPageIndex, isPagedTextMode, tocItems]);

  useEffect(() => {
    if (!isPagedTextMode || restoringRef.current) return;
    onProgressChange(
      book.id,
      pagedPages.length <= 1 ? 0 : currentPageIndex / (pagedPages.length - 1),
    );
  }, [book.id, currentPageIndex, isPagedTextMode, onProgressChange, pagedPages.length]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onBack();
      if (event.key === "PageDown" || event.key === "ArrowDown") scrollByPage(1);
      if (event.key === "PageUp" || event.key === "ArrowUp") scrollByPage(-1);
      if (event.key === "Home") {
        if (isPagedTextMode) {
          setCurrentPageIndex(0);
        } else if (stageRef.current) {
          stageRef.current.scrollTo({ top: 0, behavior: "smooth" });
        }
      }
      if (event.key === "End") {
        if (isPagedTextMode) {
          setCurrentPageIndex(Math.max(pagedPages.length - 1, 0));
        } else if (stageRef.current) {
          stageRef.current.scrollTo({ top: stageRef.current.scrollHeight, behavior: "smooth" });
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isPagedTextMode, onBack, pagedPages.length, scrollByPage]);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isPagedTextMode) return;
    const animationFrame = window.requestAnimationFrame(syncActiveTocItem);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [book.id, isPagedTextMode, progress, readerMode, settings.fontScale, settings.lineHeight, syncActiveTocItem]);

  useEffect(() => {
    if (!tocOpen || !activeTocItemId) return;
    const activeItem = tocItemRefs.current[activeTocItemId];
    if (!activeItem) return;
    activeItem.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeTocItemId, tocOpen]);

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
    <section
      className={`reader-screen theme-${settings.theme}`}
      aria-label={`${book.title} 阅读器`}
    >
      <header className="reader-topbar">
        <div className="reader-left-tools">
          <button
            className="icon-button reader-nav-button reader-nav-home"
            type="button"
            onClick={onBack}
            aria-label="返回书库"
            title="返回书库"
          >
            <ArrowLeft size={21} strokeWidth={2.2} />
          </button>
          <div className="toc-wrap">
            <button
              className={`icon-button reader-nav-button reader-nav-notes${tocOpen ? " active" : ""}`}
              type="button"
              onClick={() => {
                setTocOpen((open) => !open);
                setSettingsOpen(false);
                setPagesOpen(false);
              }}
              aria-label="打开目录"
              title="目录"
            >
              <List size={20} strokeWidth={2.2} />
            </button>
            {tocOpen && (
              <div className="toc-popover">
                <div className="toc-header">
                  <span>目录</span>
                  {activeTocItem && <strong>{activeTocItem.label}</strong>}
                </div>
                <div className="toc-list">
                  {tocItems.map((item) => (
                    <button
                      className={`toc-item${item.id === activeTocItemId ? " active" : ""}`}
                      key={item.id}
                      type="button"
                      ref={(node) => {
                        tocItemRefs.current[item.id] = node;
                      }}
                      onClick={() => jumpToTocItem(item)}
                      aria-current={item.id === activeTocItemId ? "location" : undefined}
                    >
                      <span>{item.label}</span>
                      <strong>{item.meta}</strong>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button
            className={`icon-button reader-nav-button reader-nav-pages${pagesOpen ? " active" : ""}`}
            type="button"
            onClick={() => {
              setPagesOpen((open) => !open);
              setTocOpen(false);
              setSettingsOpen(false);
            }}
            aria-label="Pages"
            title="Pages"
          >
            <FileText size={20} strokeWidth={2.2} />
          </button>
          {pagesOpen && (
            <div className="reader-pages-panel">
              <button
                className={`reader-mode-button${readerMode === "scroll" ? " active" : ""}`}
                type="button"
                onClick={() => {
                  setReaderMode("scroll");
                  setPagesOpen(false);
                }}
                aria-label="滚动阅读模式"
                title="滚动阅读"
              >
                <List size={16} strokeWidth={2.2} />
                <span>scroll</span>
              </button>
              <button
                className={`reader-mode-button${readerMode === "paged" ? " active" : ""}`}
                type="button"
                onClick={() => {
                  setReaderMode("paged");
                  setPagesOpen(false);
                }}
                aria-label="翻页阅读模式"
                title="翻页阅读"
              >
                <BookOpen size={16} strokeWidth={2.2} />
                <span>paged</span>
              </button>
            </div>
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
              setTocOpen(false);
              setPagesOpen(false);
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

      <div className="reader-progress-track" aria-hidden="true">
        <span style={{ width: formatPercent(progress) }} />
      </div>

      <div className="reader-stage" ref={stageRef} onScroll={handleScroll}>
        <div className="reader-corner-illustration" aria-hidden="true">
          <img src={readerNotebook} alt="" />
        </div>
        {isPdf ? (
          <PdfDocumentView book={book} zoom={settings.fontScale} />
        ) : isPagedTextMode ? (
          <PagedTextDocumentView
            book={book}
            currentPageIndex={currentPageIndex}
            documentStyle={documentStyle}
            onPageChange={setCurrentPageIndex}
            pages={pagedPages}
          />
        ) : (
          <TextDocumentView book={book} documentStyle={documentStyle} />
        )}
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
        <span>{book.author}</span>
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
              <p key={`${section.id}-${paragraphIndex}`}>{paragraph}</p>
            ))}
          </div>
          {sectionIndex < book.sections.length - 1 && <div className="section-divider" aria-hidden="true" />}
        </section>
      ))}
    </article>
  );
}

type PagedTextDocumentViewProps = {
  book: Book;
  currentPageIndex: number;
  documentStyle: CSSProperties;
  onPageChange: (index: number) => void;
  pages: PagedDocumentPage[];
};

function PagedTextDocumentView({
  book,
  currentPageIndex,
  documentStyle,
  onPageChange,
  pages,
}: PagedTextDocumentViewProps) {
  const page = pages[currentPageIndex] ?? pages[0];
  const isFirstPage = currentPageIndex === 0;
  const isLastPage = currentPageIndex >= pages.length - 1;

  return (
    <article className="reader-document paged-document" style={documentStyle}>
      <div className="paged-page" data-page-index={currentPageIndex}>
        {currentPageIndex === 0 && (
          <header className="document-header paged-document-header">
            <p>{formatLabel(book.format)}</p>
            <h1>{book.title}</h1>
            <span>{book.author}</span>
          </header>
        )}

        {page.items.map((item) => (
          <section className="reader-section" data-section-id={item.sectionId} key={`${page.id}-${item.sectionId}`}>
            {(item.label || item.heading) && (
              <header className="section-header">
                {item.label && <span>{item.label}</span>}
                {item.heading && <h2>{item.heading}</h2>}
              </header>
            )}
            <div className="reader-copy">
              {item.paragraphs.map((paragraph, paragraphIndex) => (
                <p key={`${page.id}-${item.sectionId}-${paragraphIndex}`}>{paragraph}</p>
              ))}
            </div>
          </section>
        ))}
      </div>

      <footer className="paged-footer">
        <button
          className="paged-turn-button"
          type="button"
          onClick={() => onPageChange(Math.max(currentPageIndex - 1, 0))}
          disabled={isFirstPage}
        >
          prev
        </button>
        <span aria-hidden="true">
          {currentPageIndex + 1}/{pages.length}
        </span>
        <button
          className="paged-turn-button"
          type="button"
          onClick={() => onPageChange(Math.min(currentPageIndex + 1, pages.length - 1))}
          disabled={isLastPage}
        >
          next
        </button>
      </footer>
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
