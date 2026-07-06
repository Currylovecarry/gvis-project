from __future__ import annotations

import logging
import os
import subprocess
import tempfile
from dataclasses import dataclass
from typing import Any

import requests

from errors import (
    LLMAPIAuthError,
    LLMAPIConnectionError,
    LLMAPIEndpointOrModelNotFoundError,
    LLMAPIRequestError,
    LLMAPITimeoutError,
    LLMConfigurationError,
    LLMEmptyContentError,
    LLMResponseFormatError,
)

logger = logging.getLogger(__name__)

DEFAULT_REQUEST_TIMEOUT_SECONDS = 300
RESPONSE_PREVIEW_CHARS = 500


@dataclass(frozen=True)
class LLMConfig:
    api_key: str
    base_url: str
    model: str
    max_tokens: int
    request_timeout_seconds: int

    @classmethod
    def from_env(cls) -> "LLMConfig":
        api_key = os.getenv("LLM_API_KEY", "")
        base_url = os.getenv("LLM_BASE_URL", "")
        model = os.getenv("LLM_MODEL", "")
        max_tokens_raw = os.getenv("LLM_MAX_TOKENS", "131072")
        timeout_raw = os.getenv(
            "LLM_REQUEST_TIMEOUT_SECONDS",
            str(DEFAULT_REQUEST_TIMEOUT_SECONDS),
        )

        missing = [
            name
            for name, value in {
                "LLM_API_KEY": api_key,
                "LLM_BASE_URL": base_url,
                "LLM_MODEL": model,
            }.items()
            if not value
        ]
        if missing:
            raise LLMConfigurationError(
                f"Missing LLM environment variables: {', '.join(missing)}"
            )

        try:
            max_tokens = int(max_tokens_raw)
        except ValueError as exc:
            raise LLMConfigurationError("LLM_MAX_TOKENS must be an integer") from exc
        if max_tokens <= 0:
            raise LLMConfigurationError("LLM_MAX_TOKENS must be greater than 0")
        try:
            request_timeout_seconds = int(timeout_raw)
        except ValueError as exc:
            raise LLMConfigurationError(
                "LLM_REQUEST_TIMEOUT_SECONDS must be an integer"
            ) from exc
        if request_timeout_seconds <= 0:
            raise LLMConfigurationError(
                "LLM_REQUEST_TIMEOUT_SECONDS must be greater than 0"
            )

        config = cls(
            api_key=api_key,
            base_url=base_url.rstrip("/"),
            model=model,
            max_tokens=max_tokens,
            request_timeout_seconds=request_timeout_seconds,
        )
        logger.info(
            "LLM config loaded — base_url=%s model=%s max_tokens=%d timeout=%ds "
            "key_exists=%s key_prefix=%s",
            config.base_url,
            config.model,
            config.max_tokens,
            config.request_timeout_seconds,
            bool(config.api_key),
            config.safe_key_prefix,
        )
        return config

    @property
    def chat_completions_url(self) -> str:
        return f"{self.base_url}/chat/completions"

    @property
    def models_url(self) -> str:
        return f"{self.base_url}/models"

    @property
    def safe_key_prefix(self) -> str:
        if not self.api_key:
            return "(empty)"
        return f"{self.api_key[:6]}..."


class LLMClient:
    def __init__(self, config: LLMConfig):
        self.config = config

    def complete_json(self, system_prompt: str, user_prompt: str) -> str:
        return self._complete(system_prompt, user_prompt)

    def complete_text(self, system_prompt: str, user_prompt: str) -> str:
        return self._complete(system_prompt, user_prompt)

    def _complete(self, system_prompt: str, user_prompt: str) -> str:
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        payload: dict[str, Any] = {
            "model": self.config.model,
            "messages": messages,
            "temperature": 0.2,
            "max_tokens": self.config.max_tokens,
        }

        logger.info(
            "LLM request — base_url=%s model=%s max_tokens=%d timeout=%ds key_exists=%s "
            "key_prefix=%s prompt_len=%d",
            self.config.base_url,
            self.config.model,
            self.config.max_tokens,
            self.config.request_timeout_seconds,
            bool(self.config.api_key),
            self.config.safe_key_prefix,
            len(user_prompt),
        )

        response = self._post_chat_completion(payload)
        return self._extract_content(response)

    def _post_chat_completion(self, payload: dict[str, Any]) -> requests.Response:
        headers = {
            "Authorization": f"Bearer {self.config.api_key}",
            "Content-Type": "application/json",
        }

        try:
            response = requests.post(
                self.config.chat_completions_url,
                headers=headers,
                json=payload,
                timeout=self.config.request_timeout_seconds,
            )
        except requests.exceptions.Timeout as exc:
            logger.error(
                "LLM request timed out — base_url=%s model=%s timeout=%ds "
                "key_exists=%s key_prefix=%s",
                self.config.base_url,
                self.config.model,
                self.config.request_timeout_seconds,
                bool(self.config.api_key),
                self.config.safe_key_prefix,
            )
            raise LLMAPITimeoutError() from exc
        except requests.exceptions.ConnectionError as exc:
            logger.error(
                "LLM requests connection failed, retrying with curl fallback — "
                "base_url=%s model=%s key_exists=%s key_prefix=%s",
                self.config.base_url,
                self.config.model,
                bool(self.config.api_key),
                self.config.safe_key_prefix,
            )
            return self._post_chat_completion_with_curl(payload, original_error=exc)
        except requests.exceptions.RequestException as exc:
            logger.error(
                "LLM request exception — base_url=%s model=%s key_exists=%s key_prefix=%s type=%s",
                self.config.base_url,
                self.config.model,
                bool(self.config.api_key),
                self.config.safe_key_prefix,
                type(exc).__name__,
            )
            raise LLMAPIRequestError() from exc

        if response.status_code in (401, 403):
            self._log_response_failure(response)
            raise LLMAPIAuthError()
        if response.status_code == 404:
            self._log_response_failure(response)
            raise LLMAPIEndpointOrModelNotFoundError()
        if not response.ok:
            self._log_response_failure(response)
            raise LLMAPIRequestError()

        logger.info(
            "LLM response received — status_code=%d body_preview=%s",
            response.status_code,
            response.text[:RESPONSE_PREVIEW_CHARS],
        )
        return response

    def _post_chat_completion_with_curl(
        self,
        payload: dict[str, Any],
        original_error: Exception,
    ) -> requests.Response:
        payload_file_path = ""
        config_file_path = ""
        try:
            with tempfile.NamedTemporaryFile(
                mode="w",
                encoding="utf-8",
                delete=False,
            ) as payload_file:
                payload_file.write(self._json_dumps(payload))
                payload_file_path = payload_file.name

            with tempfile.NamedTemporaryFile(
                mode="w",
                encoding="utf-8",
                delete=False,
            ) as config_file:
                config_file.write(f'url = "{self.config.chat_completions_url}"\n')
                config_file.write('request = "POST"\n')
                config_file.write(
                    f'header = "Authorization: Bearer {self.config.api_key}"\n'
                )
                config_file.write('header = "Content-Type: application/json"\n')
                config_file.write(f"data = @{payload_file_path}\n")
                config_file.write("silent\n")
                config_file.write("show-error\n")
                config_file.write("http2\n")
                config_file.write(f"max-time = {self.config.request_timeout_seconds}\n")
                config_file_path = config_file.name

            completed = subprocess.run(
                [
                    "curl",
                    "--config",
                    config_file_path,
                    "-w",
                    "\n%{http_code}",
                ],
                capture_output=True,
                text=True,
                timeout=self.config.request_timeout_seconds + 5,
            )
        except subprocess.TimeoutExpired as exc:
            logger.error(
                "LLM curl fallback timed out — base_url=%s model=%s timeout=%ds "
                "key_exists=%s key_prefix=%s",
                self.config.base_url,
                self.config.model,
                self.config.request_timeout_seconds,
                bool(self.config.api_key),
                self.config.safe_key_prefix,
            )
            raise LLMAPITimeoutError() from exc
        except OSError as exc:
            logger.error(
                "LLM curl fallback could not start — base_url=%s model=%s "
                "key_exists=%s key_prefix=%s type=%s",
                self.config.base_url,
                self.config.model,
                bool(self.config.api_key),
                self.config.safe_key_prefix,
                type(exc).__name__,
            )
            raise LLMAPIConnectionError() from original_error
        finally:
            self._remove_temp_file(payload_file_path)
            self._remove_temp_file(config_file_path)

        if completed.returncode != 0:
            logger.error(
                "LLM curl fallback failed — base_url=%s model=%s key_exists=%s "
                "key_prefix=%s returncode=%d stderr_preview=%s",
                self.config.base_url,
                self.config.model,
                bool(self.config.api_key),
                self.config.safe_key_prefix,
                completed.returncode,
                completed.stderr[:RESPONSE_PREVIEW_CHARS],
            )
            raise LLMAPIConnectionError() from original_error

        body, status_code = self._split_curl_body_and_status(completed.stdout)
        response = requests.Response()
        response.status_code = status_code
        response._content = body.encode("utf-8")
        response.headers["Content-Type"] = "application/json"
        response.url = self.config.chat_completions_url

        if response.status_code in (401, 403):
            self._log_response_failure(response)
            raise LLMAPIAuthError()
        if response.status_code == 404:
            self._log_response_failure(response)
            raise LLMAPIEndpointOrModelNotFoundError()
        if not response.ok:
            self._log_response_failure(response)
            raise LLMAPIRequestError()

        logger.info(
            "LLM curl fallback response received — status_code=%d body_preview=%s",
            response.status_code,
            response.text[:RESPONSE_PREVIEW_CHARS],
        )
        return response

    def _extract_content(self, response: requests.Response) -> str:
        try:
            response_json = response.json()
        except ValueError as exc:
            logger.error(
                "LLM returned non-JSON response — status_code=%d body_preview=%s",
                response.status_code,
                response.text[:RESPONSE_PREVIEW_CHARS],
            )
            raise LLMResponseFormatError() from exc

        try:
            content = response_json["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            logger.error(
                "LLM response missing choices[0].message.content — status_code=%d body_preview=%s",
                response.status_code,
                response.text[:RESPONSE_PREVIEW_CHARS],
            )
            raise LLMResponseFormatError() from exc

        if not isinstance(content, str):
            raise LLMResponseFormatError()
        if not content.strip():
            raise LLMEmptyContentError()

        logger.info("LLM content extracted — length=%d", len(content))
        return content

    @staticmethod
    def _json_dumps(payload: dict[str, Any]) -> str:
        import json

        return json.dumps(payload, ensure_ascii=False)

    @staticmethod
    def _split_curl_body_and_status(stdout: str) -> tuple[str, int]:
        body, separator, status_text = stdout.rpartition("\n")
        if not separator:
            raise LLMResponseFormatError()
        try:
            return body, int(status_text.strip())
        except ValueError as exc:
            raise LLMResponseFormatError() from exc

    @staticmethod
    def _remove_temp_file(path: str) -> None:
        if not path:
            return
        try:
            os.unlink(path)
        except OSError:
            logger.warning("Failed to remove temporary LLM curl file")

    def _log_response_failure(self, response: requests.Response) -> None:
        logger.error(
            "LLM HTTP failure — base_url=%s model=%s key_exists=%s key_prefix=%s "
            "status_code=%d body_preview=%s",
            self.config.base_url,
            self.config.model,
            bool(self.config.api_key),
            self.config.safe_key_prefix,
            response.status_code,
            response.text[:RESPONSE_PREVIEW_CHARS],
        )
