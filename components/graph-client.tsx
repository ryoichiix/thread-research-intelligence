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
const kindPositions: Record<GraphNode["kind"], { x: number; y: number }> = {
  question: { x: 430, y: 20 },
  claim: { x: 40, y: 220 },
  gap: { x: 1040, y: 220 },
  evidence: { x: 40, y: 700 },
  source: { x: 40, y: 1160 },
};

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
    const counters = new Map<GraphNode["kind"], number>();
    const focusLimits: Record<GraphNode["kind"], number> = { question: 1, claim: 8, gap: 5, evidence: 6, source: 4 };
    const focusCounts = new Map<GraphNode["kind"], number>();
    return graph.nodes
      .filter((node) => visibleKinds.has(node.kind))
      .filter((node) => `${node.label} ${node.detail}`.toLowerCase().includes(query.toLowerCase()))
      .sort((left, right) => ((connectionCount.get(right.id) ?? 0) - (connectionCount.get(left.id) ?? 0)) || ((right.confidence ?? 0) - (left.confidence ?? 0)))
      .filter((node) => {
        if (density === "all" || query) return true;
        const count = focusCounts.get(node.kind) ?? 0;
        focusCounts.set(node.kind, count + 1);
        return count < focusLimits[node.kind];
      })
      .map((node) => {
        const count = counters.get(node.kind) ?? 0;
        counters.set(node.kind, count + 1);
        const base = kindPositions[node.kind];
        const columns = node.kind === "question" ? 1 : node.kind === "gap" ? 2 : 4;
        return {
          id: node.id,
          type: "thread",
          data: { ...node, label: node.label },
          position: {
            x: base.x + (count % columns) * 300,
            y: base.y + Math.floor(count / columns) * 190,
          },
        } satisfies Node<ThreadNodeData>;
      });
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
      <header className="page-header">
        <VStack gap={4}>
          <HStack justify="between" gap={6} align="end" wrap="wrap">
            <VStack gap={2} maxWidth="760px">
              <HStack gap={2} align="center"><Text type="supporting" color="secondary" className="page-eyebrow">KNOWLEDGE GRAPH</Text><Badge label="LIVE RELATIONSHIPS" variant="blue" /></HStack>
              <Heading level={1} type="display-3">Evidence has a shape.</Heading>
              <Text className="page-question">Sources become evidence, evidence supports claims, conflicts expose boundary conditions, and gaps generate the next question.</Text>
            </VStack>
            <TextInput label="Search graph" isLabelHidden value={query} onChange={setQuery} placeholder="Find nodes…" startIcon={<Search />} hasClear width={300} />
          </HStack>
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
