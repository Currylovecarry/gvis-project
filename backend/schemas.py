from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


Confidence = float


class TextRange(BaseModel):
    startIndex: int
    endIndex: int


class Character(BaseModel):
    id: str
    name: str
    aliases: list[str] = Field(default_factory=list)
    description: str
    evidence: str
    confidence: Confidence = Field(ge=0.0, le=1.0)


class Event(BaseModel):
    id: str
    order: int
    text_span: str
    summary: str
    characters: list[str] = Field(default_factory=list)
    event_type: Literal[
        "action",
        "dialogue",
        "description",
        "relationship",
        "movement",
        "object",
        "emotion",
        "other",
    ]
    evidence: str
    confidence: Confidence = Field(ge=0.0, le=1.0)


class Relation(BaseModel):
    id: str
    source: str
    target: str
    relation_type: Literal[
        "spouse",
        "family",
        "friend",
        "conflict",
        "acquaintance",
        "unknown",
        "other",
    ]
    description: str
    evidence: str
    confidence: Confidence = Field(ge=0.0, le=1.0)


class NarrativeJSON(BaseModel):
    story_title: str
    range: TextRange
    characters: list[Character] = Field(default_factory=list)
    events: list[Event] = Field(default_factory=list)
    relations: list[Relation] = Field(default_factory=list)


class NarrativeJSONRequest(BaseModel):
    story_title: str
    text: str
    startIndex: int
    endIndex: int
