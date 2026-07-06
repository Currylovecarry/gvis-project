export interface NarrativeJsonRequest {
  story_title?: string;
  text: string;
  startIndex?: number;
  endIndex?: number;
}

export interface NarrativeRange {
  startIndex?: number;
  endIndex?: number;
}

export interface Character {
  id: string;
  name: string;
  aliases: string[];
  description: string;
  evidence: string;
  confidence: number;
}

export interface Event {
  id: string;
  order: number;
  text_span: string;
  summary: string;
  characters: string[];
  event_type:
    | "action"
    | "dialogue"
    | "description"
    | "relationship"
    | "movement"
    | "object"
    | "emotion"
    | "other";
  evidence: string;
  confidence: number;
}

export interface Relation {
  id: string;
  source: string;
  target: string;
  relation_type:
    | "spouse"
    | "family"
    | "friend"
    | "conflict"
    | "acquaintance"
    | "unknown"
    | "other";
  description: string;
  evidence: string;
  confidence: number;
}

export interface NarrativeJsonResponse {
  story_title?: string;
  range?: NarrativeRange;
  characters: Character[];
  events: Event[];
  relations: Relation[];
}
