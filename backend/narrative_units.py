from __future__ import annotations

import re
from typing import Any

from parser import NarrativeParser


class NarrativeUnitBuilder:
    """Builds sentence-level narrative units without event inference."""

    SENTENCE_SPLIT_PATTERN = re.compile(r"[^。！？；\n]+[。！？；]?")

    def __init__(self, parser: NarrativeParser):
        self.parser = parser

    def build(
        self,
        text: str,
        story_title: str,
        start_index: int,
        end_index: int,
    ) -> dict[str, Any]:
        sentences = self._split_sentences(text)
        sentence_units: list[dict[str, Any]] = []
        entity_mentions: list[dict[str, Any]] = []
        parsed_sentence_count = 0

        for index, sentence in enumerate(sentences, start=1):
            sentence_id = f"s{index}"
            cleaned_text = self._clean_for_hanlp(sentence)
            parsed = self._safe_parse(cleaned_text)
            parse_status = "failed" if parsed.get("parse_error") else "ok"
            if parse_status == "ok":
                parsed_sentence_count += 1
            sentence_units.append(
                {
                    "id": sentence_id,
                    "text": sentence,
                    "cleaned_text": cleaned_text,
                    "tokens": parsed["tokens"],
                    "pos": parsed["pos"],
                    "entities": parsed["entities"],
                    "dependency": parsed["dependency"],
                    "semantic_roles": parsed["semantic_roles"],
                    "parse_status": parse_status,
                    "parse_error": parsed.get("parse_error"),
                }
            )
            entity_mentions.extend(self._entity_mentions(parsed["entities"], sentence_id))

        sentence_count = len(sentence_units)

        return {
            "story_title": story_title,
            "range": {
                "startIndex": start_index,
                "endIndex": end_index,
            },
            "sentence_count": sentence_count,
            "parsed_sentence_count": parsed_sentence_count,
            "failed_sentence_count": sentence_count - parsed_sentence_count,
            "sentences": sentence_units,
            "entity_mentions": entity_mentions,
        }

    def _safe_parse(self, sentence: str) -> dict[str, Any]:
        try:
            return self.parser.parse(sentence)
        except Exception:
            return {
                "tokens": [],
                "pos": [],
                "entities": [],
                "dependency": [],
                "semantic_roles": [],
                "parse_error": "HanLP sentence parsing failed",
            }

    def _clean_for_hanlp(self, sentence: str) -> str:
        return (
            sentence.replace("——", "，")
            .replace("“", "")
            .replace("”", "")
            .replace("‘", "")
            .replace("’", "")
            .strip()
        )

    def _split_sentences(self, text: str) -> list[str]:
        normalized = text.strip()
        if not normalized:
            return []

        return [
            match.group(0).strip()
            for match in self.SENTENCE_SPLIT_PATTERN.finditer(normalized)
            if match.group(0).strip()
        ]

    def _entity_mentions(
        self,
        entities: list[dict[str, Any]],
        sentence_id: str,
    ) -> list[dict[str, Any]]:
        mentions: list[dict[str, Any]] = []

        for entity in entities:
            mentions.append(
                {
                    "text": entity.get("text", ""),
                    "type": entity.get("type", ""),
                    "sentence_id": sentence_id,
                    "start": entity.get("start"),
                    "end": entity.get("end"),
                }
            )

        return mentions
