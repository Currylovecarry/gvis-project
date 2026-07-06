import os
from functools import lru_cache

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from narrative_units import NarrativeUnitBuilder
from parser import NarrativeParser


load_dotenv()

app = FastAPI(title="Narrative Parsing API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["POST"],
    allow_headers=["Content-Type"],
)


class ParseRequest(BaseModel):
    text: str


class NarrativeUnitsRequest(BaseModel):
    text: str
    story_title: str
    startIndex: int
    endIndex: int


@lru_cache
def get_parser() -> NarrativeParser:
    auth = os.getenv("HANLP_AUTH", "")
    return NarrativeParser(auth=auth)


@lru_cache
def get_narrative_unit_builder() -> NarrativeUnitBuilder:
    return NarrativeUnitBuilder(parser=get_parser())


@app.post("/parse")
def parse_text(request: ParseRequest) -> dict:
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="text must not be empty")

    try:
        return get_parser().parse(request.text)
    except Exception as exc:
        raise HTTPException(status_code=500, detail="HanLP parsing failed") from exc


@app.post("/narrative-units")
def build_narrative_units(request: NarrativeUnitsRequest) -> dict:
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="text must not be empty")

    try:
        return get_narrative_unit_builder().build(
            text=request.text,
            story_title=request.story_title,
            start_index=request.startIndex,
            end_index=request.endIndex,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="HanLP narrative unit parsing failed",
        ) from exc
