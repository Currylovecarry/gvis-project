export type ExperimentAiMode = "zero" | "low" | "medium" | "high";

export type ExperimentAssistanceTrigger = "manual" | "automatic";

export type ExperimentCompletionStatus = "completed" | "abandoned";

export type ExperimentEvent = {
  type: "session_started" | "mode_selected" | "assistance_called" | "session_ended";
  timestamp: string;
  elapsedMs: number;
  activeReadingMs: number;
  progress: number;
  mode?: ExperimentAiMode;
  trigger?: ExperimentAssistanceTrigger;
};

export type ExperimentLog = {
  schemaVersion: 1;
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
  events: ExperimentEvent[];
};
