import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, Info, Loader2, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  fetchAmazonConnection,
  fetchAmazonExportValidation,
  publishAuditToAmazon,
  type AmazonConnection,
  type AmazonExportValidation,
  type ExportValidationItem,
} from "@/lib/amazon-export";

interface PublishAmazonDialogProps {
  auditId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPublished?: () => void;
}

function ValidationIcon({ level }: { level: ExportValidationItem["level"] }) {
  if (level === "error") return <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />;
  if (level === "warning") return <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />;
  return <Info className="w-4 h-4 text-slate-400 shrink-0" />;
}

export function PublishAmazonDialog({
  auditId,
  open,
  onOpenChange,
  onPublished,
}: PublishAmazonDialogProps) {
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [validation, setValidation] = useState<AmazonExportValidation | null>(null);
  const [connection, setConnection] = useState<AmazonConnection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ message: string; status: string } | null>(null);

  useEffect(() => {
    if (!open) {
      setResult(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([fetchAmazonExportValidation(auditId), fetchAmazonConnection()])
      .then(([validationData, connectionData]) => {
        if (cancelled) return;
        setValidation(validationData);
        setConnection(connectionData);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load publish details");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, auditId]);

  const handlePublish = async () => {
    if (!validation) return;
    setPublishing(true);
    setError(null);
    try {
      const mode = validation.summary.hasAsin ? "update" : "create";
      const publishResult = await publishAuditToAmazon(auditId, mode);
      setResult({ message: publishResult.message, status: publishResult.status });
      onPublished?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  };

  const blockingErrors = validation?.validation.filter((v) => v.level === "error") ?? [];
  const canPublish = Boolean(validation?.ready) && !publishing && !result;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-orange-500" />
            Publish to Amazon
          </DialogTitle>
          <DialogDescription>
            Validate your listing and push updates to Seller Central when connected.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-10 gap-3 text-sm text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
            Checking listing…
          </div>
        )}

        {!loading && error && !validation && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && validation && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-400">SKU</p>
                <p className="font-medium text-slate-800">{validation.summary.sku}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-400">Images</p>
                <p className="font-medium text-slate-800">{validation.summary.imageCount}</p>
              </div>
            </div>

            {connection && (
              <div
                className={cn(
                  "rounded-xl border px-4 py-3 text-sm",
                  connection.connected
                    ? "border-green-200 bg-green-50 text-green-800"
                    : "border-amber-200 bg-amber-50 text-amber-900",
                )}
              >
                {connection.connected ? (
                  <p>Seller Central connected{connection.sellerId ? ` (${connection.sellerId})` : ""}.</p>
                ) : connection.spApiConfigured ? (
                  <p>Connect your Amazon Seller Central account to enable direct publish.</p>
                ) : (
                  <p>
                    Direct publish is not configured on this server. Publishing will validate your listing and
                    confirm it is ready for Excel/ZIP upload.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {validation.validation.map((item, idx) => (
                <div
                  key={`${item.field}-${idx}`}
                  className={cn(
                    "flex items-start gap-2 rounded-lg px-3 py-2 text-sm",
                    item.level === "error" && "bg-red-50 text-red-800",
                    item.level === "warning" && "bg-amber-50 text-amber-900",
                    item.level === "info" && "bg-slate-50 text-slate-600",
                  )}
                >
                  <ValidationIcon level={item.level} />
                  <span>{item.message}</span>
                </div>
              ))}
            </div>

            {result && (
              <div className="flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">
                    {result.status === "simulated" ? "Listing validated" : "Publish submitted"}
                  </p>
                  <p className="mt-1">{result.message}</p>
                </div>
              </div>
            )}

            {error && validation && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {blockingErrors.length > 0 && (
              <p className="text-xs text-red-600">
                Fix the errors above before publishing.
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={publishing}>
            {result ? "Close" : "Cancel"}
          </Button>
          {!result && (
            <Button
              className="bg-orange-500 hover:bg-orange-600"
              onClick={() => void handlePublish()}
              disabled={!canPublish}
            >
              {publishing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Publishing…
                </>
              ) : (
                "Publish listing"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
