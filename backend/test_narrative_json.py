from __future__ import annotations

import json
import os
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from dotenv import load_dotenv


API_URL = "http://localhost:8000/narrative-json"


def ensure_llm_env() -> None:
    load_dotenv()
    missing = [
        name
        for name in ("LLM_API_KEY", "LLM_BASE_URL", "LLM_MODEL")
        if not os.getenv(name)
    ]
    if missing:
        raise RuntimeError(f"Missing environment variables: {', '.join(missing)}")


def main() -> None:
    ensure_llm_env()

    payload = {
        "story_title": "麦琪的礼物",
        "text": "德拉数了数钱，只有一块八角七分钱。",
        "startIndex": 0,
        "endIndex": 24,
    }
    request = Request(
        API_URL,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urlopen(request, timeout=120) as response:
            body = response.read().decode("utf-8")
    except HTTPError as error:
        body = error.read().decode("utf-8")
        raise RuntimeError(f"Request failed with HTTP {error.code}: {body}") from error
    except URLError as error:
        raise RuntimeError("Could not connect to http://localhost:8000") from error

    print(json.dumps(json.loads(body), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
