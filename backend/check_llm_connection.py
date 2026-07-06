"""Diagnostic script for MiMo/OpenAI-compatible HTTP connectivity.

Run from the backend/ directory:
    cd backend && .venv/bin/python check_llm_connection.py

The script never prints the full API key.
"""
from __future__ import annotations

import os
import socket
import subprocess
import sys
import tempfile
from urllib.parse import urlparse

from dotenv import load_dotenv


REQUEST_TIMEOUT_SECONDS = 60
PREVIEW_CHARS = 500


def _safe_key_prefix(api_key: str) -> str:
    if not api_key:
        return "(empty)"
    return f"{api_key[:6]}..."


def _label(ok: bool) -> str:
    return "OK" if ok else "FAIL"


def _print_response(label: str, status_code: int, text: str) -> bool:
    ok = 200 <= status_code < 300
    print()
    print(f"--- {label} ---")
    print(f"  status_code      : {status_code}")
    print(f"  response preview : {text[:PREVIEW_CHARS]}")
    print(f"  result           : {_label(ok)}")
    return ok


def _run_curl_request(url: str, method: str, api_key: str, payload: str | None = None):
    payload_file_path = ""
    config_file_path = ""
    try:
        if payload is not None:
            with tempfile.NamedTemporaryFile(
                mode="w",
                encoding="utf-8",
                delete=False,
            ) as payload_file:
                payload_file.write(payload)
                payload_file_path = payload_file.name

        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            delete=False,
        ) as config_file:
            config_file.write(f'url = "{url}"\n')
            config_file.write(f'request = "{method}"\n')
            config_file.write(f'header = "Authorization: Bearer {api_key}"\n')
            config_file.write('header = "Content-Type: application/json"\n')
            if payload_file_path:
                config_file.write(f"data = @{payload_file_path}\n")
            config_file.write("silent\n")
            config_file.write("show-error\n")
            config_file.write("http2\n")
            config_file.write(f"max-time = {REQUEST_TIMEOUT_SECONDS}\n")
            config_file_path = config_file.name

        completed = subprocess.run(
            ["curl", "--config", config_file_path, "-w", "\n%{http_code}"],
            capture_output=True,
            text=True,
            timeout=REQUEST_TIMEOUT_SECONDS + 5,
        )
        if completed.returncode != 0:
            return None, None, completed.stderr

        body, separator, status_text = completed.stdout.rpartition("\n")
        if not separator:
            return None, None, "curl output did not include status code"
        return body, int(status_text.strip()), completed.stderr
    finally:
        for path in (payload_file_path, config_file_path):
            if not path:
                continue
            try:
                os.unlink(path)
            except OSError:
                pass


print("=" * 60)
print("1. Python environment")
print("=" * 60)
print(f"sys.executable   : {sys.executable}")
print(f"sys.version      : {sys.version.split()[0]}")

try:
    import requests

    print(f"requests version : {requests.__version__}")
except ImportError:
    print("requests version : NOT INSTALLED")
    raise

try:
    import httpx

    _httpx_available = True
    print(f"httpx version    : {httpx.__version__}")
except ImportError:
    _httpx_available = False
    print("httpx version    : NOT INSTALLED (optional)")

print()
print("=" * 60)
print("2. .env loading")
print("=" * 60)

backend_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(backend_dir, ".env")
print(f".env path        : {env_path}")
print(f".env exists      : {os.path.isfile(env_path)}")
load_dotenv(env_path, override=True)

api_key = os.getenv("LLM_API_KEY", "")
base_url = os.getenv("LLM_BASE_URL", "").rstrip("/")
model = os.getenv("LLM_MODEL", "")

print(f"LLM_API_KEY exists : {bool(api_key)}")
print(f"LLM_API_KEY prefix : {_safe_key_prefix(api_key)}")
print(f"LLM_BASE_URL       : {base_url}")
print(f"LLM_MODEL          : {model}")

print()
print("=" * 60)
print("3. DNS resolution")
print("=" * 60)

if base_url:
    hostname = urlparse(base_url).hostname or ""
    print(f"hostname         : {hostname}")
    try:
        addrs = socket.getaddrinfo(hostname, 443)
        unique_ips = sorted({addr[4][0] for addr in addrs})
        print(f"resolved IPs     : {', '.join(unique_ips)}")
        print("DNS              : OK")
    except Exception as exc:
        print(f"DNS              : FAIL — {type(exc).__name__}: {exc}")
else:
    print("LLM_BASE_URL is empty, skipping DNS.")

models_url = f"{base_url}/models" if base_url else ""
chat_url = f"{base_url}/chat/completions" if base_url else ""
headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json",
}

print()
print("=" * 60)
print("4. requests GET /models")
print("=" * 60)

requests_models_ok = False
if api_key and base_url:
    try:
        response = requests.get(
            models_url,
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        requests_models_ok = _print_response(
            "requests /models",
            response.status_code,
            response.text,
        )
    except requests.exceptions.Timeout as exc:
        print(f"requests /models : FAIL — Timeout: {exc}")
    except requests.exceptions.ConnectionError as exc:
        print(f"requests /models : FAIL — ConnectionError: {exc}")
    except requests.exceptions.RequestException as exc:
        print(f"requests /models : FAIL — {type(exc).__name__}: {exc}")
else:
    print("Skipping — LLM_API_KEY or LLM_BASE_URL missing.")

print()
print("=" * 60)
print("5. requests POST /chat/completions")
print("=" * 60)

requests_chat_ok = False
if api_key and base_url and model:
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": "只回复 OK"}],
        "temperature": 0.2,
        "max_tokens": 20,
    }
    try:
        response = requests.post(
            chat_url,
            headers=headers,
            json=payload,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        requests_chat_ok = _print_response(
            "requests /chat/completions",
            response.status_code,
            response.text,
        )
        if requests_chat_ok:
            data = response.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content")
            print(f"  content preview  : {content!r}")
    except requests.exceptions.Timeout as exc:
        print(f"requests chat     : FAIL — Timeout: {exc}")
    except requests.exceptions.ConnectionError as exc:
        print(f"requests chat     : FAIL — ConnectionError: {exc}")
    except requests.exceptions.RequestException as exc:
        print(f"requests chat     : FAIL — {type(exc).__name__}: {exc}")
    except ValueError as exc:
        print(f"requests chat     : FAIL — invalid JSON response: {exc}")
else:
    print("Skipping — LLM_API_KEY, LLM_BASE_URL, or LLM_MODEL missing.")

print()
print("=" * 60)
print("6. curl GET /models fallback diagnostic")
print("=" * 60)

curl_models_ok = False
if api_key and base_url:
    body, status_code, stderr = _run_curl_request(models_url, "GET", api_key)
    if status_code is None:
        print(f"curl /models     : FAIL — {stderr[:PREVIEW_CHARS]}")
    else:
        curl_models_ok = _print_response("curl /models", status_code, body or "")
else:
    print("Skipping — LLM_API_KEY or LLM_BASE_URL missing.")

print()
print("=" * 60)
print("7. curl POST /chat/completions fallback diagnostic")
print("=" * 60)

curl_chat_ok = False
if api_key and base_url and model:
    import json

    payload = json.dumps(
        {
            "model": model,
            "messages": [{"role": "user", "content": "只回复 OK"}],
            "temperature": 0.2,
            "max_tokens": 20,
        },
        ensure_ascii=False,
    )
    body, status_code, stderr = _run_curl_request(chat_url, "POST", api_key, payload)
    if status_code is None:
        print(f"curl chat        : FAIL — {stderr[:PREVIEW_CHARS]}")
    else:
        curl_chat_ok = _print_response("curl /chat/completions", status_code, body or "")
else:
    print("Skipping — LLM_API_KEY, LLM_BASE_URL, or LLM_MODEL missing.")

print()
print("=" * 60)
print("8. optional httpx GET /models diagnostic")
print("=" * 60)

httpx_models_ok = False
if _httpx_available and api_key and base_url:
    try:
        response = httpx.get(
            models_url,
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        httpx_models_ok = _print_response(
            "optional httpx /models",
            response.status_code,
            response.text,
        )
    except Exception as exc:
        print(f"optional httpx    : FAIL — {type(exc).__name__}: {exc}")
elif not _httpx_available:
    print("Skipping — httpx is not installed.")
else:
    print("Skipping — LLM_API_KEY or LLM_BASE_URL missing.")

print()
print("=" * 60)
print("DIAGNOSTIC COMPLETE")
print("=" * 60)
print(f"  requests /models : {_label(requests_models_ok)}")
print(f"  requests chat    : {_label(requests_chat_ok)}")
print(f"  curl /models     : {_label(curl_models_ok)}")
print(f"  curl chat        : {_label(curl_chat_ok)}")
print(f"  optional httpx   : {_label(httpx_models_ok)}")
