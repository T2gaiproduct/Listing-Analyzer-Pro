import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { downloadAuditExport, type AmazonMarketplaceId } from "@/lib/amazon-export";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function canExportListingSource(sourceType: string | null | undefined): boolean {
  if (!sourceType) return true;
  return sourceType === "listing" || sourceType === "audit";
}

export function ListingExportButton({
  auditId,
  productName,
  marketplace = "US",
  disabled,
  size = "sm",
  className,
}: {
  auditId: number;
  productName?: string;
  marketplace?: AmazonMarketplaceId;
  disabled?: boolean;
  size?: "sm" | "default";
  className?: string;
}) {
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  async function handleExport() {
    if (disabled || auditId <= 0 || exporting) return;
    setExporting(true);
    try {
      await downloadAuditExport({
        auditId,
        format: "excel",
        platform: "amazon",
        marketplace,
        basePath,
      });
      toast({
        title: "Export downloaded",
        description: productName
          ? `Amazon listing Excel for ${productName}.`
          : "Amazon listing Excel download started.",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Could not export this listing.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      className={className}
      disabled={disabled || auditId <= 0 || exporting}
      onClick={() => void handleExport()}
    >
      {exporting ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <Download className="w-3 h-3" />
      )}
      Export Excel
    </Button>
  );
}
