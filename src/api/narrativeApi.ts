export interface Entity {
  text: string;
  type: string;
  start?: number | null;
  end?: number | null;
  [key: string]: unknown;
}

export interface ParseResponse {
  tokens: string[];
  pos: Array<[string, string]>;
  entities: Entity[];
  dependency: unknown[];
  semantic_roles: unknown[];
}

export interface NarrativeUnitsRequest {
  text: string;
  story_title?: string;
  startIndex?: number;
  endIndex?: number;
}

export interface NarrativeSentence {
  id: string;
  text: string;
  cleaned_text?: string;
  tokens: string[];
  pos: Array<[string, string]>;
  entities: Entity[];
  dependency: unknown[];
  semantic_roles: unknown[];
  parse_status?: "ok" | "failed";
  parse_error?: string | null;
}

export interface EntityMention {
  text: string;
  type: string;
  sentence_id: string;
  start?: number | null;
  end?: number | null;
}

export interface NarrativeUnitsResponse {
  story_title?: string;
  range?: {
    startIndex?: number;
    endIndex?: number;
  };
  sentence_count?: number;
  parsed_sentence_count?: number;
  failed_sentence_count?: number;
  sentences: NarrativeSentence[];
  entity_mentions: EntityMention[];
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export async function parseText(text: string): Promise<ParseResponse> {
  const response = await fetch(`${API_BASE_URL}/parse`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "HanLP parsing failed or backend is not running."));
  }

  return response.json() as Promise<ParseResponse>;
}

export async function parseNarrativeUnits(
  payload: NarrativeUnitsRequest,
): Promise<NarrativeUnitsResponse> {
  const response = await fetch(`${API_BASE_URL}/narrative-units`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(
      await readErrorMessage(response, "Narrative units parsing failed or backend is not running."),
    );
  }

  return response.json() as Promise<NarrativeUnitsResponse>;
}

async function readErrorMessage(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { detail?: unknown };
    return typeof body.detail === "string" ? body.detail : fallback;
  } catch {
    return fallback;
  }
}
