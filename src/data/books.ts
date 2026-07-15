export type BookFormat = "sample" | "epub" | "txt" | "pdf";

export type ReaderSection = {
  id: string;
  label?: string;
  heading?: string;
  paragraphs: string[];
};

export type Book = {
  id: string;
  title: string;
  author: string;
  format: BookFormat;
  description?: string;
  sections: ReaderSection[];
  coverIndex?: number;
  pdf?: {
    data: ArrayBuffer;
    pageCount: number;
    fileSize: number;
  };
  importedAt?: number;
};

export function getBookTextStats(book: Book) {
  return {
    sections: book.sections.length,
    paragraphs: book.sections.reduce((total, section) => total + section.paragraphs.length, 0),
    pages: book.pdf?.pageCount ?? 0,
  };
}
