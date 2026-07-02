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

export const books: Book[] = [
  {
    id: "slack-water",
    title: "Slack Water",
    author: "Lumen Studio",
    format: "sample",
    coverIndex: 0,
    description: "A short narrative sample for building the base reader.",
    sections: [
      {
        id: "slack-water-1",
        label: "1",
        heading: "归途 · 湖畔车道",
        paragraphs: [
          "The lake came up gray through the windshield, the way it always had, and Mara slowed the car though no one was behind her for miles. Twelve years, and the road still knew the shape of her hands.",
          "She had not told Elise exactly when she would arrive. That was a small cruelty, and she knew it, and she did it anyway.",
          "The house sat low against the water, smaller than memory had kept it. A light was on in the kitchen. Of course a light was on.",
          "Tomas's truck stood at an angle by the shed, one tire in the flowerbed their mother had kept. So he was here too. Mara had hoped, foolishly, that he wouldn't be.",
        ],
      },
      {
        id: "slack-water-2",
        label: "2",
        heading: "厨房",
        paragraphs: [
          "The kitchen smelled of woodsmoke and something burnt beneath it. Elise stood at the counter with her back to the door, and did not turn when it opened. \"You found it, then,\" she said.",
          "\"I always find it.\" Mara set her keys in the dish where the keys had always gone. The dish was new. Everything was a little new, a little wrong.",
          "For a while neither of them said the word. Mother. It sat in the room like a fourth chair pulled out and left empty. Outside, the light was going.",
          "She remembered the last good summer here, the three of them on the dock before the diagnosis, before the lawyers. She had been the one who left. She was always the one who left.",
          "\"She left it to you.\" Elise's voice came suddenly from the doorway. \"The house. All of it. You. Not me.\"",
          "Elise's hands were shaking. \"Twelve years I stayed. I changed her sheets. I held the basin. And she left it to the one who ran.\"",
        ],
      },
      {
        id: "slack-water-3",
        label: "3",
        heading: "船屋 · 湖边",
        paragraphs: [
          "They went down to the boathouse, because that was where they had always gone to say the unsayable as girls, the water slapping the hull below the boards.",
          "Elise pulled an envelope from her coat. Mara's name on it, in Mother's hand, the letters gone loose and strange near the end. \"She wanted me to give you this. I almost didn't.\"",
          "Mara did not open it. She looked at her sister, at Elise, gray at the temple now, Tomas's quiet wife, and saw, for the first time in twelve years, how tired she was.",
          "\"I don't want the house,\" Mara said. The water moved under them, neither coming in nor going out. Slack water, their father had called it. The pause between.",
          "\"I know,\" Elise said. And something in the room, in the years, let go by a single notch. Not forgiveness. Not yet. But a chair pulled out, at last, for someone to sit.",
        ],
      },
    ],
  },
];
