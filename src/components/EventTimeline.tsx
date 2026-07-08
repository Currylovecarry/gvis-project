import { useEffect, useMemo, useState } from "react";
import type { Event as NarrativeEvent } from "../types/narrative";

type EventTimelineProps = {
  events: NarrativeEvent[];
};

type SidebarEventTimelineProps = {
  events: NarrativeEvent[];
};

const importanceLabels: Record<NarrativeEvent["importance"], string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const importanceText: Record<NarrativeEvent["importance"], string> = {
  high: "关键",
  medium: "推进",
  low: "补充",
};

export function EventTimeline({ events }: EventTimelineProps) {
  const orderedEvents = useMemo(
    () => normalizeEvents(events).sort((first, second) => first.order - second.order),
    [events],
  );
  const eventStats = useMemo(() => {
    return orderedEvents.reduce(
      (stats, event) => {
        stats[event.importance] += 1;
        return stats;
      },
      { high: 0, medium: 0, low: 0 },
    );
  }, [orderedEvents]);
  const [selectedEvent, setSelectedEvent] = useState<NarrativeEvent | null>(
    orderedEvents[0] ?? null,
  );

  useEffect(() => {
    setSelectedEvent((current) => {
      if (current) {
        const nextEvent = orderedEvents.find((event) => event.id === current.id);
        if (nextEvent) return nextEvent;
      }
      return orderedEvents[0] ?? null;
    });
  }, [orderedEvents]);

  if (orderedEvents.length === 0) {
    return (
      <section className="event-timeline-panel" aria-label="事件时间线">
        <div className="event-timeline-empty">
          <strong>还没有事件时间线</strong>
          <p>当前 Narrative JSON 没有 events，抽取到事件后这里会按 order 展开。</p>
        </div>
      </section>
    );
  }

  return (
    <section className="event-timeline-panel" aria-label="事件时间线">
      <header className="event-timeline-header">
        <div>
          <h3>事件时间线</h3>
          <p>{orderedEvents.length} 个事件，按叙事顺序从左到右排列</p>
        </div>
        <div className="event-timeline-stats" aria-label="事件重要性统计">
          <span data-importance="high">关键 {eventStats.high}</span>
          <span data-importance="medium">推进 {eventStats.medium}</span>
          <span data-importance="low">补充 {eventStats.low}</span>
        </div>
      </header>

      <div className="event-timeline-shell">
        <ol className="event-timeline-track">
          {orderedEvents.map((event) => (
            <li className={`event-timeline-node event-timeline-node-${event.importance}`} key={event.id}>
              <button
                aria-pressed={selectedEvent?.id === event.id}
                className="event-timeline-card"
                onClick={() => setSelectedEvent(event)}
                type="button"
              >
                <span className="event-timeline-marker">
                  <span className="event-timeline-order">{event.order}</span>
                  <span className="event-timeline-importance">{importanceLabels[event.importance]}</span>
                </span>
                <span className="event-timeline-copy">
                  <strong>{event.description}</strong>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>

      <article className="event-timeline-detail" aria-live="polite">
        {selectedEvent ? (
          <>
            <header>
              <span>Event</span>
              <strong>{selectedEvent.order}. {selectedEvent.description}</strong>
              <em>{importanceText[selectedEvent.importance]}</em>
            </header>
            <dl>
              <dt>Characters</dt>
              <dd>{selectedEvent.characters.length ? selectedEvent.characters.join(", ") : "N/A"}</dd>
            </dl>
            <blockquote>{selectedEvent.evidence || "N/A"}</blockquote>
          </>
        ) : (
          <p>点击时间线上的事件查看原文证据。</p>
        )}
      </article>
    </section>
  );
}

export function SidebarEventTimeline({ events }: SidebarEventTimelineProps) {
  const orderedEvents = useMemo(
    () => normalizeEvents(events).sort((first, second) => first.order - second.order),
    [events],
  );

  if (orderedEvents.length === 0) return null;

  return (
    <aside className="reader-sidebar-timeline" aria-label="事件时间线">
      <ol>
        {orderedEvents.map((event) => (
          <li className={`reader-sidebar-event reader-sidebar-event-${event.importance}`} key={event.id}>
            <span className="reader-sidebar-event-dot">{event.order}</span>
            <span className="reader-sidebar-event-copy">
              <strong>{event.description}</strong>
            </span>
          </li>
        ))}
      </ol>
    </aside>
  );
}

function normalizeEvents(events: NarrativeEvent[]) {
  return events
    .map((event, index): NarrativeEvent => ({
      id: String(event.id || `event-${index + 1}`),
      order: Number.isFinite(event.order) ? event.order : index + 1,
      description: event.description || "Untitled event",
      characters: Array.isArray(event.characters) ? event.characters.map(String) : [],
      importance: normalizeImportance(event.importance),
      evidence: event.evidence || "",
    }))
    .filter((event) => event.description.trim().length > 0);
}

function normalizeImportance(value: NarrativeEvent["importance"]) {
  return value === "high" || value === "medium" || value === "low" ? value : "medium";
}
