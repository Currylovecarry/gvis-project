export type ExperimentAiMode = "zero" | "low" | "medium" | "high";

export type ExperimentAssistanceTrigger = "manual" | "automatic";

export type ExperimentCompletionStatus = "completed" | "abandoned";

export type ExperimentVisualizationDetail = "event_map" | "character_graph";

export type ExperimentEvent = {
  type:
    | "session_started"
    | "mode_selected"
    | "assistance_called"
    | "visualization_detail_opened"
    | "session_ended";
  timestamp: string;
  elapsedMs: number;
  activeReadingMs: number;
  progress: number;
  mode?: ExperimentAiMode;
  trigger?: ExperimentAssistanceTrigger;
  visualizationDetail?: ExperimentVisualizationDetail;
};

export type ExperimentLog = {
  schemaVersion: 2;
  sessionId: string;
  participantId: string;
  book: {
    id: string;
    title: string;
    format: string;
  };
  startedAt: string;
  endedAt: string;
  completionStatus: ExperimentCompletionStatus;
  readingDurationMs: number;
  readingDurationSeconds: number;
  elapsedDurationMs: number;
  initialProgress: number;
  finalProgress: number;
  assistance: {
    low: {
      used: boolean;
      callCount: number;
    };
    medium: {
      used: boolean;
      callCount: number;
      manualCallCount: number;
      automaticCallCount: number;
    };
  };
  visualizationDetails: {
    eventMapExpandCount: number;
    characterGraphExpandCount: number;
  };
  events: ExperimentEvent[];
};
