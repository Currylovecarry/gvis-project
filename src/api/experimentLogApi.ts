import type { ExperimentLog } from "../types/experiment";

const EXPERIMENT_LOG_API_URL =
  import.meta.env.VITE_EXPERIMENT_LOG_API_URL
  ?? import.meta.env.VITE_API_BASE_URL
  ?? "http://localhost:8000";

export async function submitExperimentLog(log: ExperimentLog) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 6000);
  let response: Response;

  try {
    response = await fetch(`${EXPERIMENT_LOG_API_URL}/experiment-logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(log),
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`Experiment log upload failed with status ${response.status}.`);
  }

  return response.json() as Promise<{ saved: boolean; sessionId: string }>;
}
