from __future__ import annotations

import json
import logging
import re

from pydantic import ValidationError

from llm_client import LLMClient
from prompts import SYSTEM_PROMPT, build_json_repair_prompt, build_user_prompt
from schemas import NarrativeJSON, NarrativeJSONRequest
from errors import (
    InvalidNarrativeJSONError,
    NarrativeSchemaValidationError,
)

logger = logging.getLogger(__name__)


class NarrativeExtractor:
    def __init__(self, llm_client: LLMClient):
        self.llm_client = llm_client

    def extract(self, request: NarrativeJSONRequest) -> NarrativeJSON:
        logger.info(
            "Extracting narrative — story_title=%r text_len=%d range=[%d, %d] "
            "text_preview=%r",
            request.story_title,
            len(request.text),
            request.startIndex,
            request.endIndex,
            request.text[:200],
        )

        raw_output = self.llm_client.complete_json(
            system_prompt=SYSTEM_PROMPT,
            user_prompt=build_user_prompt(request),
        )

        try:
            return self._parse_and_normalize(raw_output, request)
        except (InvalidNarrativeJSONError, NarrativeSchemaValidationError) as exc:
            logger.warning(
                "First parse failed (%s), attempting repair. "
                "code=%s message=%s LLM output preview (first 500 chars): %s",
                type(exc).__name__,
                exc.code,
                exc.message,
                raw_output[:500],
            )
            repair_output = self.llm_client.complete_text(
                system_prompt=SYSTEM_PROMPT,
                user_prompt=build_json_repair_prompt(raw_output),
            )
            return self._parse_and_normalize(repair_output, request)

    # ------------------------------------------------------------------

    def _parse_and_normalize(
        self,
        raw_output: str,
        request: NarrativeJSONRequest,
    ) -> NarrativeJSON:
        data = self._loads_json(raw_output)
        data["story_title"] = request.story_title
        data["range"] = {
            "startIndex": request.startIndex,
            "endIndex": request.endIndex,
        }
        data.setdefault("characters", [])
        data.setdefault("events", [])
        data.setdefault("relations", [])

        try:
            return NarrativeJSON.model_validate(data)
        except ValidationError as exc:
            structured = exc.errors()
            logger.warning(
                "Pydantic validation failed — %d error(s): %s",
                len(structured),
                structured,
            )
            raise NarrativeSchemaValidationError(
                f"Schema validation failed: {len(structured)} error(s)",
                validation_errors=structured,
            ) from exc

    def _loads_json(self, raw_output: str) -> dict:
        cleaned = self._strip_markdown_fences(raw_output).strip()

        try:
            value = json.loads(cleaned)
        except json.JSONDecodeError as exc:
            logger.warning(
                "json.loads failed — error=%s output_preview=%s",
                exc,
                cleaned[:500],
            )
            extracted = self._extract_json_object(cleaned)
            if not extracted:
                raise InvalidNarrativeJSONError(
                    "LLM returned invalid JSON"
                ) from exc
            try:
                value = json.loads(self._remove_trailing_commas(extracted))
            except json.JSONDecodeError as exc2:
                logger.warning(
                    "json.loads failed after object extraction/trailing-comma repair — "
                    "error=%s output_preview=%s",
                    exc2,
                    extracted[:500],
                )
                raise InvalidNarrativeJSONError(
                    "LLM returned invalid JSON"
                ) from exc2

        if not isinstance(value, dict):
            raise InvalidNarrativeJSONError("LLM returned JSON that is not an object")
        return value

    @staticmethod
    def _strip_markdown_fences(text: str) -> str:
        stripped = text.strip()
        if stripped.startswith("```"):
            stripped = re.sub(r"^```(?:json)?\s*", "", stripped, flags=re.IGNORECASE)
            stripped = re.sub(r"\s*```$", "", stripped)
        return stripped

    @staticmethod
    def _extract_json_object(text: str) -> str | None:
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1 or end <= start:
            return None
        return text[start : end + 1]

    @staticmethod
    def _remove_trailing_commas(text: str) -> str:
        return re.sub(r",\s*([}\]])", r"\1", text)
