import cytoscape, { type Core, type ElementDefinition, type StylesheetJson } from "cytoscape";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Character, NarrativeJsonResponse, Relation } from "../types/narrative";

type CharacterGraphProps = {
  result: NarrativeJsonResponse | null;
  onClose?: () => void;
};

type SidebarCharacterRelationsProps = {
  result: NarrativeJsonResponse | null;
  onExpand?: () => void;
  obscured?: boolean;
};

type RelationEdge = {
  id: string;
  source: string;
  target: string;
  label: string;
  type: Relation["relation_type"] | "co_occurrence";
  confidence: number;
  inferred: boolean;
};

const relationLabels: Record<RelationEdge["type"], string> = {
  spouse: "伴侣",
  family: "家人",
  friend: "朋友",
  conflict: "冲突",
  acquaintance: "相识",
  unknown: "未知",
  other: "关系",
  co_occurrence: "同场",
};

const relationColors: Record<RelationEdge["type"], string> = {
  spouse: "#b35c5c",
  family: "#927042",
  friend: "#5e7e71",
  conflict: "#8f4b36",
  acquaintance: "#7b7f68",
  unknown: "#9a948b",
  other: "#7a756d",
  co_occurrence: "#b7ad9f",
};

export function CharacterGraph({ result, onClose }: CharacterGraphProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const graph = useMemo(() => buildGraph(result), [result]);
  const selectedCharacter = graph.characters.find((character) => character.id === selectedId) ?? graph.characters[0];

  useEffect(() => {
    const container = containerRef.current;
    if (!container || graph.elements.length === 0) return;

    const cy = cytoscape({
      container,
      elements: graph.elements,
      minZoom: 0.42,
      maxZoom: 2.6,
      wheelSensitivity: 0.18,
      style: [
        {
          selector: "node",
          style: {
            "background-color": "data(color)",
            "border-color": "#f8f4ed",
            "border-width": 2,
            color: "#2f2d29",
            "font-family": "LXGW WenKai, PingFang SC, sans-serif",
            "font-size": 11,
            height: "data(size)",
            label: "data(label)",
            "overlay-opacity": 0,
            "text-background-color": "#fbfaf7",
            "text-background-opacity": 0.86,
            "text-background-padding": "3px",
            "text-margin-y": 9,
            "text-valign": "bottom",
            width: "data(size)",
          },
        },
        {
          selector: "node:selected",
          style: {
            "border-color": "#7b8d55",
            "border-width": 3,
          },
        },
        {
          selector: "edge",
          style: {
            "curve-style": "bezier",
            "font-family": "LXGW WenKai, PingFang SC, sans-serif",
            "font-size": 9,
            label: "data(label)",
            "line-color": "data(color)",
            opacity: 0.86,
            "target-arrow-color": "data(color)",
            "target-arrow-shape": "triangle",
            "text-background-color": "#fbfaf7",
            "text-background-opacity": 0.82,
            "text-background-padding": "2px",
            "text-rotation": "autorotate",
            width: "data(width)",
          },
        },
        {
          selector: "edge[inferred = 'yes']",
          style: {
            "line-style": "dashed",
            "target-arrow-shape": "none",
            opacity: 0.52,
          },
        },
        {
          selector: "edge:selected",
          style: {
            opacity: 1,
            width: 3,
          },
        },
      ],
      layout: {
        name: "cose",
        animate: false,
        componentSpacing: 64,
        idealEdgeLength: 112,
        nodeOverlap: 14,
        padding: 56,
      },
    });

    cyRef.current = cy;
    setSelectedId((current) => current || graph.characters[0]?.id || "");

    cy.on("tap", "node", (event) => {
      setSelectedId(event.target.id());
    });

    const resizeObserver = new ResizeObserver(() => {
      cy.resize();
      cy.fit(undefined, 28);
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      cy.destroy();
      cyRef.current = null;
    };
  }, [graph]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !selectedId) return;
    cy.$("node").unselect();
    const node = cy.$id(selectedId);
    if (!node.empty()) {
      node.select();
      cy.animate({ center: { eles: node }, zoom: Math.max(cy.zoom(), 1) }, { duration: 220 });
    }
  }, [selectedId]);

  if (!result) {
    return (
      <section className="character-graph-panel" aria-label="人物关系图">
        <GraphEmptyState title="等待 Narrative JSON" description="点击左侧 AI 按钮抽取后，这里会显示人物关系图。" />
      </section>
    );
  }

  if (graph.characters.length === 0) {
    return (
      <section className="character-graph-panel" aria-label="人物关系图">
        <GraphEmptyState title="还没有人物节点" description="当前 JSON 没有 characters，图谱需要至少一个角色才能生成。" />
      </section>
    );
  }

  return (
    <section className="character-graph-panel" aria-label="人物关系图">
      <header className="character-graph-header">
        <div>
          <h3>人物关系图</h3>
          <p>{graph.characters.length} 个角色 · {graph.edges.length} 条关系</p>
        </div>
        <div className="character-graph-actions">
          <button
            type="button"
            aria-label="刷新人物关系图布局"
            title="刷新"
            onClick={() => {
              const cy = cyRef.current;
              if (!cy) return;
              cy.layout({ name: "cose", animate: false, padding: 56 }).run();
              cy.fit(undefined, 56);
            }}
          >
            刷新
          </button>
          {onClose && (
            <button type="button" className="character-graph-close" onClick={onClose} aria-label="关闭人物关系图">
              关闭 ×
            </button>
          )}
        </div>
      </header>

      <div className="character-graph-shell">
        <div className="character-graph-canvas" ref={containerRef} />
        {selectedCharacter && (
          <aside className="character-graph-detail">
            <span>Selected</span>
            <strong>{selectedCharacter.name}</strong>
            <p>{selectedCharacter.description || selectedCharacter.evidence || "暂无描述。"}</p>
            <small>{formatConfidence(selectedCharacter.confidence)}</small>
          </aside>
        )}
      </div>
    </section>
  );
}

export function SidebarCharacterRelations({ result, onExpand, obscured = false }: SidebarCharacterRelationsProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const graph = useMemo(() => buildGraph(result), [result]);
  const selectedCharacter = graph.characters.find((character) => character.id === selectedId) ?? graph.characters[0];

  useEffect(() => {
    const container = containerRef.current;
    if (!container || graph.elements.length === 0) return;

    const cy = cytoscape({
      container,
      elements: graph.elements,
      minZoom: 0.55,
      maxZoom: 2.2,
      wheelSensitivity: 0.16,
      style: sidebarGraphStyle,
      layout: sidebarLayout,
    });

    cyRef.current = cy;
    setSelectedId((current) => current || graph.characters[0]?.id || "");
    cy.on("tap", "node", (event) => setSelectedId(event.target.id()));

    const resizeObserver = new ResizeObserver(() => {
      cy.resize();
      cy.fit(undefined, 24);
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      cy.destroy();
      cyRef.current = null;
    };
  }, [graph]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !selectedId) return;
    cy.$("node").unselect();
    const node = cy.$id(selectedId);
    if (!node.empty()) node.select();
  }, [selectedId]);

  if (!result || graph.characters.length === 0) return null;

  return (
    <aside className={`reader-side-relations${obscured ? " visual-gated" : ""}`} aria-label="人物关系图">
      <header className="reader-side-relations-header">
        <div>
          <h2>人物关系</h2>
          <p>{graph.characters.length} 人 · {graph.edges.length} 条关系</p>
        </div>
        <div className="reader-side-relations-actions">
          {onExpand && (
            <button type="button" onClick={onExpand} aria-label="展开人物关系图" title="展开">
              展开
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              const cy = cyRef.current;
              if (!cy) return;
              cy.layout({ ...sidebarLayout, animate: true, animationDuration: 220 }).run();
              cy.fit(undefined, 24);
            }}
            aria-label="刷新人物关系图布局"
            title="刷新"
          >
            刷新
          </button>
        </div>
      </header>
      <div className="reader-side-graph" ref={containerRef} aria-label="可交互人物关系图" />
      {selectedCharacter && (
        <div className="reader-side-graph-detail" aria-live="polite">
          <div>
            <span>已选人物</span>
            <strong>{selectedCharacter.name}</strong>
          </div>
          {(selectedCharacter.description || selectedCharacter.evidence) && (
            <p>{selectedCharacter.description || selectedCharacter.evidence}</p>
          )}
        </div>
      )}
    </aside>
  );
}

const sidebarLayout = {
  name: "cose" as const,
  animate: false,
  componentSpacing: 28,
  idealEdgeLength: 74,
  nodeOverlap: 10,
  padding: 24,
};

const sidebarGraphStyle: StylesheetJson = [
  {
    selector: "node",
    style: {
      "background-color": "data(color)", "border-color": "#fcfcfa", "border-width": 2,
      color: "#35332e", "font-family": "LXGW WenKai, PingFang SC, sans-serif", "font-size": 10,
      height: "data(size)", label: "data(label)", "overlay-opacity": 0,
      "text-background-color": "#fcfcfa", "text-background-opacity": 0.9, "text-background-padding": "2px",
      "text-margin-y": 7, "text-valign": "bottom", width: "data(size)",
    },
  },
  { selector: "node:selected", style: { "border-color": "#778653", "border-width": 3 } },
  {
    selector: "edge",
    style: {
      "curve-style": "bezier", "font-family": "LXGW WenKai, PingFang SC, sans-serif", "font-size": 8,
      label: "data(label)", "line-color": "data(color)", opacity: 0.78, "target-arrow-color": "data(color)",
      "target-arrow-shape": "triangle", "text-background-color": "#fcfcfa", "text-background-opacity": 0.86,
      "text-background-padding": "1px", "text-rotation": "autorotate", width: "data(width)",
    },
  },
  { selector: "edge[inferred = 'yes']", style: { "line-style": "dashed", "target-arrow-shape": "none", opacity: 0.48 } },
];

function GraphEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="character-graph-empty">
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

function buildGraph(result: NarrativeJsonResponse | null) {
  const characters = result?.characters ?? [];
  const characterByReference = new Map<string, Character>();

  characters.forEach((character) => {
    [character.id, character.name, ...character.aliases]
      .filter(Boolean)
      .forEach((reference) => characterByReference.set(normalizeReference(reference), character));
  });

  const relationEdges = (result?.relations ?? [])
    .map((relation): RelationEdge | null => {
      const source = characterByReference.get(normalizeReference(relation.source));
      const target = characterByReference.get(normalizeReference(relation.target));
      if (!source || !target || source.id === target.id) return null;

      return {
        id: relation.id || `${source.id}-${target.id}-${relation.relation_type}`,
        source: source.id,
        target: target.id,
        label: getRelationLabel(relation),
        type: relation.relation_type,
        confidence: relation.confidence,
        inferred: false,
      };
    })
    .filter((edge): edge is RelationEdge => Boolean(edge));

  const relationKeys = new Set(relationEdges.map((edge) => undirectedKey(edge.source, edge.target)));
  const coOccurrenceEdges = new Map<string, RelationEdge>();

  if (relationEdges.length === 0) {
    (result?.events ?? []).forEach((event) => {
      const eventCharacters = event.characters
        .map((reference) => characterByReference.get(normalizeReference(reference)))
        .filter((character): character is Character => Boolean(character));

      for (let sourceIndex = 0; sourceIndex < eventCharacters.length; sourceIndex += 1) {
        for (let targetIndex = sourceIndex + 1; targetIndex < eventCharacters.length; targetIndex += 1) {
          const source = eventCharacters[sourceIndex];
          const target = eventCharacters[targetIndex];
          const key = undirectedKey(source.id, target.id);
          if (relationKeys.has(key) || coOccurrenceEdges.has(key)) continue;
          coOccurrenceEdges.set(key, {
            id: `co-${key}`,
            source: source.id,
            target: target.id,
            label: relationLabels.co_occurrence,
            type: "co_occurrence",
            confidence: importanceWeight(event.importance),
            inferred: true,
          });
        }
      }
    });
  }

  const edges = [...relationEdges, ...coOccurrenceEdges.values()];
  const degreeByCharacter = new Map<string, number>();
  edges.forEach((edge) => {
    degreeByCharacter.set(edge.source, (degreeByCharacter.get(edge.source) ?? 0) + 1);
    degreeByCharacter.set(edge.target, (degreeByCharacter.get(edge.target) ?? 0) + 1);
  });

  const elements: ElementDefinition[] = [
    ...characters.map((character, index) => {
      const degree = degreeByCharacter.get(character.id) ?? 0;
      return {
        data: {
          id: character.id,
          label: character.name,
          size: 38 + Math.min(degree, 4) * 6,
          color: characterColor(index),
        },
      };
    }),
    ...edges.map((edge) => ({
      data: {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        color: relationColors[edge.type],
        width: edge.inferred ? 1.2 : 1.8 + edge.confidence,
        inferred: edge.inferred ? "yes" : "no",
      },
    })),
  ];

  return { characters, edges, elements };
}

function normalizeReference(value: string) {
  return value.trim().toLowerCase();
}

function getRelationLabel(relation: Relation) {
  const description = relation.description.trim();
  if (description && Array.from(description).length <= 12) {
    return description;
  }
  return relationLabels[relation.relation_type] ?? relation.relation_type;
}

function undirectedKey(source: string, target: string) {
  return [source, target].sort().join("--");
}

function characterColor(index: number) {
  const colors = ["#b8c79a", "#d0b98e", "#bfa7a0", "#9eb9b0", "#c5b6d4", "#d4a999"];
  return colors[index % colors.length];
}

function importanceWeight(importance: "high" | "medium" | "low") {
  if (importance === "high") return 0.9;
  if (importance === "medium") return 0.65;
  return 0.4;
}

function formatConfidence(value: number) {
  if (!Number.isFinite(value)) return "confidence N/A";
  return `confidence ${Math.round(Math.min(Math.max(value, 0), 1) * 100)}%`;
}
