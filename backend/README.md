# LLM Narrative JSON Backend

FastAPI backend for extracting standard Narrative JSON from the current reading range with an OpenAI-compatible LLM API.

Current stage:

- Takes the current story title and current reading-range text.
- Calls an OpenAI-compatible LLM endpoint with direct `requests` HTTP calls.
- Falls back to local `curl` when Python TLS fails against the provider endpoint.
- Returns structured `characters`, `events`, and `relations`.

This stage is only LLM Narrative JSON extraction. It is not formal visualization, and it does not generate character graphs, timelines, event-stream charts, D3/ECharts views, or summaries.

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
LLM_API_KEY=your_api_key_here
LLM_BASE_URL=https://your-openai-compatible-endpoint/v1
LLM_MODEL=your-model-name
LLM_MAX_TOKENS=131072
LLM_REQUEST_TIMEOUT_SECONDS=300
```

Do not commit `.env`.

## Environment Variables

- `LLM_API_KEY`: API key for the OpenAI-compatible provider.
- `LLM_BASE_URL`: Base URL for the provider, including `/v1`.
- `LLM_MODEL`: Model name to use, such as a MiMo/OpenAI-compatible model name.
- `LLM_MAX_TOKENS`: Provider-specific maximum output token budget for one extraction request. Defaults to `131072`, the observed maximum accepted by `mimo-v2.5-pro`. MiMo token accounting is much larger than standard OpenAI-style token accounting.
- `LLM_REQUEST_TIMEOUT_SECONDS`: Request timeout for `requests` and the `curl` fallback. Defaults to `300`.
- `EXPERIMENT_LOG_DIR`: Directory used for completed experiment JSON files. Defaults to `backend/data/experiment-logs`.
- `CORS_ALLOW_ORIGINS`: Optional comma-separated frontend origins in addition to localhost and `https://gvis-project.vercel.app`.

The backend does not depend on the OpenAI Python SDK. It first sends:

- `GET {LLM_BASE_URL}/models` in the optional diagnostic script.
- `POST {LLM_BASE_URL}/chat/completions` from the API service.

If Python `requests` fails with a connection/TLS error but system `curl` works,
the API service retries the chat request through a local `curl` fallback. The
fallback still reads credentials from `.env` and does not log the full API key.

## Start

```bash
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

## Test `/narrative-json`

```bash
curl -X POST http://localhost:8000/narrative-json \
  -H "Content-Type: application/json" \
  -d '{
    "story_title":"麦琪的礼物",
    "text":"德拉数了数钱，只有一块八角七分钱。",
    "startIndex":0,
    "endIndex":24
  }'
```

Response shape:

```json
{
  "story_title": "麦琪的礼物",
  "range": {
    "startIndex": 0,
    "endIndex": 24
  },
  "characters": [],
  "events": [],
  "relations": []
}
```

You can also run the local smoke test script after starting the backend:

```bash
python test_narrative_json.py
```

The script loads `.env`, verifies that `LLM_API_KEY`, `LLM_BASE_URL`, and `LLM_MODEL` are configured, calls `http://localhost:8000/narrative-json`, and prints the returned JSON. It does not contain or print any API key.

## Experiment logs

The reader posts each completed or abandoned reading session to:

```text
POST /experiment-logs
```

Each session is saved as a separate valid JSON file:

```text
backend/data/experiment-logs/<sessionId>.json
```

The file includes the participant ID, book metadata, active reading duration,
elapsed duration, initial/final progress, Low usage and call count, Medium total,
manual and automatic call counts, event-map and character-graph detail expansion
counts, plus timestamped mode, assistance, and visualization-detail events.
Files in this directory are ignored by Git.

For a hosted frontend, set `VITE_EXPERIMENT_LOG_API_URL` to the public base URL
of this FastAPI service. If the upload fails, the browser still retains a local
archive and offers the participant a JSON download at the end of the session.

To test provider connectivity directly without starting FastAPI:

```bash
python check_llm_connection.py
```

This checks `.env`, DNS, `requests /models`, minimal `requests /chat/completions`,
and matching `curl` fallback calls. It never prints the full API key.

## Notes

- The extractor only uses the provided reading range.
- It should not guess future plot or add information outside the text.
- Every returned character, event, and relation should include evidence from the provided text.
- If the LLM returns invalid JSON, the backend attempts one repair request. If repair still fails, it returns `500` with `LLM returned invalid JSON`.
