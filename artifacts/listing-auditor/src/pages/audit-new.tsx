import { useState } from "react";
import { useLocation } from "wouter";
import { useFetchListing, useCreateAudit, getGetAuditStatsQueryKey, getListAuditsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, ArrowRight, Tag, AlignLeft, Image, Type, CheckCircle2, RefreshCw, PenLine, Zap } from "lucide-react";
import type { FetchedListing } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

function FieldRow({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-2.5 border-b border-border/50 last:border-0">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-28 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-foreground flex-1">{value}</span>
    </div>
  );
}

function parseManualInput(text: string, asin: string): FetchedListing {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const title = lines[0] ?? "";
  const bullets = lines.slice(1).filter(l => l.length > 5 && !l.match(/^https?:\/\//));
  const imageUrls = lines.filter(l => l.match(/^https?:\/\//));
  const productName = title.split(",")[0]?.trim() || title.slice(0, 60) || "Product";
  const normalizedAsin = asin.trim().toUpperCase() || "MANUAL";

  const stopWords = new Set(["the","and","for","with","that","this","from","are","not","all","can","your","our","has","use","more","one","new"]);
  const words = (title + " " + bullets.join(" ")).toLowerCase().match(/\b[a-z]{4,}\b/g) ?? [];
  const freq: Record<string, number> = {};
  for (const w of words) if (!stopWords.has(w)) freq[w] = (freq[w] || 0) + 1;
  const keywords = Object.entries(freq).sort(([,a],[,b]) => b-a).slice(0,8).map(([w]) => w);

  return { productName, asin: normalizedAsin, category: null, title, bulletPoints: bullets.slice(0, 7), imageUrls, targetKeywords: keywords, description: null, price: null, rating: null };
}

type Mode = "auto" | "manual";

export default function AuditNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<Mode>("auto");
  const [asinInput, setAsinInput] = useState("");
  const [manualText, setManualText] = useState("");
  const [manualAsin, setManualAsin] = useState("");
  const [fetched, setFetched] = useState<FetchedListing | null>(null);

  const fetchListing = useFetchListing();
  const createAudit = useCreateAudit();

  const handleFetch = () => {
    const trimmed = asinInput.trim();
    if (!trimmed) return;
    const isUrl = trimmed.startsWith("http");
    fetchListing.mutate(
      { data: isUrl ? { url: trimmed } : { asin: trimmed } },
      {
        onSuccess: (data) => setFetched(data),
        onError: (err) => {
          const msg = err instanceof Error ? err.message : "Unknown error";
          const isBlocked = msg.toLowerCase().includes("captcha") || msg.toLowerCase().includes("blocked");
          const isNotFound = msg.toLowerCase().includes("not found") || msg.toLowerCase().includes("404");
          toast({
            title: isBlocked ? "Amazon blocked the request" : isNotFound ? "Product not found" : "Auto-fetch failed",
            description: isBlocked
              ? "Amazon blocks automated fetches from cloud servers. Switch to 'Paste Manually' to enter your listing data."
              : msg,
            variant: "destructive",
          });
          if (isBlocked) setMode("manual");
        },
      }
    );
  };

  const handleManualSubmit = () => {
    if (!manualText.trim()) return;
    const listing = parseManualInput(manualText, manualAsin);
    if (!listing.title) {
      toast({ title: "Add your listing title as the first line", variant: "destructive" });
      return;
    }
    setFetched(listing);
  };

  const handleRunAudit = () => {
    if (!fetched) return;
    createAudit.mutate(
      {
        data: {
          productName: fetched.productName,
          asin: fetched.asin,
          category: fetched.category ?? undefined,
          title: fetched.title,
          bulletPoints: fetched.bulletPoints,
          imageUrls: fetched.imageUrls,
          targetKeywords: fetched.targetKeywords,
        },
      },
      {
        onSuccess: (audit) => {
          queryClient.invalidateQueries({ queryKey: getListAuditsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetAuditStatsQueryKey() });
          setLocation(`/audits/${audit.id}`);
        },
        onError: () => {
          toast({ title: "Audit failed", description: "Please try again.", variant: "destructive" });
        },
      }
    );
  };

  const isLoading = fetchListing.isPending;
  const isAnalyzing = createAudit.isPending;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-3xl">
      <div className="border-b pb-6">
        <h1 className="text-4xl font-bold tracking-tight">New Audit</h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Provide your Amazon listing to get an AI-powered audit with scores and suggestions.
        </p>
      </div>

      {isAnalyzing && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <Card className="w-96 shadow-2xl">
            <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
              <div className="text-center">
                <h3 className="font-bold text-lg">Analyzing your listing...</h3>
                <p className="text-muted-foreground text-sm mt-1">Our AI is scoring title, bullets, images, and keywords</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {!fetched && (
        <Card>
          <CardContent className="p-0">
            {/* Mode tabs */}
            <div className="flex border-b">
              <button
                onClick={() => setMode("auto")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-4 text-sm font-semibold transition-colors border-b-2 -mb-px",
                  mode === "auto"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Zap className="w-4 h-4" />
                Auto-fetch by ASIN
              </button>
              <button
                onClick={() => setMode("manual")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-4 text-sm font-semibold transition-colors border-b-2 -mb-px",
                  mode === "manual"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <PenLine className="w-4 h-4" />
                Paste Manually
              </button>
            </div>

            {/* Auto-fetch panel */}
            {mode === "auto" && (
              <div className="p-6 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Enter your product's ASIN or Amazon URL and we'll pull the listing data automatically.
                </p>
                <div className="flex gap-3">
                  <Input
                    placeholder="B09G9FPHY6  or  https://www.amazon.in/dp/B09G9FPHY6"
                    value={asinInput}
                    onChange={e => setAsinInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleFetch(); }}
                    disabled={isLoading}
                    className="font-mono text-sm"
                  />
                  <Button onClick={handleFetch} disabled={isLoading || !asinInput.trim()} className="shrink-0">
                    {isLoading ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Fetching...</>
                    ) : (
                      <><Search className="w-4 h-4 mr-2" />Fetch Listing</>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  If Amazon blocks the request, switch to "Paste Manually" to enter your data directly.
                </p>
              </div>
            )}

            {/* Manual entry panel */}
            {mode === "manual" && (
              <div className="p-6 space-y-4">
                <div className="text-sm text-muted-foreground bg-blue-50 border border-blue-200 rounded-md p-3 space-y-1">
                  <p className="font-semibold text-blue-800">How to paste your listing:</p>
                  <p className="text-blue-700">Line 1: Your product title</p>
                  <p className="text-blue-700">Lines 2+: Each bullet point on its own line</p>
                </div>
                <div className="space-y-2">
                  <Input
                    placeholder="ASIN (optional, e.g. B09G9FPHY6)"
                    value={manualAsin}
                    onChange={e => setManualAsin(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <Textarea
                    placeholder={"Your Awesome Product Title - Key Feature, Color, Size\nBullet point one: highlight the main benefit\nBullet point two: describe a key feature\nBullet point three: mention compatibility or specs\nBullet point four: add care or usage instructions"}
                    value={manualText}
                    onChange={e => setManualText(e.target.value)}
                    rows={10}
                    className="text-sm font-mono resize-none"
                  />
                </div>
                <Button
                  onClick={handleManualSubmit}
                  disabled={!manualText.trim()}
                  className="w-full"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Preview &amp; Audit This Listing
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Fetched listing preview */}
      {fetched && (
        <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-400">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              Listing Ready
            </h2>
            <Button variant="ghost" size="sm" onClick={() => { setFetched(null); setAsinInput(""); setManualText(""); }} className="text-muted-foreground">
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Start Over
            </Button>
          </div>

          <Card className="border-emerald-200 bg-emerald-50/30">
            <CardContent className="p-0">
              <div className="p-5 border-b border-border/50">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-bold text-lg leading-tight">{fetched.productName}</h3>
                      {fetched.asin && fetched.asin !== "MANUAL" && (
                        <Badge variant="outline" className="font-mono text-xs shrink-0">{fetched.asin}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {fetched.category && <Badge variant="secondary" className="text-xs">{fetched.category.split("›").pop()?.trim() ?? fetched.category}</Badge>}
                      {fetched.price && <span className="text-sm font-semibold text-primary">{fetched.price}</span>}
                      {fetched.rating && <span className="text-xs text-muted-foreground">{fetched.rating}</span>}
                    </div>
                  </div>
                  {fetched.imageUrls[0] && (
                    <img src={fetched.imageUrls[0]} alt="Product" className="w-20 h-20 object-contain rounded-md border bg-white shrink-0" />
                  )}
                </div>
              </div>

              <div className="px-5 py-1">
                <FieldRow
                  label={<><Type className="w-3.5 h-3.5 inline mr-1" />Title</>}
                  value={<span className="leading-relaxed">{fetched.title}</span>}
                />
                {fetched.bulletPoints.length > 0 && (
                  <FieldRow
                    label={<><AlignLeft className="w-3.5 h-3.5 inline mr-1" />Bullets</>}
                    value={
                      <ul className="space-y-1">
                        {fetched.bulletPoints.slice(0, 5).map((b, i) => (
                          <li key={i} className="text-xs leading-relaxed text-foreground/80 flex gap-1.5">
                            <span className="text-primary font-bold shrink-0">•</span>
                            <span>{b}</span>
                          </li>
                        ))}
                        {fetched.bulletPoints.length > 5 && (
                          <li className="text-xs text-muted-foreground">+{fetched.bulletPoints.length - 5} more</li>
                        )}
                      </ul>
                    }
                  />
                )}
                {fetched.imageUrls.length > 0 && (
                  <FieldRow
                    label={<><Image className="w-3.5 h-3.5 inline mr-1" />Images</>}
                    value={
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          {fetched.imageUrls.slice(0, 5).map((url, i) => (
                            <img key={i} src={url} alt="" className="w-8 h-8 object-contain rounded border bg-white" />
                          ))}
                        </div>
                        <span className="text-xs text-muted-foreground">{fetched.imageUrls.length} image{fetched.imageUrls.length !== 1 ? "s" : ""} found</span>
                      </div>
                    }
                  />
                )}
                {fetched.targetKeywords.length > 0 && (
                  <FieldRow
                    label={<><Tag className="w-3.5 h-3.5 inline mr-1" />Keywords</>}
                    value={
                      <div className="flex flex-wrap gap-1">
                        {fetched.targetKeywords.map((kw, i) => (
                          <Badge key={i} variant="outline" className="text-xs">{kw}</Badge>
                        ))}
                      </div>
                    }
                  />
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3 justify-end pt-2">
            <Button onClick={() => setFetched(null)} variant="outline">
              Try Different Listing
            </Button>
            <Button onClick={handleRunAudit} size="lg" disabled={isAnalyzing}>
              {isAnalyzing ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analyzing...</>
              ) : (
                <>Run AI Audit <ArrowRight className="w-4 h-4 ml-2" /></>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
