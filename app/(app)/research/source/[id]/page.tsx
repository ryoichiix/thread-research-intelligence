import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Citation } from "@astryxdesign/core/Citation";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Text } from "@astryxdesign/core/Text";
import { ArrowLeft, GitCompareArrows } from "lucide-react";
import { getCurrentResearch } from "@/lib/current-research";

export const metadata: Metadata = { title: "Source detail" };

export default async function SourceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const dataset = await getCurrentResearch("source");
  if (!dataset) notFound();
  const { id } = await params;
  const source = dataset.sources.find((item) => item.id === id);
  if (!source) notFound();
  const sourceEvidence = dataset.evidence.filter((item) => item.sourceId === source.id);
  const sourceClaims = dataset.claims.filter((claim) => claim.evidenceIds.some((id) => sourceEvidence.some((item) => item.id === id)));
  const conflicts = dataset.conflicts.filter((conflict) => [...conflict.supportingEvidence, ...conflict.contradictingEvidence].some((id) => sourceEvidence.some((item) => item.id === id)));
  const related = dataset.sources.filter((item) => item.id !== source.id && item.sourceType === source.sourceType).slice(0, 3);
  return (
    <section className="page-frame">
      <VStack gap={8}>
        <Button label="Back to research book" href="/research" variant="ghost" icon={<ArrowLeft />} />
        <header className="page-header">
          <VStack gap={4}>
            <HStack gap={2} wrap="wrap"><Badge label={source.documentType.replaceAll("_", " ")} /><StatusDot variant={source.authenticityScore >= 75 ? "success" : source.authenticityScore >= 50 ? "warning" : "error"} label={`${source.authenticityTier} authenticity · ${source.authenticityScore}/100`} /></HStack>
            <Heading level={1} type="display-3">{source.title}</Heading>
            <Text className="page-question">{source.summary}</Text>
            <Grid columns={{ minWidth: 240, max: 3, repeat: "fit" }} gap={4}>
              <Card variant="muted" padding={4}><VStack gap={1}><Text type="supporting" color="secondary">AUTHOR</Text><Text>{source.author}</Text></VStack></Card>
              <Card variant="muted" padding={4}><VStack gap={1}><Text type="supporting" color="secondary">PUBLICATION</Text><Text>{source.publicationDate || "Date unavailable"}</Text><Text type="supporting" color="secondary">{source.journal || source.publisher || "Venue unavailable"}</Text></VStack></Card>
              <Card variant="muted" padding={4}><VStack gap={1}><Text type="supporting" color="secondary">SCHOLARLY IDENTITY</Text><Text>{source.doi ? `DOI ${source.doi}` : "No DOI detected"}</Text><Text type="supporting" color="secondary">{source.citationCount ?? 0} recorded citations · {source.referenceCount ?? source.references.length} references</Text></VStack></Card>
            </Grid>
            <Button label="Open original source" href={source.url} target="_blank" rel="noopener noreferrer" />
          </VStack>
        </header>
        <Grid columns={{ minWidth: 360, max: 2, repeat: "fit" }} gap={6}>
          <VStack gap={4}>
            <Heading level={2}>Captured evidence</Heading>
            {sourceEvidence.length ? sourceEvidence.map((item) => <Card key={item.id} padding={4}><VStack gap={3}><HStack gap={2} wrap="wrap"><Badge label={item.stance} variant={item.stance === "contradicts" ? "red" : "green"} /><Badge label={item.id} /></HStack><Text>“{item.selectedText}”</Text><Text type="supporting" color="secondary">{item.methodology}</Text></VStack></Card>) : <Card padding={5}><Text>No evidence captured from this source yet.</Text></Card>}
          </VStack>
          <VStack gap={6}>
            <Card padding={5}>
              <VStack gap={4}>
                <HStack justify="between" gap={4} wrap="wrap"><VStack gap={1}><Heading level={3}>Source authenticity check</Heading><Text color="secondary">A provenance signal score—not a guarantee that every claim is true.</Text></VStack><StatusDot variant={source.authenticityScore >= 75 ? "success" : source.authenticityScore >= 50 ? "warning" : "error"} label={`${source.authenticityScore}/100`} /></HStack>
                <ul className="plain-list">{source.authenticitySignals.map((signal) => <li key={signal}><Text>→ {signal}</Text></li>)}</ul>
                <HStack gap={2} wrap="wrap"><Badge label={`Metadata: ${source.metadataProvider}`} /><Badge label={`Peer review: ${source.peerReviewStatus.replaceAll("_", " ")}`} /></HStack>
              </VStack>
            </Card>
            <Card variant="muted" padding={5}>
              <VStack gap={3}><Heading level={3}>Canonical citation</Heading><Citation variant="label" number={1} source={{ title: source.citationText || source.title, url: source.url }} /><Text>{source.citationText || "Citation metadata is incomplete. Re-capture the source page to extract scholarly metadata."}</Text>{source.citedByUrl ? <Button label={`Open ${source.citationCount ?? ""} citing works`} href={source.citedByUrl} target="_blank" rel="noopener noreferrer" /> : null}</VStack>
            </Card>
            <VStack gap={4}><Heading level={2}>Extracted claims</Heading>{sourceClaims.length ? sourceClaims.map((claim) => <Card key={claim.id} padding={4}><VStack gap={2}><Text weight="semibold">{claim.text}</Text><HStack gap={2}><Badge label={claim.topic} /><Badge label={`${Math.round(claim.confidence * 100)}%`} /></HStack></VStack></Card>) : <Card padding={5}><Text>No extracted claims yet.</Text></Card>}</VStack>
            <Card variant="muted" padding={5}><VStack gap={3}><Heading level={3}>Limitations</Heading><ul className="plain-list">{source.limitations.map((item) => <li key={item}><Text>→ {item}</Text></li>)}</ul></VStack></Card>
            {conflicts.length ? <VStack gap={3}><Heading level={3}>Contradictions involving this source</Heading>{conflicts.map((conflict) => <Card key={conflict.id} variant="red" padding={4}><HStack gap={3} align="center"><GitCompareArrows /><VStack gap={1}><Text weight="semibold">{conflict.title}</Text><Text type="supporting">{conflict.status}</Text></VStack></HStack></Card>)}<Button label="Open contradiction radar" href="/conflicts" /></VStack> : null}
          </VStack>
        </Grid>
        {source.references.length ? <section className="section-rule"><VStack gap={4}><HStack justify="between" align="end"><VStack gap={1}><Heading level={2}>References detected in this document</Heading><Text color="secondary">These are leads from the source bibliography. They are not treated as project evidence until you capture or review them.</Text></VStack><Badge label={`${source.references.length} REFERENCES`} /></HStack><ol className="plain-list">{source.references.map((reference, index) => <li key={`${reference.text}-${index}`}><VStack gap={1}><Text>{index + 1}. {reference.text}</Text>{reference.url ? <Citation variant="label" number={index + 1} source={{ title: reference.doi ? `DOI ${reference.doi}` : "Open referenced work", url: reference.url }} /> : null}</VStack></li>)}</ol></VStack></section> : null}
        <section className="section-rule"><VStack gap={4}><Heading level={2}>Related sources</Heading><Grid columns={{ minWidth: 260, max: 3, repeat: "fit" }} gap={3}>{related.map((item) => <Card key={item.id} padding={4}><VStack gap={3}><Badge label={item.sourceType} /><Text weight="semibold">{item.title}</Text><Button label="Inspect source" href={`/research/source/${item.id}`} variant="ghost" /></VStack></Card>)}</Grid></VStack></section>
      </VStack>
    </section>
  );
}
