import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Loader2,
  Plus,
  Sparkles,
  Target,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  type AdsKeywordEntry,
  type AdsKeywordMatchType,
  type AdsProfile,
  createAmazonAdsCampaign,
  createAdsProject,
  expandAdsKeywords,
  fetchAdsProfiles,
  fetchAdsProject,
  fetchAdsStatus,
  gatherAdsProjectData,
  patchAdsProject,
  saveAdsProfile,
} from "@/lib/ads-api";

const STEPS = [
  { id: 1, label: "Product ASIN" },
  { id: 2, label: "Gather data" },
  { id: 3, label: "Keywords & scoring" },
  { id: 4, label: "Launch campaign" },
];

export default function AdsWorkflowPage({ projectId }: { projectId?: number }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [asin, setAsin] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [dailyBudget, setDailyBudget] = useState("10");
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [keywords, setKeywords] = useState<AdsKeywordEntry[]>([]);

  const statusQuery = useQuery({ queryKey: ["ads-status"], queryFn: fetchAdsStatus });
  const profilesQuery = useQuery({
    queryKey: ["ads-profiles"],
    queryFn: fetchAdsProfiles,
    enabled: statusQuery.data?.sellerConnected && statusQuery.data?.spApiReady,
    retry: false,
  });

  const profilesLoadError =
    profilesQuery.isError && profilesQuery.error instanceof Error
      ? profilesQuery.error.message
      : null;

  const projectQuery = useQuery({
    queryKey: ["ads-project", projectId],
    queryFn: () => fetchAdsProject(projectId!),
    enabled: Boolean(projectId),
  });

  const project = projectQuery.data?.project;
  const step = project?.currentStep ?? 1;

  useEffect(() => {
    if (!project) return;
    setAsin(project.asin ?? "");
    setCampaignName(project.name);
    if (project.dailyBudgetCents) setDailyBudget(String(project.dailyBudgetCents / 100));
    if (project.amazonProfileId) setSelectedProfileId(project.amazonProfileId);
    if (project.keywordData) setKeywords(project.keywordData);
  }, [project]);

  useEffect(() => {
    if (statusQuery.data?.profileId && !selectedProfileId) {
      setSelectedProfileId(statusQuery.data.profileId);
    }
  }, [statusQuery.data?.profileId, selectedProfileId]);

  const createMutation = useMutation({
    mutationFn: () =>
      createAdsProject({
        asin: asin.trim().toUpperCase(),
        name: campaignName.trim() || undefined,
        amazonProfileId: selectedProfileId || undefined,
      }),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["ads-projects"] });
      setLocation(`/ads/${data.project.id}`);
    },
    onError: (err) => {
      toast({
        title: "Could not start campaign",
        description: err instanceof Error ? err.message : "Create failed",
        variant: "destructive",
      });
    },
  });

  const saveProfileMutation = useMutation({
    mutationFn: (profile: AdsProfile) =>
      saveAdsProfile({
        profileId: profile.profileId,
        profileCountryCode: profile.countryCode,
        profileCurrencyCode: profile.currencyCode,
        profileName: profile.name,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ads-status"] });
      toast({ title: "Amazon Ads profile saved" });
    },
  });

  const gatherMutation = useMutation({
    mutationFn: () => gatherAdsProjectData(projectId!),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["ads-project", projectId] });
      const warnings = data.snapshot.warnings ?? [];
      toast({
        title: "Data gathered",
        description: warnings.length
          ? warnings.slice(0, 2).join(" ")
          : "Amazon recommendations, campaigns, and search terms loaded.",
      });
    },
    onError: (err) => {
      toast({
        title: "Gather failed",
        description: err instanceof Error ? err.message : "Could not gather data",
        variant: "destructive",
      });
    },
  });

  const expandMutation = useMutation({
    mutationFn: () => expandAdsKeywords(projectId!),
    onSuccess: (data) => {
      setKeywords(data.keywordData);
      void queryClient.invalidateQueries({ queryKey: ["ads-project", projectId] });
      toast({ title: "Keywords expanded and scored" });
    },
    onError: (err) => {
      toast({
        title: "AI expansion failed",
        description: err instanceof Error ? err.message : "Expansion failed",
        variant: "destructive",
      });
    },
  });

  const saveKeywordsMutation = useMutation({
    mutationFn: () =>
      patchAdsProject(projectId!, { keywordData: keywords, dailyBudgetCents: Math.round(Number(dailyBudget) * 100) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ads-project", projectId] });
    },
  });

  const launchMutation = useMutation({
    mutationFn: async () => {
      await patchAdsProject(projectId!, {
        keywordData: keywords,
        dailyBudgetCents: Math.round(Number(dailyBudget) * 100),
        name: campaignName.trim(),
      });
      return createAmazonAdsCampaign(projectId!, {
        dailyBudgetCents: Math.round(Number(dailyBudget) * 100),
        keywordData: keywords,
      });
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["ads-project", projectId] });
      toast({
        title: "Campaign created on Amazon",
        description: `Campaign ${data.amazon.campaignId} is live with ${data.amazon.keywordIds.length} keywords.`,
      });
    },
    onError: (err) => {
      toast({
        title: "Launch failed",
        description: err instanceof Error ? err.message : "Could not create campaign",
        variant: "destructive",
      });
    },
  });

  const selectedCount = useMemo(() => keywords.filter((k) => k.selected).length, [keywords]);

  function toggleKeyword(index: number, selected: boolean) {
    setKeywords((prev) => prev.map((k, i) => (i === index ? { ...k, selected } : k)));
  }

  function updateMatchType(index: number, matchType: AdsKeywordMatchType) {
    setKeywords((prev) => prev.map((k, i) => (i === index ? { ...k, matchType } : k)));
  }

  if (projectId && projectQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight">Manage Ads</h1>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide text-sky-700 border-sky-200 bg-sky-50">
              Work in Progress
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            ASIN → Amazon Ads API → recommendations → campaigns → search terms → AI expansion → scoring → launch
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setLocation("/ads")}>
          All campaigns
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {STEPS.map((s) => (
          <Badge
            key={s.id}
            variant={step >= s.id ? "default" : "outline"}
            className="text-xs"
          >
            {s.id}. {s.label}
          </Badge>
        ))}
      </div>

      {!statusQuery.data?.sellerConnected && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex gap-3 text-sm">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <p className="font-medium text-amber-900">Connect Amazon first</p>
            <p className="text-amber-800 mt-1">
              Save SP-API credentials and connect your seller account on Marketplaces before using Manage Ads.
            </p>
            <Button className="mt-3 h-8 text-xs" variant="outline" onClick={() => setLocation("/marketplaces")}>
              Go to Marketplaces
            </Button>
          </div>
        </div>
      )}

      {!projectId && (
        <div className="rounded-xl border bg-card p-6 space-y-5">
          <h2 className="text-lg font-semibold">Start with product ASIN</h2>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Product ASIN</Label>
              <Input
                value={asin}
                onChange={(e) => setAsin(e.target.value.toUpperCase())}
                placeholder="B09XXXXXXXX"
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label>Campaign name</Label>
              <Input
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="Spring launch campaign"
              />
            </div>
          </div>

          {profilesQuery.data?.profiles?.length ? (
            <div className="space-y-2">
              <Label>Amazon Ads profile</Label>
              <Select
                value={selectedProfileId}
                onValueChange={(value) => {
                  setSelectedProfileId(value);
                  const profile = profilesQuery.data.profiles.find((p) => p.profileId === value);
                  if (profile) saveProfileMutation.mutate(profile);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select advertising profile" />
                </SelectTrigger>
                <SelectContent>
                  {profilesQuery.data.profiles.map((p) => (
                    <SelectItem key={p.profileId} value={p.profileId}>
                      {p.name ?? p.profileId} ({p.countryCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !asin.trim()}
            className="gap-2"
          >
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create campaign project
          </Button>
        </div>
      )}

      {projectId && project && step >= 1 && (
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline" className="font-mono">{project.asin}</Badge>
            <span className="text-sm font-medium">{project.name}</span>
            {project.status === "active" && (
              <Badge className="bg-emerald-600 gap-1">
                <CheckCircle2 className="w-3 h-3" /> Live on Amazon
              </Badge>
            )}
          </div>

          <p className="text-sm text-muted-foreground">
            Step 1 complete — campaign <strong className="text-foreground">{project.name}</strong> created for ASIN{" "}
            <span className="font-mono">{project.asin}</span>. Next, pull Amazon Ads + listing data, then run AI keyword scoring.
          </p>

          {!statusQuery.data?.profileSelected && profilesQuery.data?.profiles?.length ? (
            <div className="space-y-2 rounded-lg border border-sky-200 bg-sky-50/80 p-4">
              <Label className="text-sky-900">Amazon Ads profile (required)</Label>
              <p className="text-xs text-sky-800">
                Select the advertising profile for this workspace before gathering Amazon keyword and search term data.
              </p>
              <Select
                value={selectedProfileId}
                onValueChange={(value) => {
                  setSelectedProfileId(value);
                  const profile = profilesQuery.data!.profiles.find((p) => p.profileId === value);
                  if (profile) saveProfileMutation.mutate(profile);
                }}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Select advertising profile" />
                </SelectTrigger>
                <SelectContent>
                  {profilesQuery.data.profiles.map((p) => (
                    <SelectItem key={p.profileId} value={p.profileId}>
                      {p.name ?? p.profileId} ({p.countryCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {!statusQuery.data?.profileSelected && profilesLoadError && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 space-y-2">
              <p className="font-semibold">Amazon Advertising API not authorized</p>
              <p>{profilesLoadError}</p>
              <p>
                After enabling Advertising API in Amazon Developer Console, go to{" "}
                <a href="/marketplaces" className="underline font-medium">Marketplaces</a> and reconnect your seller account.
              </p>
            </div>
          )}

          {!statusQuery.data?.profileSelected && !profilesLoadError && statusQuery.data?.sellerConnected && !profilesQuery.isLoading && !profilesQuery.data?.profiles?.length && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              No Amazon Ads profiles returned. Confirm your SP-API app has <strong>Advertising API</strong> access in Amazon Developer Console, then reconnect on{" "}
              <a href="/marketplaces" className="underline font-medium">Marketplaces</a>.
            </div>
          )}

          {step < 2 && (
            <Button
              onClick={() => gatherMutation.mutate()}
              disabled={gatherMutation.isPending || (!statusQuery.data?.canGatherData && !statusQuery.data?.sellerConnected)}
              className="gap-2"
            >
              {gatherMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
              Gather Amazon & listing data
            </Button>
          )}

          {step < 2 && !statusQuery.data?.canGatherData && statusQuery.data?.sellerConnected && (
            <p className="text-xs text-muted-foreground">
              {statusQuery.data?.profileSelected
                ? "Gather pulls keyword recommendations, existing campaigns, search terms, and listing keywords."
                : "Select an Amazon Ads profile above to enable full Amazon Ads API data (listing keywords still load without it)."}
            </p>
          )}
        </div>
      )}

      {projectId && project && step >= 2 && (
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold">Data sources</h2>

          {!statusQuery.data?.profileSelected && profilesLoadError && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 space-y-2">
              <p className="font-semibold">Amazon Advertising API not authorized</p>
              <p>{profilesLoadError}</p>
              <p>
                Enable Advertising API on your SP-API app, then reconnect on{" "}
                <a href="/marketplaces" className="underline font-medium">Marketplaces</a> and re-run gather.
              </p>
            </div>
          )}

          {!statusQuery.data?.profileSelected && profilesQuery.data?.profiles?.length ? (
            <div className="space-y-2 rounded-lg border border-sky-200 bg-sky-50/80 p-4">
              <Label className="text-sky-900">Amazon Ads profile (required)</Label>
              <p className="text-xs text-sky-800">
                Select your advertising profile, then re-gather data to pull Amazon keyword and search term reports.
              </p>
              <Select
                value={selectedProfileId}
                onValueChange={(value) => {
                  setSelectedProfileId(value);
                  const profile = profilesQuery.data!.profiles.find((p) => p.profileId === value);
                  if (profile) saveProfileMutation.mutate(profile);
                }}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Select advertising profile" />
                </SelectTrigger>
                <SelectContent>
                  {profilesQuery.data.profiles.map((p) => (
                    <SelectItem key={p.profileId} value={p.profileId}>
                      {p.name ?? p.profileId} ({p.countryCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {project.sourcesSnapshot?.warnings?.map((w) => (
            <p key={w} className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded px-3 py-2">{w}</p>
          ))}
          <div className="grid sm:grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Amazon recommendations</p>
              <p className="text-xl font-semibold">{project.sourcesSnapshot?.amazonRecommendations?.length ?? 0}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Existing campaign keywords</p>
              <p className="text-xl font-semibold">{project.sourcesSnapshot?.existingCampaignKeywords?.length ?? 0}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Search term report rows</p>
              <p className="text-xl font-semibold">{project.sourcesSnapshot?.searchTermReport?.length ?? 0}</p>
            </div>
          </div>

          {step === 2 && statusQuery.data?.profileSelected && (
            <Button
              variant="outline"
              onClick={() => gatherMutation.mutate()}
              disabled={gatherMutation.isPending}
              className="gap-2"
            >
              {gatherMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
              Re-gather Amazon data
            </Button>
          )}

          {step === 2 && (
            <Button
              onClick={() => expandMutation.mutate()}
              disabled={expandMutation.isPending}
              className="gap-2"
            >
              {expandMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Run SellerLens AI expansion & scoring
            </Button>
          )}
        </div>
      )}

      {projectId && keywords.length > 0 && (
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">Keywords ({selectedCount} selected)</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => saveKeywordsMutation.mutate()}
              disabled={saveKeywordsMutation.isPending}
            >
              Save changes
            </Button>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="p-3 w-10" />
                  <th className="p-3 text-left">Keyword</th>
                  <th className="p-3 text-left w-28">Score</th>
                  <th className="p-3 text-left w-32">Match</th>
                  <th className="p-3 text-left">Sources</th>
                </tr>
              </thead>
              <tbody>
                {keywords.map((kw, index) => (
                  <tr key={`${kw.keyword}-${index}`} className="border-t">
                    <td className="p-3">
                      <Checkbox checked={kw.selected} onCheckedChange={(v) => toggleKeyword(index, Boolean(v))} />
                    </td>
                    <td className="p-3 font-medium">{kw.keyword}</td>
                    <td className="p-3">
                      <Badge variant="secondary">{kw.score}</Badge>
                    </td>
                    <td className="p-3">
                      <Select
                        value={kw.matchType}
                        onValueChange={(v) => updateMatchType(index, v as AdsKeywordMatchType)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EXACT">EXACT</SelectItem>
                          <SelectItem value="PHRASE">PHRASE</SelectItem>
                          <SelectItem value="BROAD">BROAD</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {kw.sources.join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Daily budget (USD)</Label>
              <Input value={dailyBudget} onChange={(e) => setDailyBudget(e.target.value)} type="number" min="1" />
            </div>
            <div className="space-y-2">
              <Label>Campaign name</Label>
              <Input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} />
            </div>
          </div>

          <Button
            onClick={() => launchMutation.mutate()}
            disabled={launchMutation.isPending || selectedCount === 0 || project?.status === "active"}
            className="gap-2"
          >
            {launchMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            Create Amazon campaign
          </Button>

          {project?.amazonCampaignId && (
            <p className="text-xs text-muted-foreground font-mono">
              Amazon campaign ID: {project.amazonCampaignId}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
