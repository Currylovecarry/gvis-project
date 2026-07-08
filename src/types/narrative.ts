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
  description: string;
  characters: string[];
  importance: "high" | "medium" | "low";
  evidence: string;
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
