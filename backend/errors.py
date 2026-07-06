"""Centralized exception hierarchy for the narrative extraction pipeline.

Every exception here carries a ``code`` (stable string for the frontend) and a
human-readable ``message``.  Payload-sensitive fields are *never* embedded in
the exception message itself.
"""


class NarrativeBaseError(Exception):
    """Base class for all narrative-pipeline errors."""

    code: str = "NARRATIVE_EXTRACTION_FAILED"
    message: str = "LLM narrative extraction failed"

    def __init__(self, message: str | None = None, **kwargs: object) -> None:
        self.extra = kwargs
        super().__init__(message or self.message)


# ---------------------------------------------------------------------------
# LLM client errors
# ---------------------------------------------------------------------------


class LLMConfigurationError(NarrativeBaseError):
    code = "LLM_CONFIG_MISSING"
    message = "LLM configuration missing"


class LLMAPIRequestError(NarrativeBaseError):
    code = "LLM_API_REQUEST_FAILED"
    message = "LLM API request failed"


class LLMAPITimeoutError(LLMAPIRequestError):
    code = "LLM_API_TIMEOUT"
    message = "LLM API request timed out"


class LLMAPIConnectionError(LLMAPIRequestError):
    code = "LLM_API_CONNECTION_FAILED"
    message = "LLM API connection failed"


class LLMAPIAuthError(LLMAPIRequestError):
    code = "LLM_API_AUTH_FAILED"
    message = "LLM API authentication failed"


class LLMAPIEndpointOrModelNotFoundError(LLMAPIRequestError):
    code = "LLM_API_ENDPOINT_OR_MODEL_NOT_FOUND"
    message = "LLM API endpoint or model not found"


class LLMResponseFormatError(LLMAPIRequestError):
    code = "LLM_RESPONSE_FORMAT_ERROR"
    message = "LLM response format error"


class LLMEmptyContentError(NarrativeBaseError):
    code = "LLM_EMPTY_CONTENT"
    message = "LLM returned empty content"


# ---------------------------------------------------------------------------
# Narrative JSON errors
# ---------------------------------------------------------------------------


class InvalidNarrativeJSONError(NarrativeBaseError):
    code = "LLM_INVALID_JSON"
    message = "LLM returned invalid JSON"


class NarrativeSchemaValidationError(NarrativeBaseError):
    code = "LLM_SCHEMA_VALIDATION_FAILED"
    message = "LLM response schema validation failed"

    def __init__(
        self,
        message: str | None = None,
        validation_errors: list[dict] | None = None,
        **kwargs: object,
    ) -> None:
        self.validation_errors = validation_errors or []
        super().__init__(message, **kwargs)
