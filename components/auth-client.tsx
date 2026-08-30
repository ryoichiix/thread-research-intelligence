"use client";

import { FormEvent, useState } from "react";
import { AppShell } from "@astryxdesign/core/AppShell";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Tab, TabList } from "@astryxdesign/core/TabList";
import { Text } from "@astryxdesign/core/Text";
import { ArrowLeft } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";

const errorMessages: Record<string, string> = {
  oauth_callback_failed: "The provider callback could not create a session.",
  oauth_failed: "This provider is not enabled in Supabase yet.",
  unsupported_provider: "That authentication provider is not supported.",
};

export function AuthClient({ initialError }: { initialError?: string }) {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError ? errorMessages[initialError] ?? "Authentication failed." : "");
  const [notice, setNotice] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Authentication failed");
      if (payload.needsEmailConfirmation) {
        setNotice("Check your email to confirm the account, then return here to sign in.");
        setMode("sign-in");
        return;
      }
      window.location.assign(mode === "sign-up" ? "/onboarding" : "/dashboard");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };
  return (
    <AppShell height="fill" variant="surface" contentPadding={0}>
      <section className="auth-shell">
        <VStack className="auth-panel" gap={5}>
          <Button label="Back home" href="/" variant="ghost" icon={<ArrowLeft />} />
          <Card padding={6}>
            <VStack gap={6}>
              <HStack gap={3} align="center"><BrandMark /><VStack gap={1}><Heading level={1}>THREAD</Heading><Text color="secondary">Sign in to your research workspace</Text></VStack></HStack>
              <Text color="secondary">Use your THREAD account. No ChatGPT account is required.</Text>
              <VStack gap={2}>
                <Button label="Continue with Google" href="/api/auth/oauth?provider=google" width="100%" />
                <Button label="Continue with GitHub" href="/api/auth/oauth?provider=github" width="100%" />
              </VStack>
              <TabList value={mode} onChange={(value) => setMode(value as typeof mode)} role="tablist" layout="fill" hasDivider><Tab value="sign-in" label="LOG IN" panelId="auth-panel" /><Tab value="sign-up" label="SIGN UP" panelId="auth-panel" /></TabList>
              <form id="auth-panel" role="tabpanel" onSubmit={submit}>
                <VStack gap={4}>
                  <label className="field-label">Email<input className="native-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
                  <label className="field-label">Password<input className="native-input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "sign-in" ? "current-password" : "new-password"} minLength={8} required /></label>
                  {notice ? <section className="status-banner is-success"><Text>{notice}</Text></section> : null}
                  {error ? <section className="status-banner is-warning"><Text>{error}</Text></section> : null}
                  <Button label={mode === "sign-in" ? "Log in" : "Create account"} type="submit" variant="primary" width="100%" isLoading={loading} />
                </VStack>
              </form>
              <Text type="supporting" color="secondary">Authentication and sessions are managed by Supabase. Your research remains scoped to your account.</Text>
            </VStack>
          </Card>
        </VStack>
      </section>
    </AppShell>
  );
}
