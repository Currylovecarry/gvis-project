import JSZip from "jszip";
import { Book, ReaderSection } from "../data/books";

type ManifestItem = {
  href: string;
  mediaType: string;
};

type ParsedChapter = {
  heading?: string;
  paragraphs: string[];
};

function parseXml(source: string, type: DOMParserSupportedType = "application/xml") {
  const document = new DOMParser().parseFromString(source, type);
  const parserError = document.querySelector("parsererror");
  if (parserError) {
    throw new Error("EPUB 文件结构无法解析");
  }
  return document;
}

function normalizePath(path: string) {
  const parts: string[] = [];

  path.split("/").forEach((part) => {
    if (!part || part === ".") return;
    if (part === "..") {
      parts.pop();
      return;
    }
    parts.push(part);
  });

  return parts.join("/");
}

function joinPath(basePath: string, relativePath: string) {
  if (!basePath) return normalizePath(relativePath);
  return normalizePath(`${basePath}/${relativePath}`);
}

function getDirectory(path: string) {
  const lastSlash = path.lastIndexOf("/");
  return lastSlash >= 0 ? path.slice(0, lastSlash) : "";
}

function textOf(element: Element | null | undefined) {
  return element?.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

function getMetadata(opfDocument: Document) {
  const title = textOf(
    opfDocument.querySelector("metadata title") ??
      opfDocument.querySelector("title"),
  );
  const creator = textOf(
    opfDocument.querySelector("metadata creator") ??
      opfDocument.querySelector("creator"),
  );

  return {
    title: title || "未命名图书",
    author: creator || "未知作者",
  };
}

function readManifest(opfDocument: Document) {
  const manifest = new Map<string, ManifestItem>();

  opfDocument.querySelectorAll("manifest item").forEach((item) => {
    const id = item.getAttribute("id");
    const href = item.getAttribute("href");
    const mediaType = item.getAttribute("media-type") ?? "";

    if (id && href) {
      manifest.set(id, { href, mediaType });
    }
  });

  return manifest;
}

function readSpinePaths(opfDocument: Document, manifest: Map<string, ManifestItem>, opfDirectory: string) {
  return [...opfDocument.querySelectorAll("spine itemref")]
    .map((itemRef) => itemRef.getAttribute("idref"))
    .filter((idref): idref is string => Boolean(idref))
    .map((idref) => manifest.get(idref))
    .filter((item): item is ManifestItem => Boolean(item))
    .filter((item) =>
      item.mediaType.includes("xhtml") ||
      item.mediaType.includes("html") ||
      item.href.endsWith(".xhtml") ||
      item.href.endsWith(".html"),
    )
    .map((item) => joinPath(opfDirectory, item.href));
}

function extractBlocks(xhtml: string) {
  const document = parseXml(xhtml, "application/xhtml+xml");
  const body = document.querySelector("body");
  if (!body) return [];

  body.querySelectorAll("script, style, nav, aside").forEach((node) => node.remove());

  const blockSelectors = "h1,h2,h3,h4,p,blockquote,li";
  const blocks = [...body.querySelectorAll(blockSelectors)]
    .map((element) => {
      const tagName = element.tagName.toLowerCase();
      const text = textOf(element);
      if (!text) return null;
      return { tagName, text };
    })
    .filter((block): block is { tagName: string; text: string } => Boolean(block));

  if (blocks.length) return blocks;

  const fallback = textOf(body);
  return fallback ? [{ tagName: "p", text: fallback }] : [];
}

function toSections(chapters: ParsedChapter[], fallbackHeading: string): ReaderSection[] {
  const sections = chapters
    .filter((chapter) => chapter.paragraphs.length)
    .map((chapter, index) => ({
      id: `section-${index + 1}`,
      label: String(index + 1),
      heading: chapter.heading,
      paragraphs: chapter.paragraphs,
    }));

  return sections.length
    ? sections
    : [
        {
          id: "section-1",
          label: "1",
          heading: fallbackHeading,
          paragraphs: ["没有在这本文件中找到可以显示的正文。"],
        },
      ];
}

export async function parseEpubFile(file: File): Promise<Book> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const containerXml = await zip.file("META-INF/container.xml")?.async("text");

  if (!containerXml) {
    throw new Error("找不到 EPUB 的 container.xml");
  }

  const containerDocument = parseXml(containerXml);
  const opfPath = containerDocument.querySelector("rootfile")?.getAttribute("full-path");

  if (!opfPath) {
    throw new Error("找不到 EPUB 的 OPF 文件路径");
  }

  const opfXml = await zip.file(opfPath)?.async("text");
  if (!opfXml) {
    throw new Error("无法读取 EPUB 的 OPF 文件");
  }

  const opfDocument = parseXml(opfXml);
  const opfDirectory = getDirectory(opfPath);
  const metadata = getMetadata(opfDocument);
  const manifest = readManifest(opfDocument);
  const spinePaths = readSpinePaths(opfDocument, manifest, opfDirectory);

  const chapters = await Promise.all(
    spinePaths.map(async (path) => {
      const xhtml = await zip.file(path)?.async("text");
      if (!xhtml) return null;

      const blocks = extractBlocks(xhtml);
      const firstHeadingIndex = blocks.findIndex((block) => block.tagName.match(/^h[1-4]$/));
      const heading = firstHeadingIndex >= 0 ? blocks[firstHeadingIndex].text : undefined;
      const paragraphs = blocks
        .filter((block, index) => index !== firstHeadingIndex)
        .map((block) => block.text);

      if (!paragraphs.length) return null;

      return heading ? { heading, paragraphs } : { paragraphs };
    }),
  );

  return {
    id: `${Date.now()}-${file.name}`,
    title: metadata.title,
    author: metadata.author,
    format: "epub",
    sections: toSections(
      chapters.filter((chapter): chapter is ParsedChapter => Boolean(chapter)),
      metadata.title,
    ),
    importedAt: Date.now(),
  };
}

export async function parseTextFile(file: File): Promise<Book> {
  const source = await file.text();
  const paragraphs = source
    .split(/\n\s*\n/g)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const title = file.name.replace(/\.[^/.]+$/, "") || "未命名文本";

  return {
    id: `${Date.now()}-${file.name}`,
    title,
    author: "本地文本",
    format: "txt",
    sections: toSections([{ heading: title, paragraphs }], title),
    importedAt: Date.now(),
  };
}
