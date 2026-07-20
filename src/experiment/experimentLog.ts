import type { Book } from "../data/books";
import type {
  ExperimentAiMode,
  ExperimentAssistanceTrigger,
  ExperimentCompletionStatus,
  ExperimentEvent,
  ExperimentLog,
  ExperimentVisualizationDetail,
} from "../types/experiment";

const experimentArchiveKey = "gvis-experiment-logs:v1";
const maximumArchivedLogs = 500;

export type ExperimentSessionRuntime = {
  sessionId: string;
  participantId: string;
  book: ExperimentLog["book"];
  startedAt: string;
  startedAtEpochMs: number;
  startedAtPerformanceMs: number;
  accumulatedActiveMs: number;
  activeSegmentStartedAtMs: number | null;
  initialProgress: number;
  assistance: ExperimentLog["assistance"];
  visualizationDetails: ExperimentLog["visualizationDetails"];
  events: ExperimentEvent[];
};

export function startExperimentSession({
  participantId,
  book,
  initialProgress,
}: {
  participantId: string;
  book: Book;
  initialProgress: number;
}): ExperimentSessionRuntime {
  const startedAtEpochMs = Date.now();
  const startedAtPerformanceMs = performance.now();
  const startedAt = new Date(startedAtEpochMs).toISOString();
  const session: ExperimentSessionRuntime = {
    sessionId: crypto.randomUUID(),
    participantId,
    book: {
      id: book.id,
      title: book.title,
      format: book.format,
    },
    startedAt,
    startedAtEpochMs,
    startedAtPerformanceMs,
    accumulatedActiveMs: 0,
    activeSegmentStartedAtMs:
      document.visibilityState === "visible" ? startedAtPerformanceMs : null,
    initialProgress,
    assistance: {
      low: {
        used: false,
        callCount: 0,
      },
      medium: {
        used: false,
        callCount: 0,
        manualCallCount: 0,
        automaticCallCount: 0,
      },
    },
    visualizationDetails: {
      eventMapExpandCount: 0,
      characterGraphExpandCount: 0,
    },
    events: [],
  };

  session.events.push(createEvent(session, {
    type: "session_started",
    mode: "zero",
    progress: initialProgress,
  }));

  return session;
}

export function setExperimentSessionActive(
  session: ExperimentSessionRuntime,
  isActive: boolean,
) {
  const now = performance.now();

  if (isActive) {
    if (session.activeSegmentStartedAtMs === null) {
      session.activeSegmentStartedAtMs = now;
    }
    return;
  }

  if (session.activeSegmentStartedAtMs !== null) {
    session.accumulatedActiveMs += Math.max(0, now - session.activeSegmentStartedAtMs);
    session.activeSegmentStartedAtMs = null;
  }
}

export function recordExperimentModeSelection(
  session: ExperimentSessionRuntime,
  mode: ExperimentAiMode,
  progress: number,
) {
  session.events.push(createEvent(session, {
    type: "mode_selected",
    mode,
    progress,
  }));
}

export function recordExperimentAssistanceCall(
  session: ExperimentSessionRuntime,
  mode: "low" | "medium",
  trigger: ExperimentAssistanceTrigger,
  progress: number,
) {
  if (mode === "low") {
    session.assistance.low.callCount += 1;
    session.assistance.low.used = true;
  } else {
    session.assistance.medium.callCount += 1;
    session.assistance.medium.used = true;
    if (trigger === "automatic") {
      session.assistance.medium.automaticCallCount += 1;
    } else {
      session.assistance.medium.manualCallCount += 1;
    }
  }

  session.events.push(createEvent(session, {
    type: "assistance_called",
    mode,
    trigger,
    progress,
  }));
}

export function recordExperimentVisualizationDetailOpen(
  session: ExperimentSessionRuntime,
  visualizationDetail: ExperimentVisualizationDetail,
  mode: ExperimentAiMode,
  progress: number,
) {
  if (visualizationDetail === "event_map") {
    session.visualizationDetails.eventMapExpandCount += 1;
  } else {
    session.visualizationDetails.characterGraphExpandCount += 1;
  }

  session.events.push(createEvent(session, {
    type: "visualization_detail_opened",
    visualizationDetail,
    mode,
    progress,
  }));
}

export function completeExperimentSession(
  session: ExperimentSessionRuntime,
  completionStatus: ExperimentCompletionStatus,
  finalProgress: number,
): ExperimentLog {
  setExperimentSessionActive(session, false);
  const endedAtEpochMs = Date.now();
  const readingDurationMs = Math.max(0, Math.round(session.accumulatedActiveMs));
  const elapsedDurationMs = Math.max(0, endedAtEpochMs - session.startedAtEpochMs);

  session.events.push(createEvent(session, {
    type: "session_ended",
    progress: finalProgress,
  }));

  return {
    schemaVersion: 2,
    sessionId: session.sessionId,
    participantId: session.participantId,
    book: session.book,
    startedAt: session.startedAt,
    endedAt: new Date(endedAtEpochMs).toISOString(),
    completionStatus,
    readingDurationMs,
    readingDurationSeconds: Number((readingDurationMs / 1000).toFixed(3)),
    elapsedDurationMs,
    initialProgress: clampProgress(session.initialProgress),
    finalProgress: clampProgress(finalProgress),
    assistance: structuredClone(session.assistance),
    visualizationDetails: structuredClone(session.visualizationDetails),
    events: [...session.events],
  };
}

export function archiveExperimentLog(log: ExperimentLog) {
  try {
    const raw = window.localStorage.getItem(experimentArchiveKey);
    const existing = raw ? JSON.parse(raw) as unknown : [];
    const logs = Array.isArray(existing) ? existing : [];
    const nextLogs = [...logs, log].slice(-maximumArchivedLogs);
    window.localStorage.setItem(experimentArchiveKey, JSON.stringify(nextLogs));
    return true;
  } catch {
    return false;
  }
}

export function downloadExperimentLog(log: ExperimentLog) {
  const json = JSON.stringify(log, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = [
    "gvis",
    sanitizeFilenamePart(log.participantId),
    sanitizeFilenamePart(log.book.title),
    log.sessionId,
  ].join("-") + ".json";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function createEvent(
  session: ExperimentSessionRuntime,
  event: Pick<ExperimentEvent, "type" | "progress"> &
    Partial<Pick<ExperimentEvent, "mode" | "trigger" | "visualizationDetail">>,
): ExperimentEvent {
  const nowEpochMs = Date.now();
  return {
    ...event,
    timestamp: new Date(nowEpochMs).toISOString(),
    elapsedMs: Math.max(0, nowEpochMs - session.startedAtEpochMs),
    activeReadingMs: Math.max(0, Math.round(getActiveReadingDuration(session))),
    progress: clampProgress(event.progress),
  };
}

function getActiveReadingDuration(session: ExperimentSessionRuntime) {
  if (session.activeSegmentStartedAtMs === null) {
    return session.accumulatedActiveMs;
  }
  return session.accumulatedActiveMs
    + Math.max(0, performance.now() - session.activeSegmentStartedAtMs);
}

function clampProgress(progress: number) {
  return Math.min(Math.max(Number.isFinite(progress) ? progress : 0, 0), 1);
}

function sanitizeFilenamePart(value: string) {
  const sanitized = value.trim().replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/^-+|-+$/g, "");
  return sanitized || "unknown";
}
