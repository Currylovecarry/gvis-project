from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

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
    description: str
    location: str = "Unspecified"
    characters: list[str] = Field(default_factory=list)
    character_importance: dict[str, float] = Field(default_factory=dict)
    importance: Literal["high", "medium", "low"]
    evidence: str


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


class ExperimentBook(BaseModel):
    id: str
    title: str
    format: str


class ExperimentEvent(BaseModel):
    type: Literal[
        "session_started",
        "mode_selected",
        "assistance_called",
        "visualization_detail_opened",
        "session_ended",
    ]
    timestamp: datetime
    elapsedMs: int = Field(ge=0)
    activeReadingMs: int = Field(ge=0)
    progress: float = Field(ge=0.0, le=1.0)
    mode: Literal["zero", "low", "medium", "high"] | None = None
    trigger: Literal["manual", "automatic"] | None = None
    visualizationDetail: Literal["event_map", "character_graph"] | None = None


class LowAssistanceSummary(BaseModel):
    used: bool
    callCount: int = Field(ge=0)


class MediumAssistanceSummary(LowAssistanceSummary):
    manualCallCount: int = Field(ge=0)
    automaticCallCount: int = Field(ge=0)


class ExperimentAssistanceSummary(BaseModel):
    low: LowAssistanceSummary
    medium: MediumAssistanceSummary


class ExperimentVisualizationDetailsSummary(BaseModel):
    eventMapExpandCount: int = Field(default=0, ge=0)
    characterGraphExpandCount: int = Field(default=0, ge=0)


class ExperimentLog(BaseModel):
    schemaVersion: Literal[1, 2]
    sessionId: UUID
    participantId: str = Field(min_length=1, max_length=64)
    book: ExperimentBook
    startedAt: datetime
    endedAt: datetime
    completionStatus: Literal["completed", "abandoned"]
    readingDurationMs: int = Field(ge=0)
    readingDurationSeconds: float = Field(ge=0.0)
    elapsedDurationMs: int = Field(ge=0)
    initialProgress: float = Field(ge=0.0, le=1.0)
    finalProgress: float = Field(ge=0.0, le=1.0)
    assistance: ExperimentAssistanceSummary
    visualizationDetails: ExperimentVisualizationDetailsSummary = Field(
        default_factory=ExperimentVisualizationDetailsSummary
    )
    events: list[ExperimentEvent] = Field(default_factory=list)
