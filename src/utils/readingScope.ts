import { ReaderSection } from "../data/books";

export interface ChapterRange {
  title: string;
  startIndex: number;
  endIndex: number;
}

export interface ParagraphRange {
  sectionId: string;
  paragraphIndex: number;
  startIndex: number;
  endIndex: number;
}

export interface ReadingScopeIndex {
  fullText: string;
  chapters: ChapterRange[];
  paragraphs: ParagraphRange[];
}

export interface CurrentStoryScope {
  title: string;
  text: string;
  startIndex: number;
  endIndex: number;
}

export function buildReadingScopeIndex(sections: ReaderSection[]): ReadingScopeIndex {
  let fullText = "";
  const chapters: ChapterRange[] = [];
  const paragraphs: ParagraphRange[] = [];

  sections.forEach((section, sectionIndex) => {
    if (fullText) {
      fullText += "\n\n";
    }

    const chapterStart = fullText.length;
    const title = section.heading || section.label || `第 ${sectionIndex + 1} 节`;
    fullText += title;

    section.paragraphs.forEach((paragraph, paragraphIndex) => {
      fullText += "\n\n";
      const paragraphStart = fullText.length;
      fullText += paragraph;
      paragraphs.push({
        sectionId: section.id,
        paragraphIndex,
        startIndex: paragraphStart,
        endIndex: fullText.length,
      });
    });

    chapters.push({
      title,
      startIndex: chapterStart,
      endIndex: fullText.length,
    });
  });

  return { fullText, chapters, paragraphs };
}

export function getCurrentStoryTextUntilPage(
  fullText: string,
  currentPageEndIndex: number,
  chapters: ChapterRange[],
): CurrentStoryScope {
  if (!fullText || !chapters.length) {
    return {
      title: "",
      text: "",
      startIndex: 0,
      endIndex: 0,
    };
  }

  const boundedEndIndex = Math.min(Math.max(currentPageEndIndex, 0), fullText.length);
  const currentChapter =
    chapters.find((chapter, index) => {
      const nextChapter = chapters[index + 1];
      return (
        chapter.startIndex <= boundedEndIndex &&
        (!nextChapter || boundedEndIndex < nextChapter.startIndex)
      );
    }) ?? chapters[0];

  const startIndex = currentChapter.startIndex;
  const minimumTitleEndIndex = Math.min(
    startIndex + currentChapter.title.length,
    currentChapter.endIndex,
  );
  const endIndex = Math.max(
    Math.min(boundedEndIndex, currentChapter.endIndex),
    minimumTitleEndIndex,
  );

  return {
    title: currentChapter.title,
    text: fullText.slice(startIndex, endIndex),
    startIndex,
    endIndex,
  };
}
