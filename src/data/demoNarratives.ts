import type { Character, Event as NarrativeEvent } from "../types/narrative";

export type DemoNarrative = {
  id: string;
  title: string;
  characters: Character[];
  events: NarrativeEvent[];
};

const character = (id: string, name: string): Character => ({
  id,
  name,
  aliases: [],
  description: "",
  evidence: "",
  confidence: 1,
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
  },
  {
    id: "maggie-appears",
    title: "玛吉登场",
    characters: [
      character("maggie", "玛吉·图尔"),
      character("anna", "安娜·麦卡蒂"),
      character("jimmy", "吉米·伯恩斯"),
      character("terry", "特里·奥沙利文"),
      character("dempsey", "邓普西·多诺万"),
      character("mike", "大迈克·奥沙利文"),
    ],
    events: [
      { id: "m1", order: 1, description: "玛吉告诉安娜自己已有舞伴", location: "玛吉住处", characters: ["maggie", "anna", "jimmy"], character_importance: { maggie: 0.55, anna: 0.35, jimmy: 0.1 }, importance: "medium", evidence: "" },
      { id: "m2", order: 2, description: "玛吉带特里·奥沙利文进入舞会", location: "协会大厅", characters: ["maggie", "terry", "anna", "jimmy"], character_importance: { maggie: 0.38, terry: 0.38, anna: 0.16, jimmy: 0.08 }, importance: "high", evidence: "" },
      { id: "m3", order: 3, description: "玛吉第一次成为舞会的焦点", location: "舞池", characters: ["maggie", "terry", "anna"], character_importance: { maggie: 0.58, terry: 0.3, anna: 0.12 }, importance: "high", evidence: "" },
      { id: "m4", order: 4, description: "特里连跳两支舞引起邓普西警觉", location: "舞池", characters: ["terry", "dempsey", "maggie"], character_importance: { terry: 0.45, dempsey: 0.35, maggie: 0.2 }, importance: "medium", evidence: "" },
      { id: "m5", order: 5, description: "邓普西查问并质疑特里的身份", location: "协会大厅", characters: ["dempsey", "terry", "mike"], character_importance: { dempsey: 0.45, terry: 0.4, mike: 0.15 }, importance: "high", evidence: "" },
      { id: "m6", order: 6, description: "特里被带到后屋与邓普西决斗", location: "格斗房", characters: ["terry", "dempsey"], character_importance: { terry: 0.5, dempsey: 0.5 }, importance: "high", evidence: "" },
      { id: "m7", order: 7, description: "玛吉夺下短剑并揭穿托尼的身份", location: "格斗房", characters: ["maggie", "terry", "dempsey"], character_importance: { maggie: 0.48, terry: 0.3, dempsey: 0.22 }, importance: "high", evidence: "" },
      { id: "m8", order: 8, description: "邓普西维护玛吉并邀她下周共舞", location: "协会大厅", characters: ["dempsey", "maggie"], character_importance: { dempsey: 0.5, maggie: 0.5 }, importance: "high", evidence: "" },
    ],
  },
];
