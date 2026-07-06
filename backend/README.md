# Narrative Parsing Backend

Independent FastAPI backend for first-stage Chinese narrative parsing with HanLP RESTful API.

This stage only performs basic NLP parsing:

- Tokenization
- Part-of-speech tagging
- Named entity recognition
- Dependency parsing
- Semantic role labeling

It does not implement AI inference, summaries, character graphs, event streams, timelines, climax detection, or visualization data.

## Install

```bash
cd backend
python -m venv .venv
source .venv/bin/activate

pip install -r requirements.txt
```

## Configure

Create a `.env` file:

```bash
HANLP_AUTH=your_hanlp_auth_here
```

## Start

```bash
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

## Test `/parse`

```bash
curl -X POST http://localhost:8000/parse \
  -H "Content-Type: application/json" \
  -d '{"text":"小明推开门，走进了教室。"}'
```

Response shape:

```json
{
  "tokens": [],
  "pos": [],
  "entities": [],
  "dependency": [],
  "semantic_roles": []
}
```

## Test `/narrative-units`

`/narrative-units` converts the current story reading range into sentence-level intermediate units for later event extraction or LLM workflows. This endpoint does not perform event extraction, relationship analysis, summarization, or LLM calls.

```bash
curl -X POST http://localhost:8000/narrative-units \
  -H "Content-Type: application/json" \
  -d '{
    "text": "归途\n\n小明推开门。他走进了教室。",
    "story_title": "归途",
    "startIndex": 1200,
    "endIndex": 4380
  }'
```

Response shape:

```json
{
  "story_title": "归途",
  "range": {
    "startIndex": 1200,
    "endIndex": 4380
  },
  "sentences": [
    {
      "id": "s1",
      "text": "...",
      "tokens": [],
      "pos": [],
      "entities": [],
      "dependency": [],
      "semantic_roles": []
    }
  ],
  "entity_mentions": []
}
```
