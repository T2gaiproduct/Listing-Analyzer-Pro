import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAddCompetitor, useGetAudit, getGetAuditQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { refreshCreditBalances } from "@/lib/credit-queries";
import { parseListingFetchInput } from "@/lib/listing-input";
import { ArrowLeft, Plus, X, Loader2, Users, Search, Sparkles, CheckCircle2, AlertCircle, Zap } from "lucide-react";

const formSchema = z.object({
  productName: z.string().min(1, "Product name is required"),
  asin: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  bulletPoints: z.array(z.object({ value: z.string() })).min(1),
  imageCount: z.coerce.number().min(0).max(20),
  targetKeywords: z.array(z.object({ value: z.string() })).min(1),
});

type FormValues = z.infer<typeof formSchema>;

const COMPETITOR_SOURCES = [
  { label: "Amazon ASIN", placeholder: "B0XXXXXXXXX", hint: "Enter the competitor's Amazon ASIN to auto-fetch listing details" },
  { label: "Product URL", placeholder: "https://store.com/products/...", hint: "Paste any product page URL — Amazon, Shopify, Walmart, eBay, Etsy, and more" },
  { label: "Manual Entry", placeholder: "", hint: "Manually enter all competitor listing details" },
];

const PRESET_COMPETITORS = [
  { tag: "Best Seller", icon: "🏆", desc: "Analyze the #1 best seller in your category" },
  { tag: "Amazon's Choice", icon: "✅", desc: "Compare against Amazon's Choice product" },
  { tag: "Sponsored Top", icon: "📢", desc: "Top sponsored product in your search results" },
  { tag: "New Arrival", icon: "🆕", desc: "Trending new competitor in your niche" },
];

function CompetitorForm({
  index, id, onSuccess, onCancel, showCancel,
}: {
  index: number; id: number;
  onSuccess: (productName: string) => void;
  onCancel?: () => void;
  showCancel: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const addCompetitor = useAddCompetitor();

  const [fetchMode, setFetchMode] = useState<"asin" | "url" | "manual">("asin");
  const [lookupInput, setLookupInput] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [fetchSuccess, setFetchSuccess] = useState(false);
  const [keywordInput, setKeywordInput] = useState("");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      productName: "",
      asin: "",
      title: "",
      bulletPoints: [{ value: "" }],
      imageCount: 0,
      targetKeywords: [{ value: "" }],
    },
  });

  const bulletFields = useFieldArray({ control: form.control, name: "bulletPoints" });
  const keywordFields = useFieldArray({ control: form.control, name: "targetKeywords" });

  const addKeyword = () => {
    if (keywordInput.trim()) {
      keywordFields.append({ value: keywordInput.trim() });
      setKeywordInput("");
    }
  };

  const handleAutoFetch = async () => {
    const value = lookupInput.trim();
    if (!value) return;
    setIsFetching(true);
    setFetchError("");
    setFetchSuccess(false);

    let body: { asin?: string; url?: string };

    if (fetchMode === "asin") {
      body = { asin: value.replace(/^(asin:?\s*)/i, "").trim().toUpperCase() };
    } else {
      try {
        body = parseListingFetchInput(value);
      } catch (err) {
        setFetchError(err instanceof Error ? err.message : "Invalid product URL");
        setIsFetching(false);
        return;
      }
    }

    try {
      const resp = await fetch("/api/fetch-listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Fetch failed" }));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }

      const data = await resp.json();

      form.setValue("productName", data.productName || data.title?.slice(0, 60) || "");
      form.setValue("asin", data.asin || "");
      form.setValue("title", data.title || "");
      form.setValue("imageCount", data.imageCount ?? data.imageUrls?.length ?? 0);

      if (data.bulletPoints?.length) {
        form.setValue("bulletPoints", data.bulletPoints.slice(0, 7).map((v: string) => ({ value: v })));
      }
      if (data.targetKeywords?.length) {
        form.setValue("targetKeywords", data.targetKeywords.slice(0, 10).map((v: string) => ({ value: v })));
      } else if (data.keywords?.length) {
        form.setValue("targetKeywords", data.keywords.slice(0, 10).map((v: string) => ({ value: v })));
      }

      setFetchSuccess(true);
      toast({ title: "Listing fetched", description: `Auto-filled ${data.productName || "competitor"} details.` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch listing";
      const isBlocked = msg.toLowerCase().includes("captcha") || msg.toLowerCase().includes("blocked") || msg.toLowerCase().includes("unavailable");
      setFetchError(
        isBlocked
          ? "Amazon blocked the auto-fetch (CAPTCHA). Please enter details manually below."
          : `Could not fetch: ${msg}. Please enter details manually.`
      );
    } finally {
      setIsFetching(false);
    }
  };

  const onSubmit = (values: FormValues) => {
    addCompetitor.mutate(
      {
        id,
        data: {
          productName: values.productName,
          asin: values.asin || undefined,
          title: values.title,
          bulletPoints: values.bulletPoints.map(b => b.value).filter(Boolean),
          imageCount: values.imageCount,
          targetKeywords: values.targetKeywords.map(k => k.value).filter(Boolean),
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetAuditQueryKey(id) });
          refreshCreditBalances(queryClient);
          onSuccess(values.productName);
          toast({ title: "Competitor analyzed", description: `${values.productName} added and scored.` });
        },
        onError: () => {
          toast({ title: "Failed to add competitor", variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="space-y-5">
      {/* Auto-Fetch Panel */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold text-primary">Auto-Fetch Competitor Data</p>
          </div>

          {/* Mode tabs */}
          <div className="flex gap-1 border rounded-lg p-0.5 bg-background w-fit">
            {(["asin","url","manual"] as const).map(mode => (
              <button
                key={mode}
                onClick={() => { setFetchMode(mode); setFetchError(""); setFetchSuccess(false); }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all capitalize ${fetchMode === mode ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {mode === "asin" ? "By ASIN" : mode === "url" ? "By URL" : "Manual Only"}
              </button>
            ))}
          </div>

          {fetchMode !== "manual" && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{COMPETITOR_SOURCES.find(s => s.label.toLowerCase().includes(fetchMode))?.hint}</p>
              <div className="flex gap-2">
                <Input
                  value={lookupInput}
                  onChange={e => { setLookupInput(e.target.value); setFetchError(""); setFetchSuccess(false); }}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAutoFetch(); } }}
                  placeholder={fetchMode === "asin" ? "e.g. B0ABCDE1234" : "https://store.com/products/your-product"}
                  className="flex-1 bg-background"
                  disabled={isFetching}
                />
                <Button onClick={handleAutoFetch} disabled={!lookupInput.trim() || isFetching} size="sm">
                  {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  {isFetching ? "Fetching…" : "Auto-Fill"}
                </Button>
              </div>
              {fetchSuccess && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Listing data auto-filled below — review and submit
                </div>
              )}
              {fetchError && (
                <div className="flex items-start gap-1.5 text-xs text-amber-600">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  {fetchError}
                </div>
              )}
            </div>
          )}
          {fetchMode === "manual" && (
            <p className="text-xs text-muted-foreground">Fill in the competitor details manually in the form below.</p>
          )}
        </CardContent>
      </Card>

      {/* Preset tags */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Quick Tags</p>
        <div className="flex flex-wrap gap-2">
          {PRESET_COMPETITORS.map(p => (
            <button
              key={p.tag}
              onClick={() => form.setValue("productName", form.getValues("productName") || p.tag)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border hover:border-primary/40 hover:bg-primary/5 transition-all"
              title={p.desc}
            >
              {p.icon} {p.tag}
            </button>
          ))}
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <Card>
            <CardHeader className="pb-4"><h3 className="font-semibold">Competitor Details</h3></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="productName" render={({ field }) => (
                  <FormItem className="md:col-span-1">
                    <FormLabel>Product Name *</FormLabel>
                    <FormControl><Input placeholder="e.g. Rival Earbuds X1" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="asin" render={({ field }) => (
                  <FormItem>
                    <FormLabel>ASIN <span className="text-muted-foreground">(optional)</span></FormLabel>
                    <FormControl><Input placeholder="B0XXXXXXXXX" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="imageCount" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Image Count</FormLabel>
                    <FormControl><Input type="number" min={0} max={20} placeholder="7" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>Listing Title *</FormLabel>
                  <FormControl><Input placeholder="Competitor's full Amazon listing title..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4"><h3 className="font-semibold">Bullet Points</h3></CardHeader>
            <CardContent className="space-y-3">
              {bulletFields.fields.map((field, idx) => (
                <div key={field.id} className="flex gap-2 items-start">
                  <span className="w-6 h-9 flex items-center justify-center text-xs font-mono text-muted-foreground font-bold shrink-0">{idx + 1}</span>
                  <FormField control={form.control} name={`bulletPoints.${idx}.value`} render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormControl><Input placeholder={`Bullet point ${idx + 1}...`} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  {bulletFields.fields.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={() => bulletFields.remove(idx)}>
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => bulletFields.append({ value: "" })}>
                <Plus className="w-4 h-4 mr-2" /> Add Bullet
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4"><h3 className="font-semibold">Target Keywords</h3></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Type a keyword and press Enter..."
                  value={keywordInput}
                  onChange={e => setKeywordInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); } }}
                />
                <Button type="button" variant="outline" onClick={addKeyword}><Plus className="w-4 h-4" /></Button>
              </div>
              {keywordFields.fields.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {keywordFields.fields.map((field, idx) => (
                    <Badge key={field.id} variant="secondary" className="pl-3 pr-1.5 py-1.5 flex items-center gap-1.5 text-sm">
                      <FormField control={form.control} name={`targetKeywords.${idx}.value`} render={({ field }) => (
                        <span>{field.value}</span>
                      )} />
                      <button type="button" onClick={() => keywordFields.remove(idx)} className="hover:text-destructive transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-3 justify-end">
            {showCancel && onCancel && (
              <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
            )}
            <Button type="submit" disabled={addCompetitor.isPending} className="min-w-40">
              {addCompetitor.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing…</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" /> Analyze Competitor {index > 1 ? `#${index}` : ""}</>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

export default function CompetitorNew({ id }: { id: number }) {
  const [, setLocation] = useLocation();
  const { data: audit } = useGetAudit(id, { query: { enabled: !!id, queryKey: getGetAuditQueryKey(id) } });
  const [addedCompetitors, setAddedCompetitors] = useState<string[]>([]);
  const [activeForms, setActiveForms] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const handleSuccess = (productName: string, formIndex: number) => {
    setAddedCompetitors(prev => [...prev, productName]);
    if (formIndex === activeForms && activeForms < 3) {
      // Optionally could auto-advance, but we'll just mark complete
    }
    if (activeForms === 1) {
      setLocation(`/audits/${id}`);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="border-b pb-6">
        <div className="flex items-center gap-3 mb-3">
          <Button variant="ghost" size="icon" asChild className="-ml-2">
            <Link href={`/audits/${id}`}><ArrowLeft className="w-4 h-4" /></Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-muted-foreground" />
              <h1 className="text-3xl font-bold tracking-tight">Add Competitor</h1>
            </div>
            {audit && (
              <p className="text-muted-foreground text-sm mt-1">
                Comparing against: <span className="font-medium text-foreground">{audit.productName}</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 ml-11 flex-wrap">
          <p className="text-muted-foreground text-sm">Auto-fetch by ASIN/URL or enter manually. Add up to 3 competitors at once.</p>
          {addedCompetitors.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {addedCompetitors.map((name, i) => (
                <Badge key={i} className="bg-emerald-100 text-emerald-700 border-emerald-200">
                  <CheckCircle2 className="w-3 h-3 mr-1" />{name}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* How many competitors to add */}
      <div className="flex items-center gap-3">
        <p className="text-sm font-medium text-muted-foreground">Add how many?</p>
        <div className="flex gap-1 border rounded-lg p-0.5 bg-muted/30">
          {[1, 2, 3].map(n => (
            <button
              key={n}
              onClick={() => setActiveForms(n)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeForms === n ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {n} {n === 1 ? "Competitor" : "Competitors"}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/audits/${id}`}>Back to Audit</Link>
        </Button>
      </div>

      {/* Forms */}
      {activeForms === 1 ? (
        <CompetitorForm
          index={1}
          id={id}
          onSuccess={(name) => { setAddedCompetitors([name]); setLocation(`/audits/${id}`); }}
          showCancel={false}
        />
      ) : (
        <Tabs defaultValue="1">
          <TabsList className="mb-6">
            {Array.from({ length: activeForms }).map((_, i) => (
              <TabsTrigger key={i} value={String(i + 1)} className="flex items-center gap-1.5">
                {addedCompetitors[i]
                  ? <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />Done</>
                  : <>Competitor {i + 1}</>
                }
              </TabsTrigger>
            ))}
          </TabsList>
          {Array.from({ length: activeForms }).map((_, i) => (
            <TabsContent key={i} value={String(i + 1)}>
              {addedCompetitors[i] ? (
                <Card className="border-emerald-200 bg-emerald-50">
                  <CardContent className="py-10 text-center">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                    <p className="font-semibold text-emerald-800 text-lg">{addedCompetitors[i]}</p>
                    <p className="text-emerald-600 text-sm mt-1">Analyzed and added successfully</p>
                  </CardContent>
                </Card>
              ) : (
                <CompetitorForm
                  index={i + 1}
                  id={id}
                  onSuccess={(name) => {
                    const next = [...addedCompetitors, name];
                    setAddedCompetitors(next);
                    if (next.length === activeForms) {
                      setTimeout(() => setLocation(`/audits/${id}`), 1200);
                    }
                  }}
                  showCancel={addedCompetitors.length > 0}
                  onCancel={() => setLocation(`/audits/${id}`)}
                />
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}

      {submitting && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <Card className="w-80 shadow-2xl">
            <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
              <div className="text-center">
                <h3 className="font-bold text-lg">Analyzing competitor…</h3>
                <p className="text-muted-foreground text-sm mt-1">Comparing strengths and weaknesses</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
