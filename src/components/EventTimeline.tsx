import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Character, Event as NarrativeEvent } from "../types/narrative";

type EventTimelineProps = {
  events: NarrativeEvent[];
};

type SidebarEventTimelineProps = {
  events: NarrativeEvent[];
  characters: Character[];
  variant?: "sidebar" | "fullscreen" | "demo";
  onExpand?: () => void;
  onClose?: () => void;
  showDemoWhenEmpty?: boolean;
  obscured?: boolean;
};

type VisualEvent = NarrativeEvent & {
  location: string;
  characterImportance: Record<string, number>;
};

const EVENT_RADII: Record<NarrativeEvent["importance"], number> = {
  high: 31,
  medium: 19,
  low: 10,
};

const SIDEBAR_EVENT_RADII: Record<NarrativeEvent["importance"], number> = {
  high: 26,
  medium: 18,
  low: 11,
};

const CHARACTER_COLORS = ["#bed7ed", "#dce8ba", "#e6c6c4", "#c3b3d0", "#e6c48f", "#fcf8b9"];
const SUMMARY_CHARACTERS_PER_LINE = 6;
const SUMMARY_LINE_HEIGHT = 14;

const DEMO_CHARACTERS: Character[] = [
  { id: "demo-lin", name: "林澈", aliases: [], description: "", evidence: "", confidence: 1 },
  { id: "demo-su", name: "苏晚", aliases: [], description: "", evidence: "", confidence: 1 },
  { id: "demo-zhou", name: "周岑", aliases: [], description: "", evidence: "", confidence: 1 },
  { id: "demo-keeper", name: "店主", aliases: [], description: "", evidence: "", confidence: 1 },
];

const DEMO_EVENTS: NarrativeEvent[] = [
  {
    id: "demo-1", order: 1, description: "林澈抵达旧车站", location: "旧车站", characters: ["demo-lin"],
    character_importance: { "demo-lin": 1 }, importance: "low", evidence: "",
  },
  {
    id: "demo-2", order: 2, description: "苏晚在月台等候", location: "旧车站", characters: ["demo-lin", "demo-su"],
    character_importance: { "demo-lin": 0.42, "demo-su": 0.58 }, importance: "medium", evidence: "",
  },
  {
    id: "demo-3", order: 3, description: "两人在书店发现旧信", location: "河岸书店", characters: ["demo-lin", "demo-su", "demo-keeper"],
    character_importance: { "demo-lin": 0.35, "demo-su": 0.45, "demo-keeper": 0.2 }, importance: "high", evidence: "",
  },
  {
    id: "demo-4", order: 4, description: "周岑带来新的消息", location: "河岸书店", characters: ["demo-su", "demo-zhou"],
    character_importance: { "demo-su": 0.3, "demo-zhou": 0.7 }, importance: "medium", evidence: "",
  },
  {
    id: "demo-5", order: 5, description: "林澈独自离开河岸", location: "河堤", characters: ["demo-lin"],
    character_importance: { "demo-lin": 1 }, importance: "low", evidence: "",
  },
];

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

export function SidebarEventTimeline({
  events,
  characters,
  variant = "sidebar",
  onExpand,
  onClose,
  showDemoWhenEmpty = true,
  obscured = false,
}: SidebarEventTimelineProps) {
  const isDemo = showDemoWhenEmpty && events.length === 0;
  const sourceEvents = isDemo ? DEMO_EVENTS : events;
  const sourceCharacters = isDemo ? DEMO_CHARACTERS : characters;
  const mapScrollRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startScrollLeft: number;
  } | null>(null);
  const orderedEvents = useMemo(
    () => normalizeEvents(sourceEvents).sort((first, second) => first.order - second.order) as VisualEvent[],
    [sourceEvents],
  );
  const [selectedEvent, setSelectedEvent] = useState<VisualEvent | null>(null);
  const [hoveredCharacter, setHoveredCharacter] = useState<{ name: string; x: number; y: number } | null>(null);
  const [hoveredEvent, setHoveredEvent] = useState<{ description: string; x: number; y: number } | null>(null);
  const characterLabels = useMemo(
    () => new Map(sourceCharacters.map((character) => [character.id, character.name])),
    [sourceCharacters],
  );
  const characterColors = useMemo(() => {
    const ids = Array.from(new Set(orderedEvents.flatMap((event) => event.characters)));
    return new Map(ids.map((id, index) => [id, CHARACTER_COLORS[index % CHARACTER_COLORS.length]]));
  }, [orderedEvents]);

  const displayedEvents = orderedEvents;
  const locations = useMemo(
    () => Array.from(new Set(displayedEvents.map((event) => event.location))),
    [displayedEvents],
  );

  useEffect(() => {
    setSelectedEvent((current) =>
      displayedEvents.find((event) => event.id === current?.id)
      ?? displayedEvents[displayedEvents.length - 1]
      ?? null,
    );
  }, [displayedEvents, variant]);

  useEffect(() => {
    const viewport = mapScrollRef.current;
    if (!viewport || variant !== "sidebar") return;

    const latestCore = viewport.querySelector<SVGCircleElement>(
      '[data-latest-event-core="true"]',
    );
    if (!latestCore) return;

    const viewportRect = viewport.getBoundingClientRect();
    const coreRect = latestCore.getBoundingClientRect();
    const latestCenter = viewport.scrollLeft + coreRect.left - viewportRect.left + coreRect.width / 2;
    const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    const nextScrollLeft = Math.min(
      Math.max(0, latestCenter - viewport.clientWidth / 2),
      maxScrollLeft,
    );

    viewport.scrollTo({
      left: nextScrollLeft,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }, [orderedEvents, variant]);

  const scrollEvents = (direction: -1 | 1) => {
    const viewport = mapScrollRef.current;
    if (!viewport) return;
    const distance = variant === "sidebar" ? Math.max(180, viewport.clientWidth * 0.82) : 360;
    viewport.scrollBy({ left: direction * distance, behavior: "smooth" });
  };

  if (orderedEvents.length === 0) {
    return null;
  }

  const labelWidth = variant === "sidebar" ? 16 : 88;
  const eventSpacing = variant === "sidebar" ? 160 : 150;
  const sidebarCanvasInset = variant === "sidebar" ? 160 : 0;
  const locationGap = variant === "demo" ? 14 : variant === "sidebar" ? 8 : 24;
  const minimumChartWidth = variant === "sidebar" ? 250 : 330;
  const summaryCharactersPerLine = variant === "sidebar" ? 8 : SUMMARY_CHARACTERS_PER_LINE;
  const summaryLineHeight = variant === "sidebar" ? 12 : SUMMARY_LINE_HEIGHT;
  const eventRadius = (event: VisualEvent) =>
    variant === "sidebar" ? SIDEBAR_EVENT_RADII[event.importance] : EVENT_RADII[event.importance];
  const chartWidth = Math.max(
    minimumChartWidth,
    labelWidth + (variant === "sidebar" ? 72 : 120) + Math.max(displayedEvents.length - 1, 0) * eventSpacing,
  ) + sidebarCanvasInset * 2;
  const locationLayouts = locations.map((location) => {
    const locationEvents = displayedEvents.filter((event) => event.location === location);
    const top = Math.max(
      ...locationEvents.map((event) => eventRadius(event) + (variant === "sidebar" ? 10 : 14)),
      variant === "sidebar" ? 28 : 34,
    );
    const bottom = Math.max(
      ...locationEvents.map((event) =>
        eventRadius(event)
        + (variant === "sidebar" ? 22 : 28)
        + Math.max(getStorySummaryLines(event.description, summaryCharactersPerLine).length - 1, 0)
          * summaryLineHeight,
      ),
      variant === "sidebar" ? 48 : 54,
    );
    return { location, top, bottom, y: 0 };
  });
  locationLayouts.forEach((layout, index) => {
    const previous = locationLayouts[index - 1];
    layout.y = previous
      ? previous.y + previous.bottom + layout.top + locationGap
      : layout.top + (variant === "sidebar" ? 8 : 12);
  });
  const locationY = new Map(locationLayouts.map((layout) => [layout.location, layout.y]));
  const lastLocation = locationLayouts[locationLayouts.length - 1];
  const chartHeight = variant === "sidebar"
    ? 108
    : lastLocation
      ? lastLocation.y + lastLocation.bottom + 18
      : 120;
  const positionFor = (event: VisualEvent, index: number) => ({
    x: sidebarCanvasInset + labelWidth + (variant === "sidebar" ? 36 : 28) + index * eventSpacing,
    y: variant === "sidebar" ? 54 : locationY.get(event.location) ?? 48,
  });
  const connectorPath = displayedEvents
    .map((event, index) => {
      const { x, y } = positionFor(event, index);
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  return (
    <aside className={`reader-sidebar-timeline event-map-variant-${variant}${obscured ? " visual-gated" : ""}`} aria-label="事件地点图">
      <div className="event-map-heading">
        {variant !== "fullscreen" && (
          <div className="event-map-heading-copy">
            <span>{variant === "sidebar" ? `最近事件 · ${displayedEvents.length}` : "事件 · 地点"}</span>
            {variant === "sidebar" && (
              <small>向左滑动回看</small>
            )}
          </div>
        )}
        <div className="event-map-controls">
          {variant !== "sidebar" && (
            <>
              <button
                type="button"
                onClick={() => scrollEvents(-1)}
                aria-label="查看之前的事件"
                title="之前的事件"
              >‹</button>
              <button
                type="button"
                onClick={() => scrollEvents(1)}
                aria-label="查看之后的事件"
                title="之后的事件"
              >›</button>
            </>
          )}
          {onExpand && <button className="event-map-expand" type="button" onClick={onExpand}>展开</button>}
          {onClose && (
            <button className="event-map-close" type="button" onClick={onClose} aria-label="关闭完整视图">
              关闭 ×
            </button>
          )}
        </div>
      </div>
      {variant !== "sidebar" && (
        <div className="event-map-legend" aria-label="角色图例">
          {Array.from(characterColors.entries()).map(([id, color]) => (
            <span key={id}>
              <i style={{ backgroundColor: color }} aria-hidden="true" />
              {characterLabels.get(id) ?? id}
            </span>
          ))}
        </div>
      )}
      <div
        className="event-map-scroll"
        ref={mapScrollRef}
        onPointerDown={(event) => {
          if (variant !== "sidebar" || event.button !== 0) return;
          dragStateRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startScrollLeft: event.currentTarget.scrollLeft,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const dragState = dragStateRef.current;
          if (variant !== "sidebar" || !dragState || dragState.pointerId !== event.pointerId) return;
          event.currentTarget.scrollLeft = dragState.startScrollLeft - (event.clientX - dragState.startX);
        }}
        onPointerUp={(event) => {
          const dragState = dragStateRef.current;
          if (variant !== "sidebar" || !dragState || dragState.pointerId !== event.pointerId) return;
          dragStateRef.current = null;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onPointerCancel={(event) => {
          dragStateRef.current = null;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
      >
        <svg
          className="event-map"
          height={variant === "sidebar" ? chartHeight : undefined}
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          width={variant === "sidebar" ? chartWidth : undefined}
          role="img"
          aria-label="按故事进展和地点排列的事件图"
        >
          {variant !== "sidebar" && locations.map((location) => {
            const y = locationY.get(location) ?? 48;
            return (
              <g key={location}>
                <line className="event-map-guide" x1={labelWidth - 10} x2={chartWidth} y1={y} y2={y} />
                <text className="event-map-location" x={labelWidth - 16} y={y + 4} textAnchor="end">{location}</text>
              </g>
            );
          })}
          <path className="event-map-connector" d={connectorPath} />
          {displayedEvents.map((event, index) => {
            const { x, y } = positionFor(event, index);
            const radius = eventRadius(event);
            const displayDescription = formatEventDescription(event.description);
            return (
              <g
                className={`event-map-node${selectedEvent?.id === event.id ? " selected" : ""}`}
                key={event.id}
                onClick={() => setSelectedEvent(event)}
                onKeyDown={(keyboardEvent) => {
                  if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") setSelectedEvent(event);
                }}
                role="button"
                tabIndex={0}
                aria-label={`事件 ${event.order}: ${displayDescription}`}
              >
                {variant === "sidebar" && (
                  <text
                    className="event-map-node-location"
                    x={x}
                    y={y - radius - 14}
                    textAnchor="middle"
                  >
                    {event.location}
                  </text>
                )}
                <circle
                  aria-hidden="true"
                  className="event-map-connector-cutout"
                  cx={x}
                  cy={y}
                  r={radius + 13}
                />
                <circle
                  className="event-map-core"
                  cx={x}
                  cy={y}
                  r={radius}
                  data-latest-event-core={index === displayedEvents.length - 1 ? "true" : undefined}
                  onPointerEnter={(pointerEvent) =>
                    setHoveredEvent({ description: displayDescription, x: pointerEvent.clientX, y: pointerEvent.clientY })
                  }
                  onPointerMove={(pointerEvent) =>
                    setHoveredEvent({ description: displayDescription, x: pointerEvent.clientX, y: pointerEvent.clientY })
                  }
                  onPointerLeave={() => setHoveredEvent(null)}
                />
                <CharacterArcs
                  characterIds={event.characters}
                  colors={characterColors}
                  labels={characterLabels}
                  onHover={(name, x, y) => setHoveredCharacter({ name, x, y })}
                  onLeave={() => setHoveredCharacter(null)}
                  importance={event.characterImportance}
                  centerX={x}
                  centerY={y}
                  radius={radius + 7}
                />
                {variant !== "sidebar" && (
                  <StorySummary
                    x={x}
                    y={y + radius + 28}
                    text={displayDescription}
                    charactersPerLine={summaryCharactersPerLine}
                    lineHeight={summaryLineHeight}
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>
      {selectedEvent && variant === "sidebar" && (
        <p className="event-map-sidebar-detail" aria-live="polite">
          <strong>{formatEventDescription(selectedEvent.description)}</strong>
          <span>{selectedEvent.location} · 事件 {selectedEvent.order}</span>
        </p>
      )}
      {variant === "sidebar" && (
        <div className="event-map-legend event-map-sidebar-legend" aria-label="人物图例">
          <span className="event-map-legend-label">人物</span>
          {Array.from(characterColors.entries()).map(([id, color]) => (
            <span key={id}>
              <i style={{ backgroundColor: color }} aria-hidden="true" />
              {characterLabels.get(id) ?? id}
            </span>
          ))}
        </div>
      )}
      {selectedEvent && variant !== "sidebar" && (
        <p className="event-map-detail" aria-live="polite">
          <strong>事件 {selectedEvent.order}</strong>{formatEventDescription(selectedEvent.description)}
          <span>{selectedEvent.characters.map((id) => characterLabels.get(id) ?? id).join(" · ") || "暂无人物"}</span>
        </p>
      )}
      {hoveredCharacter && (
        <span
          className="event-map-hover-tooltip"
          role="tooltip"
          style={{ left: hoveredCharacter.x + 12, top: hoveredCharacter.y + 12 }}
        >
          {hoveredCharacter.name}
        </span>
      )}
      {hoveredEvent && !hoveredCharacter && (
        <span
          className="event-map-hover-tooltip"
          role="tooltip"
          style={{ left: hoveredEvent.x + 12, top: hoveredEvent.y + 12 }}
        >
          {hoveredEvent.description}
        </span>
      )}
    </aside>
  );
}

function StorySummary({
  x,
  y,
  text,
  charactersPerLine = SUMMARY_CHARACTERS_PER_LINE,
  lineHeight = SUMMARY_LINE_HEIGHT,
}: {
  x: number;
  y: number;
  text: string;
  charactersPerLine?: number;
  lineHeight?: number;
}) {
  const lines = getStorySummaryLines(text, charactersPerLine);

  return (
    <text className="event-map-summary" x={x} y={y} textAnchor="middle">
      {lines.map((line, index) => (
        <tspan key={`${line}-${index}`} x={x} dy={index === 0 ? 0 : lineHeight}>{line}</tspan>
      ))}
    </text>
  );
}

function formatEventDescription(text: string) {
  return text.trim().replace(/[。．.]+$/u, "");
}

function getStorySummaryLines(text: string, charactersPerLine = SUMMARY_CHARACTERS_PER_LINE) {
  const displayText = formatEventDescription(text);
  return Array.from(
    { length: Math.max(1, Math.ceil(displayText.length / charactersPerLine)) },
    (_, index) => displayText.slice(
      index * charactersPerLine,
      (index + 1) * charactersPerLine,
    ),
  );
}

function CharacterArcs({
  characterIds,
  colors,
  labels,
  onHover,
  onLeave,
  importance,
  centerX,
  centerY,
  radius,
}: {
  characterIds: string[];
  colors: Map<string, string>;
  labels: Map<string, string>;
  onHover: (name: string, x: number, y: number) => void;
  onLeave: () => void;
  importance: Record<string, number>;
  centerX: number;
  centerY: number;
  radius: number;
}) {
  if (!characterIds.length) return null;

  const safeValues = characterIds.map((id) => Math.max(0, importance[id] ?? 0));
  const providedTotal = safeValues.reduce((sum, value) => sum + value, 0);
  const shares = providedTotal > 0
    ? safeValues.map((value) => value / providedTotal)
    : characterIds.map(() => 1 / characterIds.length);
  const gapAngle = characterIds.length > 1 ? Math.min(5, 120 / characterIds.length) : 0;
  let offsetAngle = 0;

  return (
    <g className="event-map-arcs" transform={`rotate(-90 ${centerX} ${centerY})`}>
      {characterIds.map((id, index) => {
        const share = shares[index];
        const sweepAngle = Math.max(0, 360 * share - gapAngle);
        const commonProps = {
          fill: "none",
          stroke: colors.get(id) ?? CHARACTER_COLORS[index % CHARACTER_COLORS.length],
          onPointerEnter: (event: ReactPointerEvent<SVGElement>) =>
            onHover(labels.get(id) ?? id, event.clientX, event.clientY),
          onPointerMove: (event: ReactPointerEvent<SVGElement>) =>
            onHover(labels.get(id) ?? id, event.clientX, event.clientY),
          onPointerLeave: onLeave,
        };
        const node = characterIds.length === 1 ? (
          <circle
            key={id}
            {...commonProps}
            cx={centerX}
            cy={centerY}
            r={radius}
          >
            <title>{labels.get(id) ?? id}</title>
          </circle>
        ) : (
          <path
            key={id}
            {...commonProps}
            d={describeArc(centerX, centerY, radius, offsetAngle + gapAngle / 2, sweepAngle)}
          >
            <title>{labels.get(id) ?? id}</title>
          </path>
        );
        offsetAngle += 360 * share;
        return node;
      })}
    </g>
  );
}

function describeArc(centerX: number, centerY: number, radius: number, startAngle: number, sweepAngle: number) {
  const toPoint = (angle: number) => {
    const radians = angle * Math.PI / 180;
    return {
      x: centerX + radius * Math.cos(radians),
      y: centerY + radius * Math.sin(radians),
    };
  };
  const start = toPoint(startAngle);
  const end = toPoint(startAngle + sweepAngle);
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${sweepAngle > 180 ? 1 : 0} 1 ${end.x} ${end.y}`;
}

function normalizeEvents(events: NarrativeEvent[]) {
  return events
    .map((event, index): VisualEvent => ({
      id: String(event.id || `event-${index + 1}`),
      order: Number.isFinite(event.order) ? event.order : index + 1,
      description: event.description || "Untitled event",
      location: event.location?.trim() || "未标明地点",
      characters: Array.isArray(event.characters) ? event.characters.map(String) : [],
      characterImportance: Object.fromEntries(
        Object.entries(event.character_importance ?? {}).map(([id, value]) => [id, Number(value) || 0]),
      ),
      importance: normalizeImportance(event.importance),
      evidence: event.evidence || "",
    }))
    .filter((event) => event.description.trim().length > 0);
}

function normalizeImportance(value: NarrativeEvent["importance"]) {
  return value === "high" || value === "medium" || value === "low" ? value : "medium";
}
