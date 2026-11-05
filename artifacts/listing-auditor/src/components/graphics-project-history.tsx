import { FeatureProductHistoryTable } from "@/components/feature-product-history-table";

export function GraphicsProjectHistory() {
  return (
    <FeatureProductHistoryTable
      sourceType="graphics"
      sectionTitle="Your graphics history"
      emptyTitle="No graphics projects yet"
      emptyDescription="Click Create Images and choose how to begin. Completed work will appear here."
    />
  );
}
