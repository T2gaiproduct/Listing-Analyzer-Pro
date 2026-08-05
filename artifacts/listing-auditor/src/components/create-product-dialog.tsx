import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Zap } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { fetchJson } from "@/lib/api-fetch";
import { useWorkspace } from "@/hooks/use-workspace";
import { MarketplaceLogo } from "@/components/marketplace-logos";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const WORKFLOW_TEMPLATES = [
  { id: "build-brand-standard", label: "Build Your Brand — Standard" },
  { id: "build-brand-listing", label: "Build Your Brand — Listing Focus" },
  { id: "build-brand-graphics", label: "Build Your Brand — Graphics Focus" },
  { id: "build-brand-export", label: "Build Your Brand — Export Ready" },
] as const;

const MARKETPLACES = ["Amazon", "Flipkart", "Shopsy", "Shopify", "WooCommerce", "Meesho"] as const;

const PRIORITIES = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
] as const;

interface WorkspaceMember {
  id: number;
  invitedName: string;
  status: string;
}

interface WorkspaceMembersResponse {
  members: WorkspaceMember[];
}

interface CreateProductResponse {
  id: number;
  name: string;
  sku: string;
  workflowUrl: string;
  detailUrl: string;
}

const defaultForm = {
  productName: "",
  sku: "",
  priority: "high",
  assignedManager: "",
  referenceLinks: "",
  driveFolderUrl: "",
  notes: "",
  workflowTemplate: "",
  targetMarketplaces: ["Amazon"] as string[],
};

export function CreateProductDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (product: CreateProductResponse) => void;
}) {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const { featureWorkspaceId } = useWorkspace();
  const [form, setForm] = useState(defaultForm);
  const [error, setError] = useState<string | null>(null);

  const { data: membersData } = useQuery({
    queryKey: ["workspace-members", featureWorkspaceId],
    queryFn: () => fetchJson<WorkspaceMembersResponse>(
      `${basePath}/api/workspaces/${featureWorkspaceId}/members`,
    ),
    enabled: open && !!featureWorkspaceId,
    staleTime: 60_000,
  });

  const managerOptions = useMemo(() => {
    const options: Array<{ value: string; label: string }> = [];
    const ownerName = user?.fullName?.trim() || user?.primaryEmailAddress?.emailAddress || "Account Owner";
    options.push({ value: ownerName, label: ownerName });
    for (const member of membersData?.members ?? []) {
      if (member.status === "accepted" && member.invitedName?.trim()) {
        const label = member.invitedName.trim();
        if (!options.some((o) => o.value === label)) {
          options.push({ value: label, label });
        }
      }
    }
    return options;
  }, [membersData?.members, user]);

  useEffect(() => {
    if (!open) return;
    setForm((prev) => ({
      ...prev,
      assignedManager: prev.assignedManager || managerOptions[0]?.value || "",
    }));
  }, [open, managerOptions]);

  const createMutation = useMutation({
    mutationFn: (payload: typeof form) => fetchJson<CreateProductResponse>(`${basePath}/api/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
    onSuccess: (product) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product"] });
      onCreated?.(product);
      onOpenChange(false);
      setForm(defaultForm);
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message || "Failed to create product");
    },
  });

  const toggleMarketplace = (marketplace: string, checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      targetMarketplaces: checked
        ? [...new Set([...prev.targetMarketplaces, marketplace])]
        : prev.targetMarketplaces.filter((m) => m !== marketplace),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.productName.trim() || !form.sku.trim() || !form.workflowTemplate) {
      setError("Product name, SKU, and workflow template are required.");
      return;
    }
    createMutation.mutate(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100">
            <DialogTitle className="text-base font-semibold text-slate-900">
              Create New Product
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Set up a new product and assign a workflow
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[11px] text-slate-600">Product Name *</Label>
                <Input
                  value={form.productName}
                  onChange={(e) => setForm((p) => ({ ...p, productName: e.target.value }))}
                  placeholder="e.g. Organic Honey 500g"
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-slate-600">SKU *</Label>
                <Input
                  value={form.sku}
                  onChange={(e) => setForm((p) => ({ ...p, sku: e.target.value }))}
                  placeholder="e.g. OH-500G-001"
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[11px] text-slate-600">Priority</Label>
                <Select
                  value={form.priority}
                  onValueChange={(value) => setForm((p) => ({ ...p, priority: value }))}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p.value} value={p.value} className="text-xs">
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-slate-600">Assigned Manager</Label>
                <Select
                  value={form.assignedManager}
                  onValueChange={(value) => setForm((p) => ({ ...p, assignedManager: value }))}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select manager" />
                  </SelectTrigger>
                  <SelectContent>
                    {managerOptions.map((m) => (
                      <SelectItem key={m.value} value={m.value} className="text-xs">
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] text-slate-600">Reference Links</Label>
              <Input
                value={form.referenceLinks}
                onChange={(e) => setForm((p) => ({ ...p, referenceLinks: e.target.value }))}
                placeholder="https://amazon.com/reference, https://competitor.com ..."
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] text-slate-600">Google Drive Folder URL</Label>
              <Input
                value={form.driveFolderUrl}
                onChange={(e) => setForm((p) => ({ ...p, driveFolderUrl: e.target.value }))}
                placeholder="https://drive.google.com/drive/folders/..."
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] text-slate-600">Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Any special instructions or context..."
                className="min-h-[72px] text-xs resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] text-slate-600">Workflow Template *</Label>
              <Select
                value={form.workflowTemplate}
                onValueChange={(value) => setForm((p) => ({ ...p, workflowTemplate: value }))}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="— Select a workflow —" />
                </SelectTrigger>
                <SelectContent>
                  {WORKFLOW_TEMPLATES.map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-xs">
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] text-slate-600">Target Marketplaces</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {MARKETPLACES.map((marketplace) => {
                  const checked = form.targetMarketplaces.includes(marketplace);
                  return (
                    <label
                      key={marketplace}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors",
                        checked
                          ? "border-orange-200 bg-orange-50/50"
                          : "border-slate-200 bg-white hover:bg-slate-50",
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => toggleMarketplace(marketplace, value === true)}
                        className="data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                      />
                      <MarketplaceLogo marketplace={marketplace} className="h-4 w-20" />
                    </label>
                  );
                })}
              </div>
            </div>

            {error && (
              <p className="text-[11px] text-red-600">{error}</p>
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t border-slate-100 gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-9 text-xs"
              onClick={() => onOpenChange(false)}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-9 text-xs bg-orange-500 hover:bg-orange-600 text-white"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Zap className="w-3.5 h-3.5 mr-1.5" />
              )}
              Create Product
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
