from __future__ import annotations

from typing import Any

from hanlp_restful import HanLPClient


class NarrativeParser:
    """Thin HanLP adapter for first-stage narrative NLP parsing."""

    TASKS = ["tok", "pos", "ner", "dep", "srl"]

    def __init__(self, auth: str):
        self.auth = auth

    def parse(self, text: str) -> dict[str, Any]:
        client = HanLPClient(
            "https://www.hanlp.com/api",
            auth=self.auth,
            language="zh",
        )
        result = client.parse(text, tasks=self.TASKS)

        tokens = self._get_task(result, "tok") or []
        pos_tags = self._get_task(result, "pos") or []
        entities = self._get_task(result, "ner") or []
        dependency = self._get_task(result, "dep") or []
        semantic_roles = self._get_task(result, "srl") or []

        flat_tokens = self._flatten_tokens(tokens)

        return {
            "tokens": flat_tokens,
            "pos": self._format_pos(flat_tokens, pos_tags),
            "entities": self._format_entities(entities),
            "dependency": dependency,
            "semantic_roles": semantic_roles,
        }

    def _get_task(self, result: dict[str, Any], task: str) -> Any:
        if task in result:
            return result[task]

        # HanLP may return model-qualified keys such as tok/fine or pos/ctb.
        for key, value in result.items():
            if key == task or key.startswith(f"{task}/"):
                return value

        return None

    def _flatten_tokens(self, tokens: Any) -> list[str]:
        if not isinstance(tokens, list):
            return []

        if tokens and all(isinstance(sentence, list) for sentence in tokens):
            return [
                str(token)
                for sentence in tokens
                for token in sentence
            ]

        return [str(token) for token in tokens]

    def _format_pos(self, tokens: list[str], pos_tags: Any) -> list[list[str]]:
        tags = self._flatten_tags(pos_tags)
        return [[token, str(tag)] for token, tag in zip(tokens, tags)]

    def _flatten_tags(self, tags: Any) -> list[Any]:
        if not isinstance(tags, list):
            return []

        if tags and all(isinstance(sentence, list) for sentence in tags):
            return [
                tag
                for sentence in tags
                for tag in sentence
            ]

        return tags

    def _format_entities(self, entities: Any) -> list[dict[str, Any]]:
        if not isinstance(entities, list):
            return []

        formatted: list[dict[str, Any]] = []
        if entities and all(isinstance(sentence, list) for sentence in entities):
            entities = [
                entity
                for sentence in entities
                for entity in sentence
            ]

        for entity in entities:
            if isinstance(entity, dict):
                formatted.append(entity)
                continue

            if isinstance(entity, (list, tuple)):
                formatted.append(self._format_entity_sequence(entity))

        return formatted

    def _format_entity_sequence(self, entity: list[Any] | tuple[Any, ...]) -> dict[str, Any]:
        formatted: dict[str, Any] = {}

        if len(entity) > 0:
            formatted["text"] = entity[0]
        if len(entity) > 1:
            formatted["type"] = entity[1]
        if len(entity) > 2:
            formatted["start"] = entity[2]
        if len(entity) > 3:
            formatted["end"] = entity[3]
        if len(entity) > 4:
            formatted["raw"] = list(entity)

        return formatted
