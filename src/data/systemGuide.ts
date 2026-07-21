import type { Book } from "./books";

export const SYSTEM_GUIDE_BOOK_ID = "lumen-system-guide";

export const SYSTEM_GUIDE_BOOK: Book = {
  id: SYSTEM_GUIDE_BOOK_ID,
  title: "三分钟认识微光",
  author: "Lumen · 系统演示",
  format: "sample",
  description: "跟着一篇很短的故事，试试阅读辅助、人物关系和事件线。",
  sections: [
    {
      id: "guide-start",
      label: "1",
      heading: "先安静地读一小段",
      paragraphs: [
        "傍晚，小岚在窗边拆开阿宁寄来的信。信纸上只写着一句话：“周六下午，旧车站见。”",
        "先保持左侧的 zero 模式往下读。这个模式不会展示 AI 辅助，界面会尽量退到文字后面。",
      ],
    },
    {
      id: "guide-assistance",
      label: "2",
      heading: "让辅助靠近一点",
      paragraphs: [
        "信封里还夹着一张两年前的旧车票。小岚想起，那是她和阿宁第一次一起远行时留下的。",
        "现在选择左侧的 medium，再点击圆形 AI 按钮。微光会只整理箭头所指位置之前的内容，不会提前透露后面的故事。",
      ],
    },
    {
      id: "guide-visuals",
      label: "3",
      heading: "看看故事如何展开",
      paragraphs: [
        "小岚把旧车票放进外套口袋，决定周六去赴约。她还不知道阿宁要说什么，但那个约定已经让这个雨天亮了一点。",
        "继续向下滚动，你会看到事件线和人物关系随已读内容逐步更新。点击其中的节点，可以查看事件、地点和人物。",
      ],
    },
    {
      id: "guide-finish",
      label: "4",
      heading: "调成你舒服的样子",
      paragraphs: [
        "右上角的 T 可以调整字号、行距和纸张主题。low 由你主动更新，medium 会在重要节点给出轻量提示，high 则会更紧密地跟随阅读位置。",
        "读到页面末尾后，点击“结束阅读并保存记录”。系统会保存阅读时长、最终进度和辅助调用次数，并自动下载 JSON 记录。",
      ],
    },
  ],
};
