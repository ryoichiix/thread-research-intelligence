"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { ArrowUpRight, Compass, Search } from "lucide-react";
import { DetailPanel } from "@/components/detail-panel";
import { PageIntro, SummaryBand } from "@/components/page-shell";
import type { ResearchTask } from "@thread/shared";

interface SearchResult {
  id: string;
  url: string;
  title: string;
  snippet: string;
  relevance: number | null;
  scholarUrl?: string;
  doi?: string;
  citationCount?: number;
  citationProvider?: string;
  authors?: string[];
  journal?: string;
  year?: number | null;
}

export function NextResearchClient({ tasks, projectId }: { tasks: ResearchTask[]; projectId: string }) {
  const router = useRouter();
  const [active, setActive] = useState<ResearchTask | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [message, setMessage] = useState("");
  const [decisions, setDecisions] = useState<Record<string, "saved" | "rejected">>({});
  const [decisionPending, setDecisionPending] = useState<string | null>(null);
  const highValueCount = tasks.filter((task) => task.expectedValue === "High").length;
  const evidenceOnHand = tasks.reduce((total, task) => total + task.evidenceAvailable, 0);

  const investigate = async (task: ResearchTask) => {
    setActive(task);
    setLoading(true);
    setResults([]);
    setMessage("");
    try {
      const response = await fetch("/api/research/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, query: task.suggestedSearches[0] }),
      });
      const payload = await response.json();
      setResults(payload.results ?? []);
      setConfigured(Boolean(payload.configured));
      setMessage(payload.message ?? "");
    } catch {
      setConfigured(false);
      setMessage("Live search is unavailable. The generated queries below still open in your browser.");
    } finally {
      setLoading(false);
    }
  };
  const decide = async (result: SearchResult, status: "saved" | "rejected") => {
    setDecisionPending(result.id);
    try {
      const response = await fetch("/api/research/search/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: result.id, projectId, status }),
      });
      if (!response.ok) throw new Error("The source decision could not be saved.");
      setDecisions((current) => ({ ...current, [result.id]: status }));
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The source decision could not be saved.");
    } finally {
      setDecisionPending(null);
    }
  };

  return (
    <VStack gap={8}>
      <PageIntro
        crumbs={[{ label: "Output" }, { label: "Next moves" }]}
        eyebrow="WHAT SHOULD YOU INVESTIGATE NEXT?"
        icon={<Compass />}
        title="Turn uncertainty into a research plan."
        question="Each task is derived from current coverage, conflicts, and missing evidence—not a generic reading list."
        actions={<Button label="Review knowledge gaps" href="/gaps" size="sm" />}
      />
      <SummaryBand
        label="Research plan summary"
        stats={[
          { label: "Ranked tasks", value: tasks.length, emphasis: true },
          { label: "High value", value: highValueCount, detail: "Most likely to move readiness" },
          { label: "Evidence on hand", value: evidenceOnHand, detail: "Across every ranked task" },
          { label: "Top priority", value: tasks[0] ? "01" : "—", detail: tasks[0]?.title },
        ]}
      />
      <section aria-label="Ranked research tasks">
        {tasks.map((task, index) => (
          <article className="task-row" key={task.id}>
            <HStack justify="between" align="center" gap={6} wrap="wrap">
              <HStack gap={4} align="start">
                <Text className="row-index">{String(index + 1).padStart(2, "0")}</Text>
                <VStack gap={2} maxWidth="720px">
                  <HStack gap={2} wrap="wrap"><Badge label={`${task.expectedValue.toUpperCase()} VALUE`} variant={task.expectedValue === "High" ? "blue" : "neutral"} /><Badge label={`${task.evidenceAvailable} evidence available`} /></HStack>
                  <Heading level={3}>{task.title}</Heading>
                  <Text color="secondary">{task.reason}</Text>
                  <Text type="supporting" color="secondary">Missing: {task.missingEvidence}</Text>
                </VStack>
              </HStack>
              <Button label="Investigate" variant={index === 0 ? "primary" : "secondary"} icon={<Search />} onClick={() => investigate(task)} />
            </HStack>
          </article>
        ))}
      </section>
      {active ? (
        <DetailPanel
          size="lg"
          eyebrow="Investigate"
          title={active.title}
          onClose={() => setActive(null)}
          meta={
            <>
              <Badge label={`${active.expectedValue.toUpperCase()} VALUE`} variant={active.expectedValue === "High" ? "blue" : "neutral"} />
              <Badge label={`${active.evidenceAvailable} evidence available`} />
            </>
          }
          summary={
            <VStack gap={2}>
              <Text type="supporting" color="secondary" className="detail-panel-eyebrow">Why this is next</Text>
              <Text>{active.reason}</Text>
              <Text type="supporting" color="secondary">Missing: {active.missingEvidence}</Text>
            </VStack>
          }
          tabs={[
            {
              value: "sources",
              label: "Ranked sources",
              badge: results.length ? String(results.length) : undefined,
              content: (
                <VStack gap={3}>
                  {loading ? <Text color="secondary">Searching scholarly metadata and citation records…</Text> : null}
                  {!loading && configured === false ? (
                    <section className="status-banner is-warning">
                      <VStack gap={2}>
                        <Text weight="semibold">Wider web search is not configured</Text>
                        <Text color="secondary">{message}</Text>
                      </VStack>
                    </section>
                  ) : null}
                  {!loading && results.length === 0 && configured !== false ? (
                    <Text color="secondary">No scholarly candidates came back for this query. Try one of the search queries in the next tab.</Text>
                  ) : null}
                  {results.map((result) => (
                    <article className="detail-row" key={result.id}>
                      <VStack gap={2}>
                        <HStack justify="between" align="start" gap={3} wrap="wrap">
                          <Text weight="semibold" maxLines={2}>{result.title}</Text>
                          <HStack gap={2} wrap="wrap">
                            {typeof result.citationCount === "number" ? <Badge label={`${result.citationCount.toLocaleString()} CITED`} variant={result.citationCount >= 100 ? "green" : "neutral"} /> : null}
                            {result.relevance ? <Badge label={`${Math.round(result.relevance * 100)}% MATCH`} /> : null}
                          </HStack>
                        </HStack>
                        <Text color="secondary" maxLines={2}>{result.snippet}</Text>
                        {result.doi ? <Text type="supporting" color="secondary" maxLines={1}>{[result.journal, result.year, `DOI ${result.doi}`].filter(Boolean).join(" · ")}</Text> : null}
                        <HStack gap={2} wrap="wrap">
                          <Button label={decisions[result.id] === "saved" ? "Saved" : "Save"} size="sm" variant="primary" isLoading={decisionPending === result.id} isDisabled={Boolean(decisions[result.id])} onClick={() => decide(result, "saved")} />
                          <Button label={decisions[result.id] === "rejected" ? "Rejected" : "Reject"} size="sm" variant="ghost" isDisabled={Boolean(decisions[result.id]) || decisionPending === result.id} onClick={() => decide(result, "rejected")} />
                          <Button label={result.doi ? "Publisher record" : "Preview source"} href={result.url} target="_blank" rel="noopener noreferrer" size="sm" variant="ghost" endContent={<ArrowUpRight />} />
                          {result.scholarUrl ? <Button label="Scholar" href={result.scholarUrl} target="_blank" rel="noopener noreferrer" size="sm" variant="ghost" endContent={<ArrowUpRight />} /> : null}
                        </HStack>
                      </VStack>
                    </article>
                  ))}
                </VStack>
              ),
            },
            {
              value: "searches",
              label: "Search queries",
              badge: String(active.suggestedSearches.length),
              content: (
                <VStack gap={3}>
                  {active.suggestedSearches.map((query) => (
                    <article className="detail-row" key={query}>
                      <HStack justify="between" align="center" gap={3} wrap="wrap">
                        <Text maxLines={2}>{query}</Text>
                        <Button label="Google Scholar" href={`https://scholar.google.com/scholar?q=${encodeURIComponent(query)}`} target="_blank" rel="noopener noreferrer" size="sm" variant="ghost" endContent={<ArrowUpRight />} />
                      </HStack>
                    </article>
                  ))}
                </VStack>
              ),
            },
            {
              value: "method",
              label: "How this was ranked",
              content: (
                <VStack gap={4}>
                  <VStack gap={1}>
                    <Text weight="semibold">Expected value</Text>
                    <Text color="secondary">Ranked {active.expectedValue.toLowerCase()} from current topic coverage, open contradictions, and how much evidence already supports this thread.</Text>
                  </VStack>
                  <VStack gap={1}>
                    <Text weight="semibold">Evidence on hand</Text>
                    <Text color="secondary">{active.evidenceAvailable === 1 ? "1 captured item already touches" : `${active.evidenceAvailable} captured items already touch`} this topic.</Text>
                  </VStack>
                  <VStack gap={1}>
                    <Text weight="semibold">Still missing</Text>
                    <Text color="secondary">{active.missingEvidence}</Text>
                  </VStack>
                  <VStack gap={1}>
                    <Text weight="semibold">Citation counts</Text>
                    <Text color="secondary">Totals are Crossref Cited-by counts, not Google Scholar. Use the Scholar link on a source to check its current Scholar count.</Text>
                  </VStack>
                </VStack>
              ),
            },
          ]}
        />
      ) : null}
    </VStack>
  );
}
