import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentLoadingTask,
  type PDFDocumentProxy,
} from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import { Book } from "../data/books";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

function titleFromFile(file: File) {
  return file.name.replace(/\.[^/.]+$/, "") || "未命名 PDF";
}

export function loadPdfDocument(data: ArrayBuffer): PDFDocumentLoadingTask {
  return getDocument({
    data: data.slice(0),
  });
}

export async function parsePdfFile(file: File): Promise<Book> {
  const data = await file.arrayBuffer();
  const loadingTask = loadPdfDocument(data);

  try {
    const document = await loadingTask.promise;
    const metadata = await document.getMetadata().catch(() => null);
    const info = metadata?.info as { Title?: string; Author?: string } | undefined;
    const title = info?.Title?.trim() || titleFromFile(file);
    const author = info?.Author?.trim() || "本地 PDF";

    return {
      id: `${Date.now()}-${file.name}`,
      title,
      author,
      format: "pdf",
      sections: [],
      pdf: {
        data,
        pageCount: document.numPages,
        fileSize: file.size,
      },
      importedAt: Date.now(),
    };
  } finally {
    await loadingTask.destroy();
  }
}

export type { PDFDocumentProxy };
