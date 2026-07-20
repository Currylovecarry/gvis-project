from __future__ import annotations

import json
import logging
import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from errors import (
    NarrativeBaseError,
    NarrativeSchemaValidationError,
)
from llm_client import LLMClient, LLMConfig
from narrative_extractor import NarrativeExtractor
from schemas import ExperimentLog, NarrativeJSONRequest

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger(__name__)

load_dotenv()

backend_dir = Path(__file__).resolve().parent
experiment_log_dir = Path(
    os.getenv("EXPERIMENT_LOG_DIR", backend_dir / "data" / "experiment-logs")
)

allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://gvis-project.vercel.app",
]
configured_origins = os.getenv("CORS_ALLOW_ORIGINS", "")
if configured_origins:
    allowed_origins.extend(
        origin.strip() for origin in configured_origins.split(",") if origin.strip()
    )

app = FastAPI(title="LLM Narrative JSON API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["POST"],
    allow_headers=["Content-Type"],
)


# ---------------------------------------------------------------------------
# Structured error responses
# ---------------------------------------------------------------------------


@app.exception_handler(NarrativeBaseError)
async def narrative_error_handler(
    request: Request, exc: NarrativeBaseError
) -> JSONResponse:
    """Convert any NarrativeBaseError subclass into a structured JSON body."""
    body: dict = {
        "code": exc.code,
        "message": exc.message,
    }
    if isinstance(exc, NarrativeSchemaValidationError) and exc.validation_errors:
        body["errors"] = exc.validation_errors

    logger.error(
        "NarrativeError %s — code=%s message=%s extra=%s",
        type(exc).__name__,
        exc.code,
        exc.message,
        getattr(exc, "extra", {}),
    )
    return JSONResponse(status_code=500, content={"detail": body})


# ---------------------------------------------------------------------------
# Extractor singleton
# ---------------------------------------------------------------------------


@lru_cache
def get_extractor() -> NarrativeExtractor:
    config = LLMConfig.from_env()
    return NarrativeExtractor(llm_client=LLMClient(config=config))


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------


@app.post("/narrative-json")
def extract_narrative_json(request: NarrativeJSONRequest) -> dict:
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="text must not be empty")

    logger.info(
        "POST /narrative-json — story_title=%r text_len=%d range=[%d, %d] "
        "text_preview=%r",
        request.story_title,
        len(request.text),
        request.startIndex,
        request.endIndex,
        request.text[:200],
    )

    try:
        narrative_json = get_extractor().extract(request)
    except NarrativeBaseError:
        # Already typed — let the exception handler format it
        raise
    except ValidationError as exc:
        structured = exc.errors()
        logger.exception(
            "Unhandled Pydantic validation error during narrative extraction — "
            "%d error(s): %s",
            len(structured),
            structured,
        )
        raise NarrativeSchemaValidationError(validation_errors=structured) from exc
    except Exception as exc:
        logger.exception(
            "Unhandled exception during narrative extraction — type=%s",
            type(exc).__name__,
        )
        raise NarrativeBaseError() from exc

    return narrative_json.model_dump()


@app.post("/experiment-logs")
def save_experiment_log(request: ExperimentLog) -> dict:
    experiment_log_dir.mkdir(parents=True, exist_ok=True)
    target = experiment_log_dir / f"{request.sessionId}.json"
    temporary = experiment_log_dir / f".{request.sessionId}.tmp"
    payload = request.model_dump(mode="json", exclude_none=True)
    temporary.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    temporary.replace(target)

    logger.info(
        "POST /experiment-logs — participant_id=%r session_id=%s book=%r "
        "duration_ms=%d low_calls=%d medium_calls=%d event_map_expands=%d "
        "character_graph_expands=%d status=%s",
        request.participantId,
        request.sessionId,
        request.book.title,
        request.readingDurationMs,
        request.assistance.low.callCount,
        request.assistance.medium.callCount,
        request.visualizationDetails.eventMapExpandCount,
        request.visualizationDetails.characterGraphExpandCount,
        request.completionStatus,
    )
    return {"saved": True, "sessionId": str(request.sessionId)}
