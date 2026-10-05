import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createAuditEbayListing,
  fetchEbayCategoryAspects,
  fetchEbayCategorySuggestions,
  fetchEbayListingOptions,
  type EbayCategoryAspectField,
  type EbayCategorySuggestion,
} from "@/lib/ebay-publish";

export function EbayListNewDialog({
  auditId,
  open,
  onOpenChange,
  onPublished,
}: {
  auditId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPublished: (result: { message: string; listingUrl?: string; warning?: string }) => void;
}) {
  const [categoryQuery, setCategoryQuery] = useState("");
  const [categoryResults, setCategoryResults] = useState<EbayCategorySuggestion[]>([]);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<EbayCategorySuggestion | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [fulfillmentPolicyId, setFulfillmentPolicyId] = useState("");
  const [paymentPolicyId, setPaymentPolicyId] = useState("");
  const [returnPolicyId, setReturnPolicyId] = useState("");
  const [aspectValues, setAspectValues] = useState<Record<string, string>>({});

  const optionsQuery = useQuery({
    queryKey: ["ebay-listing-options"],
    queryFn: fetchEbayListingOptions,
    enabled: open,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!open) return;
    const defaults = optionsQuery.data?.defaults;
    if (!defaults) return;
    if (!fulfillmentPolicyId && defaults.fulfillmentPolicyId) {
      setFulfillmentPolicyId(defaults.fulfillmentPolicyId);
    }
    if (!paymentPolicyId && defaults.paymentPolicyId) {
      setPaymentPolicyId(defaults.paymentPolicyId);
    }
    if (!returnPolicyId && defaults.returnPolicyId) {
      setReturnPolicyId(defaults.returnPolicyId);
    }
  }, [open, optionsQuery.data, fulfillmentPolicyId, paymentPolicyId, returnPolicyId]);

  useEffect(() => {
    if (!open) {
      setCategoryQuery("");
      setCategoryResults([]);
      setSelectedCategory(null);
      setAspectValues({});
    }
  }, [open]);

  const aspectsQuery = useQuery({
    queryKey: ["ebay-category-aspects", selectedCategory?.categoryId],
    queryFn: () => fetchEbayCategoryAspects(selectedCategory!.categoryId),
    enabled: open && Boolean(selectedCategory?.categoryId),
    staleTime: 300_000,
  });

  const requiredAspects = useMemo(
    () => (aspectsQuery.data ?? []).filter((field) => field.required),
    [aspectsQuery.data],
  );

  const requiredAspectsFilled = requiredAspects.every(
    (field) => Boolean(aspectValues[field.name]?.trim()),
  );

  const createMutation = useMutation({
    mutationFn: () => {
      if (!selectedCategory) throw new Error("Select an eBay category.");
      return createAuditEbayListing({
        auditId,
        primaryCategoryId: selectedCategory.categoryId,
        quantity: Math.max(1, Number.parseInt(quantity, 10) || 1),
        fulfillmentPolicyId,
        paymentPolicyId,
        returnPolicyId,
        itemAspects: aspectValues,
      });
    },
    onSuccess: (result) => {
      onPublished(result);
      onOpenChange(false);
    },
  });

  const policyOptions = optionsQuery.data;
  const createEnabled = policyOptions?.createListingEnabled === true;

  const canSubmit = Boolean(
    selectedCategory
    && fulfillmentPolicyId
    && paymentPolicyId
    && returnPolicyId
    && createEnabled
    && requiredAspectsFilled
    && !aspectsQuery.isLoading,
  );

  const sandboxNote = useMemo(() => {
    if (optionsQuery.isLoading) return null;
    if (policyOptions?.createListingEnabled) {
      return "New listings use your sandbox eBay account (EBAY_US, fixed price, condition New).";
    }
    return "New listing creation is enabled for sandbox eBay only in this release. Connect sandbox eBay on Marketplaces.";
  }, [optionsQuery.isLoading, policyOptions?.createListingEnabled]);

  async function runCategorySearch() {
    const q = categoryQuery.trim();
    if (q.length < 2) return;
    setCategoryLoading(true);
    try {
      const categories = await fetchEbayCategorySuggestions(q);
      setCategoryResults(categories);
    } finally {
      setCategoryLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>List as new on eBay</DialogTitle>
        </DialogHeader>

        {optionsQuery.isError && (
          <p className="text-sm text-destructive">
            {optionsQuery.error instanceof Error ? optionsQuery.error.message : "Could not load eBay options."}
          </p>
        )}

        {sandboxNote && (
          <p className="text-xs text-muted-foreground">{sandboxNote}</p>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>eBay category</Label>
            <div className="flex gap-2">
              <Input
                value={categoryQuery}
                onChange={(e) => setCategoryQuery(e.target.value)}
                placeholder="Search e.g. wrist watch"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void runCategorySearch();
                  }
                }}
              />
              <Button type="button" variant="outline" size="icon" onClick={() => void runCategorySearch()} disabled={categoryLoading}>
                {categoryLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            {selectedCategory && (
              <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-md px-2 py-1.5">
                Selected: {selectedCategory.categoryPath}
              </p>
            )}
            {categoryResults.length > 0 && (
              <ul className="max-h-40 overflow-y-auto border rounded-md divide-y text-xs">
                {categoryResults.map((cat) => (
                  <li key={cat.categoryId}>
                    <button
                      type="button"
                      className="w-full text-left px-2 py-2 hover:bg-slate-50"
                      onClick={() => {
                        setSelectedCategory(cat);
                        setAspectValues({});
                      }}
                    >
                      <span className="font-medium text-slate-800">{cat.categoryName}</span>
                      <span className="block text-slate-500 truncate">{cat.categoryPath}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {selectedCategory && (
            <div className="space-y-3">
              <div>
                <Label className="text-slate-800">Item specifics (required by eBay)</Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  eBay requires fields like Type or Brand for this category. Fill every required row below.
                </p>
              </div>
              {aspectsQuery.isLoading && (
                <p className="text-xs text-slate-500 flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading item specifics…
                </p>
              )}
              {aspectsQuery.isError && (
                <p className="text-xs text-destructive">
                  {aspectsQuery.error instanceof Error ? aspectsQuery.error.message : "Could not load item specifics."}
                </p>
              )}
              {requiredAspects.map((field) => (
                <AspectField
                  key={field.name}
                  field={field}
                  value={aspectValues[field.name] ?? ""}
                  onChange={(value) => setAspectValues((prev) => ({ ...prev, [field.name]: value }))}
                />
              ))}
              {aspectsQuery.isSuccess && requiredAspects.length === 0 && (
                <p className="text-xs text-slate-500">No required item specifics for this category.</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="ebay-qty">Quantity</Label>
            <Input
              id="ebay-qty"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>

          {policyOptions && (
            <div className="space-y-3">
              <PolicySelect
                label="Shipping policy"
                value={fulfillmentPolicyId}
                onChange={setFulfillmentPolicyId}
                options={policyOptions.fulfillmentPolicies}
              />
              <PolicySelect
                label="Payment policy"
                value={paymentPolicyId}
                onChange={setPaymentPolicyId}
                options={policyOptions.paymentPolicies}
              />
              <PolicySelect
                label="Return policy"
                value={returnPolicyId}
                onChange={setReturnPolicyId}
                options={policyOptions.returnPolicies}
              />
            </div>
          )}

          {createMutation.isError && (
            <p className="text-sm text-destructive">
              {createMutation.error instanceof Error ? createMutation.error.message : "Publish failed."}
            </p>
          )}

          <Button
            type="button"
            className="w-full bg-orange-500 hover:bg-orange-600"
            disabled={!canSubmit || createMutation.isPending || optionsQuery.isLoading}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Publishing to eBay…
              </>
            ) : (
              "Publish new listing to eBay"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AspectField({
  field,
  value,
  onChange,
}: {
  field: EbayCategoryAspectField;
  value: string;
  onChange: (value: string) => void;
}) {
  const label = `${field.name}${field.required ? " *" : ""}`;
  if (field.values.length > 0) {
    return (
      <div className="space-y-1.5">
        <Label>{label}</Label>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder={`Select ${field.name}`} />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            {field.values.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.name}
      />
    </div>
  );
}

function PolicySelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ id: string; name: string }>;
}) {
  if (options.length === 0) {
    return (
      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1.5">
        No {label.toLowerCase()} found on eBay. Create business policies in eBay Seller Hub (sandbox), then try again.
      </p>
    );
  }
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.id} value={opt.id}>
              {opt.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
