import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/Stack";

export default function WorkspaceLoading() {
  return (
    <VStack gap={3} className="route-loading" aria-live="polite">
      <Text className="route-loading-bar" aria-hidden="true">&nbsp;</Text>
      <Text type="supporting" color="secondary">Loading research workspace…</Text>
    </VStack>
  );
}
