import type { CurrentStoryScope } from "../utils/readingScope";
import type {
  Character,
  Event as NarrativeEvent,
  NarrativeJsonResponse,
  Relation,
} from "../types/narrative";
import { CharacterGraph } from "./CharacterGraph";
import { EventTimeline } from "./EventTimeline";

type NarrativeDebugPanelProps = {
  error: string;
  isLoading: boolean;
  result: NarrativeJsonResponse | null;
  scope: CurrentStoryScope | null;
};

export function NarrativeDebugPanel({
  error,
  isLoading,
  result,
  scope,
}: NarrativeDebugPanelProps) {
  const preview = scope?.text.slice(0, 300) ?? "";

  return (
    <aside className="narrative-debug-panel" aria-label="Narrative JSON Debug Panel">
      <header className="narrative-debug-header">
        <div>
          <span>Narrative JSON</span>
          <strong>{result?.story_title || scope?.title || "Current Story"}</strong>
        </div>
        {isLoading && <em>Extracting...</em>}
      </header>

      <section className="narrative-debug-section">
        <h3>Current Story Title</h3>
        <p>{scope?.title || "N/A"}</p>
      </section>

      <section className="narrative-debug-grid" aria-label="Parse range">
        <div>
          <span>startIndex</span>
          <strong>{scope?.startIndex ?? result?.range?.startIndex ?? "N/A"}</strong>
        </div>
        <div>
          <span>endIndex</span>
          <strong>{scope?.endIndex ?? result?.range?.endIndex ?? "N/A"}</strong>
        </div>
        <div>
          <span>Parse Text Length</span>
          <strong>{scope?.text.length ?? 0}</strong>
        </div>
      </section>

      <section className="narrative-debug-section">
        <h3>Parse Text Preview</h3>
        <details open>
          <summary>Preview</summary>
          <pre>{preview}{scope && scope.text.length > 300 ? "..." : ""}</pre>
        </details>
      </section>

      {error && <div className="narrative-debug-error">{error}</div>}

      <CharacterGraph result={result} />

      <EventTimeline events={result?.events ?? []} />

      <section className="narrative-debug-section">
        <h3>Characters</h3>
        {result?.characters.length ? (
          <div className="narrative-debug-list">
            {result.characters.map((character) => (
              <CharacterItem character={character} key={character.id || character.name} />
            ))}
          </div>
        ) : (
          <p>No characters yet.</p>
        )}
      </section>

      <section className="narrative-debug-section">
        <h3>Events</h3>
        {result?.events.length ? (
          <div className="narrative-debug-list">
            {result.events.map((event) => (
              <EventItem event={event} key={event.id || event.order} />
            ))}
          </div>
        ) : (
          <p>No events yet.</p>
        )}
      </section>

      <section className="narrative-debug-section">
        <h3>Relations</h3>
        {result?.relations.length ? (
          <div className="narrative-debug-list">
            {result.relations.map((relation) => (
              <RelationItem
                key={relation.id || `${relation.source}-${relation.target}`}
                relation={relation}
              />
            ))}
          </div>
        ) : (
          <p>No relations yet.</p>
        )}
      </section>

      <section className="narrative-debug-section">
        <h3>Raw JSON</h3>
        <pre>{JSON.stringify(result ?? {}, null, 2)}</pre>
      </section>
    </aside>
  );
}

function CharacterItem({ character }: { character: Character }) {
  return (
    <article className="narrative-debug-item">
      <header>
        <strong>{character.name}</strong>
        <span>{formatConfidence(character.confidence)}</span>
      </header>
      <dl>
        <dt>aliases</dt>
        <dd>{character.aliases.length ? character.aliases.join(", ") : "N/A"}</dd>
        <dt>description</dt>
        <dd>{character.description || "N/A"}</dd>
        <dt>evidence</dt>
        <dd>{character.evidence || "N/A"}</dd>
      </dl>
    </article>
  );
}

function EventItem({ event }: { event: NarrativeEvent }) {
  return (
    <article className="narrative-debug-item">
      <header>
        <strong>{event.order}. {event.description}</strong>
        <span>{event.importance}</span>
      </header>
      <dl>
        <dt>characters</dt>
        <dd>{event.characters.length ? event.characters.join(", ") : "N/A"}</dd>
        <dt>evidence</dt>
        <dd>{event.evidence || "N/A"}</dd>
      </dl>
    </article>
  );
}

function RelationItem({ relation }: { relation: Relation }) {
  return (
    <article className="narrative-debug-item">
      <header>
        <strong>{relation.source} → {relation.target}</strong>
        <span>{relation.relation_type} · {formatConfidence(relation.confidence)}</span>
      </header>
      <dl>
        <dt>description</dt>
        <dd>{relation.description || "N/A"}</dd>
        <dt>evidence</dt>
        <dd>{relation.evidence || "N/A"}</dd>
      </dl>
    </article>
  );
}

function formatConfidence(value: number) {
  if (!Number.isFinite(value)) return "N/A";
  return `${Math.round(Math.min(Math.max(value, 0), 1) * 100)}%`;
}
