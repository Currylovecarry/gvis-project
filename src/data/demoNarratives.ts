import type {
  Character,
  Event as NarrativeEvent,
  NarrativeJsonResponse,
  Relation,
} from "../types/narrative";

export type DemoNarrative = {
  id: string;
  title: string;
  characters: Character[];
  events: NarrativeEvent[];
  relations?: DemoRelation[];
};

type DemoRelation = Relation & {
  revealPoint: number;
  hidePoint?: number;
};

const character = (
  id: string,
  name: string,
  details: Partial<Omit<Character, "id" | "name">> = {},
): Character => ({
  id,
  name,
  aliases: [],
  description: "",
  evidence: "",
  confidence: 1,
  ...details,
});

export const DEMO_NARRATIVES: DemoNarrative[] = [
  {
    id: "fortune-and-love",
    title: "财神与爱神",
    characters: [
      character("anthony", "安东尼·洛克沃尔"),
      character("richard", "理查德"),
      character("lantry", "兰特里小姐"),
      character("ellen", "埃伦姑妈"),
      character("kelly", "凯利"),
    ],
    events: [
      { id: "f1", order: 1, description: "安东尼与儿子谈论金钱", location: "洛克沃尔书房", characters: ["anthony", "richard"], character_importance: { anthony: 0.58, richard: 0.42 }, importance: "medium", evidence: "" },
      { id: "f2", order: 2, description: "理查德说出求爱的难题", location: "洛克沃尔书房", characters: ["richard", "anthony"], character_importance: { richard: 0.7, anthony: 0.3 }, importance: "high", evidence: "" },
      { id: "f3", order: 3, description: "埃伦姑妈交出母亲的戒指", location: "埃伦姑妈家", characters: ["ellen", "richard"], character_importance: { ellen: 0.55, richard: 0.45 }, importance: "medium", evidence: "" },
      { id: "f4", order: 4, description: "理查德在车站接到兰特里", location: "中央火车站", characters: ["richard", "lantry"], character_importance: { richard: 0.48, lantry: 0.52 }, importance: "medium", evidence: "" },
      { id: "f5", order: 5, description: "马车陷入预先安排的交通阻塞", location: "第三十四号街", characters: ["richard", "lantry", "anthony", "kelly"], character_importance: { richard: 0.32, lantry: 0.3, anthony: 0.25, kelly: 0.13 }, importance: "high", evidence: "" },
      { id: "f6", order: 6, description: "理查德向兰特里表白并订婚", location: "第三十四号街", characters: ["richard", "lantry"], character_importance: { richard: 0.48, lantry: 0.52 }, importance: "high", evidence: "" },
      { id: "f7", order: 7, description: "凯利揭示交通阻塞的安排", location: "洛克沃尔书房", characters: ["kelly", "anthony"], character_importance: { kelly: 0.55, anthony: 0.45 }, importance: "medium", evidence: "" },
    ],
    relations: [
      { id: "fr1", source: "anthony", target: "richard", relation_type: "family", description: "父子", evidence: "他还没有摸透他老子的脾气。", confidence: 1, revealPoint: 0 },
      { id: "fr2", source: "anthony", target: "ellen", relation_type: "family", description: "姐弟", evidence: "埃伦姑妈来看她的弟弟了。", confidence: 1, revealPoint: 0.27 },
      { id: "fr3", source: "ellen", target: "richard", relation_type: "family", description: "姑侄", evidence: "埃伦姑妈从一个蛀痕斑驳的盒子里取出一枚古雅的金戒指，把它交给理查德。", confidence: 1, revealPoint: 0.27 },
      { id: "fr4", source: "richard", target: "lantry", relation_type: "acquaintance", description: "心仪对象", evidence: "在兰特里小姐启程之前，要同她好好谈一谈是没有希望的了。", confidence: 0.98, revealPoint: 0.43, hidePoint: 0.78 },
      { id: "fr5", source: "richard", target: "lantry", relation_type: "spouse", description: "订婚伴侣", evidence: "她答应跟我们的理查德结婚。", confidence: 1, revealPoint: 0.78 },
      { id: "fr6", source: "anthony", target: "kelly", relation_type: "other", description: "委托人与受托人", evidence: "一千元是酬劳你的，三百元是还你垫付的钱。", confidence: 1, revealPoint: 0.92 },
    ],
  },
  {
    id: "tobins-palm",
    title: "托宾的手相",
    characters: [
      character("tobin", "托宾"),
      character("john", "约翰·马隆"),
      character("zaza", "佐佐夫人"),
      character("frieden", "弗里登豪森曼"),
      character("katie", "卡蒂·玛霍纳"),
    ],
    events: [
      { id: "t1", order: 1, description: "托宾因卡蒂失踪而郁郁寡欢", location: "康奈岛", characters: ["tobin", "john", "katie"], character_importance: { tobin: 0.55, john: 0.2, katie: 0.25 }, importance: "medium", evidence: "" },
      { id: "t2", order: 2, description: "佐佐夫人预言麻烦与钩鼻贵人", location: "康奈岛", characters: ["tobin", "zaza", "john"], character_importance: { tobin: 0.5, zaza: 0.38, john: 0.12 }, importance: "high", evidence: "" },
      { id: "t3", order: 3, description: "托宾在码头冲突并丢失零钱", location: "康奈岛", characters: ["tobin", "john"], character_importance: { tobin: 0.72, john: 0.28 }, importance: "medium", evidence: "" },
      { id: "t4", order: 4, description: "渡船上的意外让托宾确信预言应验", location: "回程渡船", characters: ["tobin", "john"], character_importance: { tobin: 0.68, john: 0.32 }, importance: "high", evidence: "" },
      { id: "t5", order: 5, description: "托宾找到钩鼻的弗里登豪森曼", location: "第二十二街", characters: ["tobin", "john", "frieden"], character_importance: { tobin: 0.42, john: 0.18, frieden: 0.4 }, importance: "high", evidence: "" },
      { id: "t6", order: 6, description: "三人在酒吧讨论预言与文学", location: "第二十二街", characters: ["tobin", "john", "frieden"], character_importance: { tobin: 0.38, john: 0.2, frieden: 0.42 }, importance: "medium", evidence: "" },
      { id: "t7", order: 7, description: "弗里登豪森曼邀请两人回家吃夜宵", location: "弗里登豪森曼家", characters: ["tobin", "john", "frieden"], character_importance: { tobin: 0.3, john: 0.25, frieden: 0.45 }, importance: "medium", evidence: "" },
      { id: "t8", order: 8, description: "帮厨女工正是失踪的卡蒂·玛霍纳", location: "弗里登豪森曼家", characters: ["tobin", "katie", "frieden", "john"], character_importance: { tobin: 0.4, katie: 0.35, frieden: 0.15, john: 0.1 }, importance: "high", evidence: "" },
    ],
    relations: [
      { id: "tr1", source: "tobin", target: "john", relation_type: "friend", description: "挚友", evidence: "托宾是我的朋友，我是他的朋友。", confidence: 1, revealPoint: 0 },
      { id: "tr2", source: "tobin", target: "katie", relation_type: "spouse", description: "恋人", evidence: "托宾在斯莱戈郡的情人卡蒂·玛霍纳动身前来美国。", confidence: 1, revealPoint: 0 },
      { id: "tr3", source: "tobin", target: "zaza", relation_type: "acquaintance", description: "顾客与手相师", evidence: "托宾交了十美分，伸出一只手。", confidence: 1, revealPoint: 0.1 },
      { id: "tr4", source: "tobin", target: "frieden", relation_type: "acquaintance", description: "新识与东道主", evidence: "那人说他必须回家了，请我和托宾陪他走一段。", confidence: 0.96, revealPoint: 0.48 },
      { id: "tr5", source: "john", target: "frieden", relation_type: "acquaintance", description: "新识与东道主", evidence: "他说着把我和托宾带到一家酒吧的后屋。", confidence: 0.96, revealPoint: 0.48 },
      { id: "tr6", source: "frieden", target: "katie", relation_type: "other", description: "雇主与帮厨", evidence: "我们新雇的帮厨女工卡蒂·玛霍纳。", confidence: 1, revealPoint: 0.88 },
    ],
  },
  {
    id: "the-sham",
    title: "华而不实",
    characters: [
      character("chandler", "托尔斯·钱德勒"),
      character("marian", "玛丽安小姐"),
      character("sister", "玛丽安的姊姊"),
      character("maid", "使女玛丽"),
    ],
    events: [
      { id: "s1", order: 1, description: "钱德勒攒钱装扮成上流绅士", location: "寄宿舍卧室", characters: ["chandler"], character_importance: { chandler: 1 }, importance: "medium", evidence: "" },
      { id: "s2", order: 2, description: "玛丽安在雪地滑倒扭伤脚踝", location: "百老汇街角", characters: ["marian", "chandler"], character_importance: { marian: 0.58, chandler: 0.42 }, importance: "medium", evidence: "" },
      { id: "s3", order: 3, description: "钱德勒邀请朴素的玛丽安共进晚餐", location: "百老汇街角", characters: ["chandler", "marian"], character_importance: { chandler: 0.52, marian: 0.48 }, importance: "high", evidence: "" },
      { id: "s4", order: 4, description: "两人在华丽饭馆相谈甚欢", location: "百老汇饭馆", characters: ["chandler", "marian"], character_importance: { chandler: 0.5, marian: 0.5 }, importance: "medium", evidence: "" },
      { id: "s5", order: 5, description: "钱德勒吹嘘虚构的上流生活", location: "百老汇饭馆", characters: ["chandler", "marian"], character_importance: { chandler: 0.62, marian: 0.38 }, importance: "high", evidence: "" },
      { id: "s6", order: 6, description: "钱德勒告别后回到寒冷卧室后悔", location: "寄宿舍卧室", characters: ["chandler", "marian"], character_importance: { chandler: 0.78, marian: 0.22 }, importance: "medium", evidence: "" },
      { id: "s7", order: 7, description: "玛丽安回到五马路豪宅显露真实身份", location: "玛丽安家", characters: ["marian", "sister", "maid"], character_importance: { marian: 0.6, sister: 0.3, maid: 0.1 }, importance: "high", evidence: "" },
      { id: "s8", order: 8, description: "玛丽安说出理想伴侣却否定钱德勒的伪装", location: "玛丽安家", characters: ["marian", "sister", "chandler"], character_importance: { marian: 0.52, sister: 0.18, chandler: 0.3 }, importance: "high", evidence: "" },
    ],
    relations: [
      { id: "sr1", source: "chandler", target: "marian", relation_type: "acquaintance", description: "街头初识", evidence: "请允许我介绍一下自己——托尔斯·钱德勒。", confidence: 1, revealPoint: 0.1 },
      { id: "sr2", source: "marian", target: "sister", relation_type: "family", description: "姊妹", evidence: "别派我的不是了，姊姊。", confidence: 1, revealPoint: 0.75 },
      { id: "sr3", source: "marian", target: "maid", relation_type: "other", description: "主人与使女", evidence: "你穿了那身又破又旧的衣服，戴了玛丽的帽子。", confidence: 0.98, revealPoint: 0.75 },
      { id: "sr4", source: "sister", target: "maid", relation_type: "other", description: "主人与使女", evidence: "玛丽，告诉太太，玛丽安小姐已经回来了。", confidence: 0.98, revealPoint: 0.75 },
    ],
  },
  {
    id: "the-brief-debut-of-tildy",
    title: "昙花一现",
    characters: [
      character("tildy", "蒂尔苔", {
        aliases: ["蒂尔"],
        description: "鲍格尔饭馆里相貌平常、热心讨好的女侍者，渴望得到浪漫关注。",
        evidence: "蒂尔苔相貌平常、又矮又胖，一心只想讨好讨好。",
      }),
      character("aileen", "爱玲", {
        description: "美丽活泼、善于周旋的女侍者，也是蒂尔苔忠实的朋友。",
        evidence: "她高挑身材、美丽活泼、态度优雅、很会开玩笑。",
      }),
      character("bogel", "鲍格尔", {
        description: "鲍格尔饭馆的老板兼收银员，外表冷淡，却在蒂尔苔受吻后给她加薪。",
        evidence: "鲍格尔坐在收银台后面，冷淡、邋遢、迟缓、阴沉，还收你的钱。",
      }),
      character("seiders", "西德斯先生", {
        aliases: ["西德斯"],
        description: "腼腆的洗衣店职员；酒后亲吻蒂尔苔，清醒后又回来道歉。",
        evidence: "西德斯先生身材瘦削，头发稀疏。",
      }),
      character("daredevil", "“冒失鬼”", {
        aliases: ["冒失鬼"],
        description: "爱玲的一名追求者，在街上纠缠她并打伤了她的眼睛。",
        evidence: "他还手，把我眼睛打坏了。",
      }),
    ],
    events: [
      { id: "b1", order: 1, description: "鲍格尔饭馆与两位女侍者登场", location: "八马路·鲍格尔饭馆", characters: ["bogel", "aileen", "tildy"], character_importance: { bogel: 0.2, aileen: 0.42, tildy: 0.38 }, importance: "medium", evidence: "一个女侍者名叫爱玲。另一个女侍者的名字叫做蒂尔苔。" },
      { id: "b2", order: 2, description: "爱玲备受追捧，蒂尔苔无人问津却仍支持朋友", location: "鲍格尔饭馆店堂", characters: ["aileen", "tildy"], character_importance: { aileen: 0.52, tildy: 0.48 }, importance: "medium", evidence: "她是爱玲的朋友；她乐于看到爱玲统治男人的心。" },
      { id: "b3", order: 3, description: "“冒失鬼”尾随爱玲并打伤她的眼睛", location: "二十三街至八马路", characters: ["aileen", "daredevil", "tildy"], character_importance: { aileen: 0.5, daredevil: 0.38, tildy: 0.12 }, importance: "high", evidence: "我结结实实地给了他一个耳刮子。他还手，把我眼睛打坏了。" },
      { id: "b4", order: 4, description: "醉酒的西德斯突然搂住并亲吻蒂尔苔", location: "鲍格尔饭馆店堂", characters: ["tildy", "seiders", "aileen"], character_importance: { tildy: 0.48, seiders: 0.42, aileen: 0.1 }, importance: "high", evidence: "西德斯先生吃完了他的柔鱼，站起身来，搂住蒂尔苔的腰，冒冒失失地大声吻了她一下。" },
      { id: "b5", order: 5, description: "蒂尔苔宣告受吻，获加薪并成为众人打趣的焦点", location: "鲍格尔账桌与店堂", characters: ["tildy", "aileen", "bogel", "seiders"], character_importance: { tildy: 0.58, aileen: 0.14, bogel: 0.18, seiders: 0.1 }, importance: "high", evidence: "下星期起，我加你一块钱薪水。" },
      { id: "b6", order: 6, description: "西德斯缺席两天，蒂尔苔精心打扮并幻想热恋", location: "鲍格尔饭馆店堂", characters: ["tildy", "seiders", "aileen"], character_importance: { tildy: 0.68, seiders: 0.24, aileen: 0.08 }, importance: "medium", evidence: "她买了缎带，把自己的头发像爱玲那样打扮起来，并且把腰身束紧了两英寸。" },
      { id: "b7", order: 7, description: "西德斯回来道歉，坦言亲吻只是醉酒失态", location: "鲍格尔饭馆后部", characters: ["seiders", "tildy", "aileen"], character_importance: { seiders: 0.48, tildy: 0.45, aileen: 0.07 }, importance: "high", evidence: "我那晚喝得糊里糊涂，不然我绝对不会做出那种事来的。" },
      { id: "b8", order: 8, description: "蒂尔苔梦想破灭，爱玲在屏风后温柔安慰她", location: "饭馆屏风后", characters: ["tildy", "aileen", "seiders"], character_importance: { tildy: 0.56, aileen: 0.34, seiders: 0.1 }, importance: "high", evidence: "爱玲的胳臂搂住了她；蒂尔苔的红通通的手在牛油碟子中间摸索了一会儿，握住了她朋友的温暖的手。" },
    ],
    relations: [
      { id: "br1", source: "tildy", target: "aileen", relation_type: "friend", description: "亲密朋友", evidence: "她是爱玲的朋友。", confidence: 1, revealPoint: 0.14 },
      { id: "br2", source: "bogel", target: "tildy", relation_type: "other", description: "雇主与女侍者", evidence: "下星期起，我加你一块钱薪水。", confidence: 0.98, revealPoint: 0 },
      { id: "br3", source: "bogel", target: "aileen", relation_type: "other", description: "雇主与女侍者", evidence: "鲍格尔的主顾们的需要是由两个女侍者和一个‘嗓音’供应的。", confidence: 0.98, revealPoint: 0 },
      { id: "br4", source: "seiders", target: "tildy", relation_type: "acquaintance", description: "常客与女侍者", evidence: "惯常坐在蒂尔苔照应的桌子旁。", confidence: 0.96, revealPoint: 0.47 },
      { id: "br5", source: "daredevil", target: "aileen", relation_type: "conflict", description: "追求与冲突", evidence: "我结结实实地给了他一个耳刮子。他还手，把我眼睛打坏了。", confidence: 1, revealPoint: 0.35 },
    ],
  },
];

/**
 * Local progressive-reading fixtures for the four preloaded EPUBs.
 * Each threshold is a reader progress watermark, not knowledge about a later
 * event: the event is simply absent from the UI until its watermark is reached.
 */
const PROGRESSIVE_DEMO_CONFIG: Record<string, { narrativeId: string; revealPoints: number[] }> = {
  "the-gift-of-the-magi": {
    narrativeId: "fortune-and-love",
    revealPoints: [0, 0.12, 0.27, 0.43, 0.61, 0.78, 0.92],
  },
  "tobin-s-palm": {
    narrativeId: "tobins-palm",
    revealPoints: [0, 0.1, 0.22, 0.35, 0.48, 0.61, 0.74, 0.88],
  },
  "the-shamrock-and-the-palm": {
    narrativeId: "the-sham",
    revealPoints: [0, 0.1, 0.23, 0.36, 0.49, 0.62, 0.75, 0.88],
  },
  "the-brief-debut-of-tildy": {
    narrativeId: "the-brief-debut-of-tildy",
    revealPoints: [0, 0.14, 0.35, 0.47, 0.55, 0.72, 0.8, 0.9],
  },
};

export function getProgressiveDemoNarrative(
  bookId: string,
  readingProgress: number,
): NarrativeJsonResponse | null {
  const config = PROGRESSIVE_DEMO_CONFIG[bookId];
  if (!config) return null;

  const story = DEMO_NARRATIVES.find((narrative) => narrative.id === config.narrativeId);
  if (!story) return null;

  const boundedProgress = Math.min(Math.max(readingProgress, 0), 1);
  const visibleEvents = story.events.filter(
    (_, index) => boundedProgress >= config.revealPoints[index],
  );
  const visibleCharacterIds = new Set(
    visibleEvents.flatMap((event) => event.characters),
  );

  return {
    story_title: story.title,
    range: {
      startIndex: 0,
      endIndex: Math.round(boundedProgress * 10_000),
    },
    characters: story.characters.filter((character) => visibleCharacterIds.has(character.id)),
    events: visibleEvents,
    relations: (story.relations ?? [])
      .filter(
        (relation) =>
          boundedProgress >= relation.revealPoint &&
          (relation.hidePoint === undefined || boundedProgress < relation.hidePoint) &&
          visibleCharacterIds.has(relation.source) &&
          visibleCharacterIds.has(relation.target),
      )
      .map(({ revealPoint: _revealPoint, hidePoint: _hidePoint, ...relation }) => relation),
  };
}
