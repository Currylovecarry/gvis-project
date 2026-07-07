# 启用延迟解析类型注解，避免复杂类型或前向引用在运行时过早解析。
from __future__ import annotations

# 导入请求数据结构：包含 story_title、text、startIndex、endIndex。
from schemas import NarrativeJSONRequest

# 系统提示词：约束 LLM 只能基于当前小说片段抽取结构化叙事数据。
# 重点控制：不剧透、不补全、必须给证据、只输出严格 JSON。
SYSTEM_PROMPT = """You extract structured narrative data from fiction excerpts.

Core rules:
1. Use only the text provided by the user.  # 只能使用用户提供的文本。
2. Do not guess future plot.  # 不要推测后续剧情。
3. Do not spoil anything beyond the provided reading range.  # 不要剧透当前阅读范围之外的内容。
4. Do not add information outside the text.  # 不要添加文本外的信息。
5. Every character, event, and relation must include evidence copied from the provided text.  # 每个角色、事件、关系都必须包含原文证据。
6. Evidence must be an exact phrase or sentence from the provided text.  # evidence 必须是原文中的精确短语或句子。
7. If information is unclear, omit it or set confidence low.  # 信息不明确时，省略或降低置信度。
8. Output strict JSON only.  # 只输出严格 JSON。
9. Do not output markdown.  # 不要输出 Markdown 代码块。
10. Do not output explanations.  # 不要输出解释性文字。
11. Every array item must include all required fields.  # 数组中的每个对象必须包含所有必需字段。
12. If you cannot fill all required fields for an item, omit that item.  # 字段填不完整时，直接省略该对象。

# 返回结果的顶层 JSON 结构。
Return exactly this top-level JSON shape:
{
  "story_title": "...",
  "range": {
    "startIndex": 0,
    "endIndex": 0
  },
  "characters": [],
  "events": [],
  "relations": []
}

# 角色对象结构：表示文本中出现的人物。
Character item shape:
{
  "id": "c1",
  "name": "德拉",
  "aliases": [],
  "description": "explicit description from the provided text",
  "evidence": "exact evidence copied from the provided text",
  "confidence": 0.8
}

# 事件对象结构：表示文本中发生的动作、对话、情绪、物品变化等。
Event item shape:
{
  "id": "e1",
  "order": 1,
  "text_span": "exact event span copied from the provided text",
  "summary": "short event summary",
  "characters": ["c1"],
  "event_type": "action",
  "evidence": "exact evidence copied from the provided text",
  "confidence": 0.8
}

# 关系对象结构：表示两个角色之间的关系。
Relation item shape:
{
  "id": "r1",
  "source": "c1",
  "target": "c2",
  "relation_type": "spouse",
  "description": "relationship description from the provided text",
  "evidence": "exact evidence copied from the provided text",
  "confidence": 0.8
}

# event_type 只能从以下枚举值中选择。
Allowed event_type values:
action, dialogue, description, relationship, movement, object, emotion, other.

# relation_type 只能从以下枚举值中选择。
Allowed relation_type values:
spouse, family, friend, conflict, acquaintance, unknown, other.

Important reference rule:
- Use character ids, not character names, in event.characters, relation.source, and relation.target.  # 事件和关系中引用角色时，必须使用角色 id，而不是角色名字。
"""


# 构造用户提示词：把当前阅读片段、标题和文本范围传给 LLM。
# request 来自前端或接口请求，包含 story_title、text、startIndex、endIndex。
def build_user_prompt(request: NarrativeJSONRequest) -> str:
    return f"""Extract Narrative JSON from the current reading range.

Story title:
{request.story_title}

Range:
startIndex={request.startIndex}
endIndex={request.endIndex}

Text:
{request.text}

Remember:
- Use only this text.  # 只能使用上方 Text 中的内容。
- Preserve the story_title and range values exactly.  # 原样保留标题和阅读范围。
- Every item must include evidence from the text.  # 每个对象都必须有原文证据。
- Every character must include id, name, aliases, description, evidence, confidence.  # 每个角色必须包含完整字段。
- Every event must include id, order, text_span, summary, characters, event_type, evidence, confidence.  # 每个事件必须包含完整字段。
- Every relation must include id, source, target, relation_type, description, evidence, confidence.  # 每个关系必须包含完整字段。
- Use character ids, not character names, in event.characters, relation.source, and relation.target.  # 事件和关系中引用角色时使用角色 id。
- If a character, event, or relation cannot be represented with all required fields, omit it.  # 字段不完整就省略该对象。
- Output strict JSON only.  # 只输出严格 JSON。
"""


# 构造 JSON 修复提示词：当 LLM 上一次输出不是合法 JSON 时使用。
# 这个阶段只修复格式，不应该新增事实或重新发挥内容。
def build_json_repair_prompt(raw_output: str) -> str:
    return f"""The previous output was not valid JSON.

Convert it into strict JSON matching the required Narrative JSON schema.  # 转换为符合 Narrative JSON schema 的严格 JSON。
Do not add markdown or explanations.  # 不要添加 Markdown 或解释。
Do not add facts not present in the previous output.  # 不要添加前一次输出中不存在的新事实。
Every character must include id, name, aliases, description, evidence, confidence.  # 每个角色必须包含完整字段。
Every event must include id, order, text_span, summary, characters, event_type, evidence, confidence.  # 每个事件必须包含完整字段。
Every relation must include id, source, target, relation_type, description, evidence, confidence.  # 每个关系必须包含完整字段。
Use character ids, not character names, in event.characters, relation.source, and relation.target.  # 事件和关系中引用角色时使用角色 id。
If an item is incomplete, remove that item instead of returning a partial object.  # 如果对象字段不完整，删除该对象。

Previous output:
{raw_output}"""
