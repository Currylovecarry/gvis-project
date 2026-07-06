import type {
  NarrativeJsonRequest,
  NarrativeJsonResponse,
} from "../types/narrative";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export async function extractNarrativeJson(
  payload: NarrativeJsonRequest,
): Promise<NarrativeJsonResponse> {
  const response = await fetch(`${API_BASE_URL}/narrative-json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as unknown;
  if (!isNarrativeJsonResponse(data)) {
    throw new Error("Invalid Narrative JSON response.");
  }

  return data;
}

async function readErrorMessage(response: Response) {
  try {
    const body = (await response.json()) as { detail?: unknown };
    const { detail } = body;

    // Structured error: { code, message, errors? }
    if (detail && typeof detail === "object" && !Array.isArray(detail)) {
      const { code, message, errors } = detail as Record<string, unknown>;
      const parts: string[] = [];
      if (typeof code === "string") parts.push(`[${code}]`);
      if (typeof message === "string") parts.push(message);
      if (Array.isArray(errors) && errors.length > 0) {
        parts.push(
          `(${errors.length} validation error${errors.length > 1 ? "s" : ""})`,
        );
        parts.push(JSON.stringify(errors, null, 2));
      }
      return parts.join(" ") || "Narrative JSON extraction failed.";
    }

    // Legacy string detail
    return typeof detail === "string"
      ? detail
      : "Narrative JSON extraction failed or backend is not running.";
  } catch {
    return "Narrative JSON extraction failed or backend is not running.";
  }
}

function isNarrativeJsonResponse(value: unknown): value is NarrativeJsonResponse {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<NarrativeJsonResponse>;
  return (
    Array.isArray(candidate.characters) &&
    Array.isArray(candidate.events) &&
    Array.isArray(candidate.relations)
  );
}
