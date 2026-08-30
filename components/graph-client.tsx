"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  useReactFlow,
  useNodesState,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Filter, RotateCcw, Search } from "lucide-react";
import type { Evidence, GraphAnalysis, GraphEdge, GraphNode } from "@thread/shared";
import { DetailPanel } from "@/components/detail-panel";
import { PageIntro, SummaryBand } from "@/components/page-shell";

type ThreadNodeData = GraphNode & { label: string } & Record<string, unknown>;

function ThreadNode({ data }: NodeProps<Node<ThreadNodeData>>) {
  return (
    <article className="thread-flow-node" data-kind={data.kind}>
      <Handle type="target" position={Position.Top} />
      <VStack gap={2}>
        <Badge label={data.kind.toUpperCase()} variant={data.kind === "gap" ? "yellow" : data.kind === "evidence" ? "green" : "neutral"} />
        <Text weight="semibold" maxLines={3}>{data.label}</Text>
        <Text type="supporting" color="secondary" maxLines={2}>{data.detail}</Text>
      </VStack>
      <Handle type="source" position={Position.Bottom} />
    </article>
  );
}

const nodeTypes = { thread: ThreadNode };
/*
 * Layout geometry.
 *
 * The previous version pinned each kind to a hardcoded origin and gave claims four columns at a
 * 300px pitch starting at x=40, which put the fourth claim at x=940 — and since a node is up to
 * 240px wide, its right edge reached 1180, straight through the gap column that started at 1040.
 * Rows were pitched at 190px while a node with three lines of label plus two of detail is taller
 * than that, so rows collided vertically too.
 *
 * Now each kind gets its own horizontal band, stacked with a gap, and the cell pitch is the node
 * box plus a gutter. Overlap is impossible by construction rather than by choosing origins that
 * happen not to collide: a band never shares a row with another band, and within a band the
 * pitch always exceeds the node's maximum box.
 */
const NODE_WIDTH = 240;
const NODE_MAX_HEIGHT = 180; /* measured ceiling is 174 with 3 label lines + 2 detail lines */
const COLUMN_GUTTER = 60;
const ROW_GUTTER = 52;
const COLUMN_PITCH = NODE_WIDTH + COLUMN_GUTTER;
const ROW_PITCH = NODE_MAX_HEIGHT + ROW_GUTTER;
const BAND_GAP = 90;
const MAX_COLUMNS = 5;
const BAND_ORDER: GraphNode["kind"][] = ["question", "claim", "gap", "evidence", "source"];

function FlowReset() {
  const flow = useReactFlow();
  return <Button label="Reset graph" icon={<RotateCcw />} onClick={() => flow.fitView({ duration: 350, padding: 0.2 })} />;
}

function AutoFit({ signature }: { signature: string }) {
  const flow = useReactFlow();
  useEffect(() => {
    const frame = requestAnimationFrame(() => flow.fitView({ duration: 240, padding: 0.18 }));
    return () => cancelAnimationFrame(frame);
  }, [flow, signature]);
  return null;
}

function GraphCanvas({ initialNodes, edges, onNodeClick }: { initialNodes: Node<ThreadNodeData>[]; edges: Edge[]; onNodeClick: (_: React.MouseEvent, node: Node<ThreadNodeData>) => void }) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  useEffect(() => setNodes(initialNodes), [initialNodes, setNodes]);
  return (
    <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onNodeClick={onNodeClick} fitView nodesDraggable nodesConnectable={false} panOnDrag zoomOnScroll minZoom={0.25} maxZoom={1.7}>
      <AutoFit signature={initialNodes.map((node) => node.id).join(":")} />
      <Background variant={BackgroundVariant.Dots} color="var(--color-border-emphasized)" gap={18} size={1.2} />
      <MiniMap pannable zoomable nodeColor={(node) => node.data?.kind === "gap" ? "var(--color-warning)" : "var(--color-accent)"} />
      <Controls showInteractive={false} />
      <Panel position="top-right"><FlowReset /></Panel>
    </ReactFlow>
  );
}

export function GraphClient({
  graph,
  evidence,
}: {
  graph: { nodes: GraphNode[]; edges: GraphEdge[]; analysis: GraphAnalysis };
  evidence: Evidence[];
}) {
  const [query, setQuery] = useState("");
  const [visibleKinds, setVisibleKinds] = useState<Set<GraphNode["kind"]>>(new Set(["question", "claim", "gap"]));
  const [density, setDensity] = useState<"focus" | "all">("focus");
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
  const setView = (kinds: GraphNode["kind"][]) => setVisibleKinds(new Set(kinds));

  const connectionCount = useMemo(() => {
    const counts = new Map<string, number>();
    graph.edges.forEach((edge) => {
      counts.set(edge.source, (counts.get(edge.source) ?? 0) + 1);
      counts.set(edge.target, (counts.get(edge.target) ?? 0) + 1);
    });
    return counts;
  }, [graph.edges]);

  const nodes = useMemo(() => {
    const focusLimits: Record<GraphNode["kind"], number> = { question: 1, claim: 8, gap: 5, evidence: 6, source: 4 };
    const focusCounts = new Map<GraphNode["kind"], number>();
    const visible = graph.nodes
      .filter((node) => visibleKinds.has(node.kind))
      .filter((node) => `${node.label} ${node.detail}`.toLowerCase().includes(query.toLowerCase()))
      .sort((left, right) => ((connectionCount.get(right.id) ?? 0) - (connectionCount.get(left.id) ?? 0)) || ((right.confidence ?? 0) - (left.confidence ?? 0)))
      .filter((node) => {
        if (density === "all" || query) return true;
        const count = focusCounts.get(node.kind) ?? 0;
        focusCounts.set(node.kind, count + 1);
        return count < focusLimits[node.kind];
      })
      .reduce<GraphNode[]>((all, node) => { all.push(node); return all; }, []);

    /* Group into bands first: a node's position depends on how many peers precede it. */
    const byKind = new Map<GraphNode["kind"], GraphNode[]>();
    for (const node of visible) {
      const bucket = byKind.get(node.kind);
      if (bucket) bucket.push(node);
      else byKind.set(node.kind, [node]);
    }

    const placed: Node<ThreadNodeData>[] = [];
    let bandTop = 20;
    for (const kind of BAND_ORDER) {
      const bandNodes = byKind.get(kind);
      if (!bandNodes?.length) continue;
      const columns = Math.min(MAX_COLUMNS, bandNodes.length);
      /* Narrow bands centre against the widest one so the graph does not read left-heavy. */
      const bandLeft = 40 + ((MAX_COLUMNS - columns) * COLUMN_PITCH) / 2;
      bandNodes.forEach((node, index) => {
        placed.push({
          id: node.id,
          type: "thread",
          data: { ...node, label: node.label },
          position: {
            x: bandLeft + (index % columns) * COLUMN_PITCH,
            y: bandTop + Math.floor(index / columns) * ROW_PITCH,
          },
        } satisfies Node<ThreadNodeData>);
      });
      bandTop += Math.ceil(bandNodes.length / columns) * ROW_PITCH + BAND_GAP;
    }
    return placed;
  }, [connectionCount, density, graph.nodes, query, visibleKinds]);

  const nodeIds = useMemo(() => new Set(nodes.map((node) => node.id)), [nodes]);
  const edges = useMemo(
    () =>
      graph.edges
        .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
        .map(
          (edge) =>
            ({
              id: edge.id,
              source: edge.source,
              target: edge.target,
              label: edge.relation === "related_to" ? undefined : edge.relation.replaceAll("_", " "),
              type: "smoothstep",
              animated: edge.relation === "contradicts",
              style: {
                stroke: edge.relation === "contradicts" ? "var(--color-error)" : "var(--color-border-emphasized)",
              },
              labelStyle: { fill: "var(--color-text-secondary)" },
            }) satisfies Edge,
        ),
    [graph.edges, nodeIds],
  );
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node<ThreadNodeData>) => setSelected(node.data), []);

  return (
    <VStack gap={6}>
      <PageIntro
        crumbs={[{ label: "Evidence", href: "/graph" }, { label: "Evidence map" }]}
        eyebrow="KNOWLEDGE GRAPH"
        title="Evidence has a shape."
        question="Sources become evidence, evidence supports claims, conflicts expose boundary conditions, and gaps generate the next question."
        actions={<TextInput label="Search graph" isLabelHidden value={query} onChange={setQuery} placeholder="Find nodes…" startIcon={<Search />} hasClear width={280} />}
      />
      <SummaryBand
        label="Graph summary"
        stats={[
          { label: "Nodes", value: graph.nodes.length, detail: "Questions, claims, evidence, gaps" },
          { label: "Links", value: graph.edges.length, detail: "Typed relationships" },
          { label: "Opposing links", value: graph.analysis.contradictionCount, detail: "Claims that disagree", emphasis: graph.analysis.contradictionCount > 0 },
          { label: "Components", value: graph.analysis.connectedComponents, detail: "Disconnected clusters" },
        ]}
      />
      <header className="page-header graph-controls">
        <VStack gap={4}>
          <HStack gap={2} align="center" wrap="wrap">
            <Filter />
            <Button label="Focus strongest" variant={density === "focus" ? "primary" : "secondary"} size="sm" onClick={() => setDensity("focus")} />
            <Button label="All nodes" variant={density === "all" ? "primary" : "secondary"} size="sm" onClick={() => setDensity("all")} />
            <Button label="Claims + gaps" variant={visibleKinds.size === 3 ? "primary" : "secondary"} size="sm" onClick={() => setView(["question", "claim", "gap"])} />
            <Button label="Include evidence" variant={visibleKinds.has("evidence") && !visibleKinds.has("source") ? "primary" : "secondary"} size="sm" onClick={() => setView(["question", "claim", "gap", "evidence"])} />
            <Button label="Show full provenance" variant={visibleKinds.has("source") ? "primary" : "secondary"} size="sm" onClick={() => setView(["question", "claim", "gap", "evidence", "source"])} />
          </HStack>
        </VStack>
      </header>
      <section className="graph-shell" aria-label="Interactive evidence graph">
        <GraphCanvas initialNodes={nodes} edges={edges} onNodeClick={onNodeClick} />
      </section>
      <HStack justify="between" gap={4} wrap="wrap">
        <Text color="secondary">Focus view ranks highly connected nodes first. Switch to all nodes when you need the complete topology.</Text>
        <HStack gap={3} wrap="wrap"><Badge label={`${nodes.length} of ${graph.nodes.length} nodes`} /><Badge label={`${edges.length} visible relationships`} /></HStack>
      </HStack>
      <section className="section-rule" aria-label="Graph intelligence and visual analysis">
        <VStack gap={5}>
          <VStack gap={2}>
            <HStack gap={2} align="center"><Badge label="GRAPH INTELLIGENCE" variant="blue" /><Badge label={`${graph.analysis.connectedComponents} connected component${graph.analysis.connectedComponents === 1 ? "" : "s"}`} /><Badge label={`${graph.analysis.contradictionCount} opposing links`} variant={graph.analysis.contradictionCount ? "red" : "neutral"} /></HStack>
            <Heading level={2}>How the research structure behaves</Heading>
            <Text color="secondary">These findings use the saved claim comparisons, contradiction checks, source provenance, and graph topology—not visual proximity alone.</Text>
          </VStack>
          <Grid columns={{ minWidth: 300, max: 3, repeat: "fit" }} gap={4} align="start">
            <Card padding={5}>
              <VStack gap={4}>
                <Heading level={3}>Structural findings</Heading>
                <ul className="plain-list">{graph.analysis.findings.map((finding) => <li key={finding}><Text>→ {finding}</Text></li>)}</ul>
              </VStack>
            </Card>
            <Card padding={5}>
              <VStack gap={4}>
                <Heading level={3}>Relationship mix</Heading>
                {graph.analysis.relationDistribution.map((item) => <ProgressBar key={item.relation} label={item.relation.replaceAll("_", " ")} value={graph.edges.length ? Math.round((item.count / graph.edges.length) * 100) : 0} hasValueLabel variant={item.relation === "contradicts" ? "error" : "accent"} />)}
              </VStack>
            </Card>
            <Card padding={5}>
              <VStack gap={4}>
                <Heading level={3}>High-impact connectors</Heading>
                {graph.analysis.strongestConnectors.length ? graph.analysis.strongestConnectors.map((node, index) => <HStack key={node.id} justify="between" gap={3}><HStack gap={2}><Text className="row-index">{String(index + 1).padStart(2, "0")}</Text><Text weight="semibold" maxLines={2}>{node.label}</Text></HStack><Badge label={`${node.connections} links`} /></HStack>) : <Text color="secondary">Add and compare claims to reveal connector points.</Text>}
              </VStack>
            </Card>
          </Grid>
          <Card variant="muted" padding={5}>
            <VStack gap={3}><Heading level={3}>Recommended graph actions</Heading><ul className="plain-list">{graph.analysis.nextActions.map((action) => <li key={action}><Text>→ {action}</Text></li>)}</ul></VStack>
          </Card>
        </VStack>
      </section>
      {selected ? (
        <DetailPanel
          eyebrow="Graph node"
          title={selected.label}
          onClose={() => setSelected(null)}
          meta={
            <>
              <Badge label={selected.kind.toUpperCase()} variant={selected.kind === "gap" ? "yellow" : "blue"} />
              {selected.confidence ? <Badge label={`${Math.round(selected.confidence * 100)}% confidence`} /> : null}
            </>
          }
          summary={<Text>{selected.detail}</Text>}
          footer={<Button label="Open in research book" href={`/research?query=${encodeURIComponent(selected.label)}`} variant="primary" width="100%" />}
        >
          <VStack gap={3}>
            <Heading level={3}>Evidence provenance</Heading>
            {selected.evidenceIds?.length ? (
              <ul className="provenance-list">
                {selected.evidenceIds.map((id) => (
                  <li key={id}>
                    <VStack gap={1}>
                      <Text type="supporting" color="secondary">{id}</Text>
                      <Text>“{evidenceById.get(id)?.selectedText ?? "Linked evidence is outside the visible graph slice."}”</Text>
                    </VStack>
                  </li>
                ))}
              </ul>
            ) : (
              <Text color="secondary">This node is structural — no evidence item is attached to it directly.</Text>
            )}
          </VStack>
        </DetailPanel>
      ) : null}
    </VStack>
  );
}
