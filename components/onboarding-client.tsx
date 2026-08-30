"use client";

import { FormEvent, useState } from "react";
import { AppShell } from "@astryxdesign/core/AppShell";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { ArrowLeft, ArrowRight, CheckCircle2, Highlighter, Network, PanelRightOpen, Save } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";

const steps = [
  "What are you researching?",
  "Create your first research question",
  "Install the THREAD extension",
  "Highlight something on the web",
  "Save it to THREAD",
  "Watch your research graph grow",
];

export function OnboardingClient() {
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(false);
  const [error, setError] = useState("");

  const create = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, researchQuestion: question, description, tags: tags.split(",").map((value) => value.trim()).filter(Boolean) }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Project could not be created");
      setCreated(true);
      setStep(2);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Project could not be created");
    } finally {
      setLoading(false);
    }
  };

  const icon = [null, null, <PanelRightOpen key="panel" />, <Highlighter key="highlight" />, <Save key="save" />, <Network key="network" />][step];
  return (
    <AppShell height="auto" variant="surface" contentPadding={0}>
      <section className="onboarding-shell">
        <VStack className="onboarding-panel" gap={5}>
          <HStack justify="between" align="center"><HStack gap={2} align="center"><BrandMark compact /><Text weight="semibold">THREAD</Text></HStack><Badge label={`STEP ${step + 1} OF 6`} /></HStack>
          <ol className="onboarding-steps">{steps.map((label, index) => <li key={label} className={index <= step ? "is-active" : ""}><strong>{index < step ? "✓" : index + 1}</strong><small>{label}</small></li>)}</ol>
          <Card padding={6}>
            {step === 0 ? <VStack gap={5}><Text type="supporting" color="secondary">START A LIVING RESEARCH SYSTEM</Text><Heading level={1} type="display-3">What are you researching?</Heading><Text color="secondary">Give the project a focused title. You can refine the question next.</Text><label className="field-label">Project title<input className="native-input" value={title} onChange={(event) => setTitle(event.target.value)} autoFocus /></label><Button label="Continue" variant="primary" endContent={<ArrowRight />} onClick={() => setStep(1)} isDisabled={title.trim().length < 3} /></VStack> : null}
            {step === 1 ? <form onSubmit={create}><VStack gap={5}><Text type="supporting" color="secondary">RESEARCH QUESTION</Text><Heading level={1} type="display-3">Make the uncertainty explicit.</Heading><label className="field-label">Research question<textarea className="native-textarea" value={question} onChange={(event) => setQuestion(event.target.value)} required minLength={10} /></label><label className="field-label">Description<textarea className="native-textarea" value={description} onChange={(event) => setDescription(event.target.value)} /></label><label className="field-label">Tags<input className="native-input" value={tags} onChange={(event) => setTags(event.target.value)} /></label>{error ? <section className="status-banner is-warning"><Text>{error}</Text></section> : null}<HStack gap={3}><Button label="Back" icon={<ArrowLeft />} onClick={() => setStep(0)} /><Button label="Create project" type="submit" variant="primary" isLoading={loading} /></HStack></VStack></form> : null}
            {step >= 2 ? <VStack gap={6} align="center"><i className="onboarding-icon" aria-hidden>{step === 5 ? <CheckCircle2 /> : icon}</i><VStack gap={3} align="center"><Text type="supporting" color="secondary">{steps[step].toUpperCase()}</Text><Heading level={1} type="display-3" justify="center">{step === 2 ? "Bring THREAD into the browser." : step === 3 ? "Select the evidence that matters." : step === 4 ? "Capture it with provenance." : "Your evidence graph is ready."}</Heading><Text color="secondary" justify="center">{step === 2 ? "Download the packaged Manifest V3 extension, extract it, and load the folder from chrome://extensions." : step === 3 ? "On any webpage, select a precise claim. A small Thread button appears below the selection." : step === 4 ? "Click Thread to analyze and save it, compare existing claims, connect related evidence, and report conflicts." : "Your workspace starts empty and grows only from evidence you capture."}</Text></VStack>{created ? <Badge label="PROJECT INITIALIZED" variant="success" /> : null}<HStack gap={3} wrap="wrap">{step === 2 ? <Button label="Download extension" href="/thread-extension.zip" /> : null}<Button label="Back" onClick={() => setStep(step - 1)} /><Button label={step === 5 ? "Open workspace" : "Continue"} href={step === 5 ? "/dashboard" : undefined} onClick={step === 5 ? undefined : () => setStep(step + 1)} variant="primary" endContent={<ArrowRight />} /></HStack></VStack> : null}
          </Card>
          <Button label="Return to workspace" href="/dashboard" variant="ghost" />
        </VStack>
      </section>
    </AppShell>
  );
}
