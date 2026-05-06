import { useState } from "react";
import { useLocation } from "wouter";
import { useFetchListing, useCreateAudit, getGetAuditStatsQueryKey, getListAuditsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, ArrowRight, Tag, AlignLeft, Image, Type, CheckCircle2, RefreshCw } from "lucide-react";
import type { FetchedListing } from "@workspace/api-client-react";

function FieldRow({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-2.5 border-b border-border/50 last:border-0">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-28 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-foreground flex-1">{value}</span>
    </div>
  );
}

export default function AuditNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [input, setInput] = useState("");
  const [fetched, setFetched] = useState<FetchedListing | null>(null);

  const fetchListing = useFetchListing();
  const createAudit = useCreateAudit();

  const handleFetch = () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const isUrl = trimmed.startsWith("http");
    fetchListing.mutate(
      { data: isUrl ? { url: trimmed } : { asin: trimmed } },
      {
        onSuccess: (data) => setFetched(data),
        onError: (err) => {
          toast({
            title: "Could not fetch listing",
            description: err instanceof Error ? err.message : "Amazon may be blocking the request. Try again or use a different ASIN.",
            variant: "destructive",
          });
        },
      }
    );
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
    <div className="space-y-8 animate-in fade-in duration-500 max-w-3xl">
      <div className="border-b pb-6">
        <h1 className="text-4xl font-bold tracking-tight">New Audit</h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Enter an ASIN or Amazon product URL to auto-fetch and analyze your listing.
        </p>
      </div>

      {(isAnalyzing) && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <Card className="w-96 shadow-2xl">
            <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
              <div className="text-center">
                <h3 className="font-bold text-lg">Analyzing your listing...</h3>
                <p className="text-muted-foreground text-sm mt-1">
                  Our AI is scoring title, bullets, images, and keywords
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Input */}
      <Card>
        <CardContent className="p-6">
          <label className="block text-sm font-semibold mb-3">ASIN or Amazon Product URL</label>
          <div className="flex gap-3">
            <Input
              placeholder="B09G9FPHY6  or  https://amazon.com/dp/B09G9FPHY6"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleFetch(); }}
              disabled={isLoading}
              className="font-mono text-sm"
              data-testid="input-asin-url"
            />
            <Button onClick={handleFetch} disabled={isLoading || !input.trim()} className="shrink-0" data-testid="button-fetch">
              {isLoading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Fetching...</>
              ) : (
                <><Search className="w-4 h-4 mr-2" /> Fetch Listing</>
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Works with any Amazon.com product. Paste the ASIN (10-character code) or full product URL.
          </p>
        </CardContent>
      </Card>

      {/* Fetched Listing Preview */}
      {fetched && (
        <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-400">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              Listing Found
            </h2>
            <Button variant="ghost" size="sm" onClick={() => { setFetched(null); setInput(""); }} className="text-muted-foreground">
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Reset
            </Button>
          </div>

          <Card className="border-emerald-200 bg-emerald-50/30">
            <CardContent className="p-0">
              <div className="p-5 border-b border-border/50">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-bold text-lg leading-tight">{fetched.productName}</h3>
                      {fetched.asin && (
                        <Badge variant="outline" className="font-mono text-xs shrink-0">{fetched.asin}</Badge>
                      )}
                    </div>
                    {fetched.category && (
                      <Badge variant="secondary" className="text-xs uppercase tracking-wider">{fetched.category}</Badge>
                    )}
                    {fetched.price && (
                      <span className="ml-2 text-sm font-semibold text-primary">{fetched.price}</span>
                    )}
                    {fetched.rating && (
                      <span className="ml-2 text-xs text-muted-foreground">{fetched.rating}</span>
                    )}
                  </div>
                  {fetched.imageUrls[0] && (
                    <img
                      src={fetched.imageUrls[0]}
                      alt="Product"
                      className="w-20 h-20 object-contain rounded-md border bg-white"
                    />
                  )}
                </div>
              </div>

              <div className="px-5 py-1">
                <FieldRow
                  label={<><Type className="w-3.5 h-3.5 inline mr-1" />Title</>}
                  value={<span className="leading-relaxed">{fetched.title}</span>}
                />
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
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3 justify-end pt-2">
            <Button onClick={() => { setFetched(null); }} variant="outline" data-testid="button-refetch">
              Try Different ASIN
            </Button>
            <Button onClick={handleRunAudit} size="lg" disabled={isAnalyzing} data-testid="button-run-audit">
              {isAnalyzing ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing...</>
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
