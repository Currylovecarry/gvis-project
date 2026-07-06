from __future__ import annotations

from schemas import NarrativeJSONRequest


SYSTEM_PROMPT = """You extract structured narrative data from fiction excerpts.

Core rules:
1. Use only the text provided by the user.
2. Do not guess future plot.
3. Do not spoil anything beyond the provided reading range.
4. Do not add information outside the text.
5. Every character, event, and relation must include evidence copied from the provided text.
6. Evidence must be an exact phrase or sentence from the provided text.
7. If information is unclear, omit it or set confidence low.
8. Output strict JSON only.
9. Do not output markdown.
10. Do not output explanations.
11. Every array item must include all required fields.
12. If you cannot fill all required fields for an item, omit that item.

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

Character item shape:
{
  "id": "c1",
  "name": "德拉",
  "aliases": [],
  "description": "explicit description from the provided text",
  "evidence": "exact evidence copied from the provided text",
  "confidence": 0.8
}

Event item shape:
{
  "id": "e1",
  "order": 1,
  "text_span": "exact event span copied from the provided text",
  "summary": "short event summary",
  "characters": ["德拉"],
  "event_type": "action",
  "evidence": "exact evidence copied from the provided text",
  "confidence": 0.8
}

Relation item shape:
{
  "id": "r1",
  "source": "德拉",
  "target": "吉姆",
  "relation_type": "spouse",
  "description": "relationship description from the provided text",
  "evidence": "exact evidence copied from the provided text",
  "confidence": 0.8
}

Allowed event_type values:
action, dialogue, description, relationship, movement, object, emotion, other.

Allowed relation_type values:
spouse, family, friend, conflict, acquaintance, unknown, other.
"""


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
- Use only this text.
- Preserve the story_title and range values exactly.
- Every item must include evidence from the text.
- Every character must include id, name, aliases, description, evidence, confidence.
- Every event must include id, order, text_span, summary, characters, event_type, evidence, confidence.
- Every relation must include id, source, target, relation_type, description, evidence, confidence.
- If a character, event, or relation cannot be represented with all required fields, omit it.
- Output strict JSON only."""


def build_json_repair_prompt(raw_output: str) -> str:
    return f"""The previous output was not valid JSON.

Convert it into strict JSON matching the required Narrative JSON schema.
Do not add markdown or explanations.
Do not add facts not present in the previous output.
Every character must include id, name, aliases, description, evidence, confidence.
Every event must include id, order, text_span, summary, characters, event_type, evidence, confidence.
Every relation must include id, source, target, relation_type, description, evidence, confidence.
If an item is incomplete, remove that item instead of returning a partial object.

Previous output:
{raw_output}"""
