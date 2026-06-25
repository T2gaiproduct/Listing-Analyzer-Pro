import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Search, Image, Users, RotateCcw, Trash2, AlertCircle, Video, Megaphone } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useActionDialog } from "@/components/ui/action-dialog";

interface ArchivedItem {
  id: number;
  type: "audit" | "project" | "video" | "ad" | "competitor" | "teamMember";
  userId?: string;
  productName?: string;
  name?: string;
  invitedName?: string;
  invitedEmail?: string;
  asin?: string;
  category?: string;
  overallScore?: number;
  status?: string;
  role?: string;
  deletedAt?: string | null;
  updatedAt?: string | null;
  createdAt: string;
}

interface ArchiveResponse {
  audits: ArchivedItem[];
  projects: ArchivedItem[];
  videos: ArchivedItem[];
  ads: ArchivedItem[];
  competitors: ArchivedItem[];
  teamMembers: ArchivedItem[];
}

const basePath = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function fetchArchive(): Promise<ArchiveResponse> {
  return fetch(`${basePath}/api/archive`, { credentials: "include" }).then((r) => r.json());
}

function useArchive() {
  return useQuery({ queryKey: ["archive"], queryFn: fetchArchive });
}

function archivedAgo(item: ArchivedItem): string {
  const ts = item.deletedAt ?? item.updatedAt;
  if (!ts) return "";
  try { return formatDistanceToNow(new Date(ts), { addSuffix: true }); }
  catch { return ""; }
}

function RecoverButton({ type, id }: { type: string; id: number }) {
  const qc = useQueryClient();
  const { trigger, dialog } = useActionDialog();
  const recover = useMutation({
    mutationFn: () =>
      fetch(`${basePath}/api/archive/${type}/${id}/recover`, { method: "POST", credentials: "include" }).then((r) => r.json()),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["archive"] });
      void qc.invalidateQueries({ queryKey: ["/api/recents"] });
    },
  });

  function handleClick() {
    trigger(
      async () => { await recover.mutateAsync(); },
      {
        title: "Restore this item?",
        description: "It will reappear in your Recent Projects feed.",
        confirmLabel: "Restore",
        successTitle: "Restored!",
        successDescription: "The item is back in your projects.",
      }
    );
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="gap-1 text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
        onClick={handleClick}
      >
        <RotateCcw className="w-3.5 h-3.5" />
        Restore
      </Button>
      {dialog}
    </>
  );
}

function DeleteButton({ type, id }: { type: string; id: number }) {
  const qc = useQueryClient();
  const { trigger, dialog } = useActionDialog();
  const del = useMutation({
    mutationFn: () =>
      fetch(`${basePath}/api/archive/${type}/${id}`, { method: "DELETE", credentials: "include" }).then((r) => r.ok),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["archive"] }); },
  });

  function handleClick() {
    trigger(
      async () => { await del.mutateAsync(); },
      {
        title: "Delete permanently?",
        description: "This item will be removed forever and cannot be recovered.",
        confirmLabel: "Delete forever",
        confirmVariant: "destructive",
        successTitle: "Deleted",
        successDescription: "The item has been permanently removed.",
      }
    );
  }

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="text-red-500 hover:text-red-600 hover:bg-red-50"
        onClick={handleClick}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
      {dialog}
    </>
  );
}

function ArchiveList({
  items,
  emptyLabel,
  icon: Icon,
}: {
  items: ArchivedItem[];
  emptyLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <AlertCircle className="w-8 h-8 mb-3 opacity-40" />
        <p className="text-sm">No archived {emptyLabel} found</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <Card key={item.id} className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-orange-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold truncate">
                      {item.productName || item.name || item.invitedName || `Item #${item.id}`}
                    </p>
                    {item.overallScore !== undefined && (
                      <Badge variant="outline" className="text-xs">Score: {item.overallScore}</Badge>
                    )}
                    {item.role && (
                      <Badge variant="outline" className="text-xs capitalize">{item.role}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    {item.asin && <span>ASIN: {item.asin}</span>}
                    {item.invitedEmail && <span>{item.invitedEmail}</span>}
                    {(() => { const ago = archivedAgo(item); return ago ? <span>Archived {ago}</span> : null; })()}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <RecoverButton type={item.type} id={item.id} />
                <DeleteButton type={item.type} id={item.id} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function ArchivePage() {
  const { data, isLoading } = useArchive();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    );
  }

  const audits = data?.audits ?? [];
  const projects = data?.projects ?? [];
  const videos = data?.videos ?? [];
  const ads = data?.ads ?? [];
  const competitors = data?.competitors ?? [];
  const teamMembers = data?.teamMembers ?? [];
  const total = audits.length + projects.length + videos.length + ads.length + competitors.length + teamMembers.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Archive</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {total} archived item{total !== 1 ? "s" : ""}
        </p>
      </div>

      <Tabs defaultValue="audits" className="w-full">
        <TabsList className="flex flex-wrap gap-1 h-auto w-full max-w-2xl">
          <TabsTrigger value="audits" className="gap-1">
            <Search className="w-3.5 h-3.5" />
            Audits {audits.length > 0 && `(${audits.length})`}
          </TabsTrigger>
          <TabsTrigger value="projects" className="gap-1">
            <Image className="w-3.5 h-3.5" />
            Graphics {projects.length > 0 && `(${projects.length})`}
          </TabsTrigger>
          <TabsTrigger value="videos" className="gap-1">
            <Video className="w-3.5 h-3.5" />
            Videos {videos.length > 0 && `(${videos.length})`}
          </TabsTrigger>
          <TabsTrigger value="ads" className="gap-1">
            <Megaphone className="w-3.5 h-3.5" />
            Ads {ads.length > 0 && `(${ads.length})`}
          </TabsTrigger>
          <TabsTrigger value="competitors" className="gap-1">
            <Package className="w-3.5 h-3.5" />
            Competitors {competitors.length > 0 && `(${competitors.length})`}
          </TabsTrigger>
          <TabsTrigger value="team" className="gap-1">
            <Users className="w-3.5 h-3.5" />
            Team {teamMembers.length > 0 && `(${teamMembers.length})`}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="audits" className="mt-4">
          <ArchiveList items={audits} emptyLabel="audits" icon={Search} />
        </TabsContent>
        <TabsContent value="projects" className="mt-4">
          <ArchiveList items={projects} emptyLabel="graphics projects" icon={Image} />
        </TabsContent>
        <TabsContent value="videos" className="mt-4">
          <ArchiveList items={videos} emptyLabel="video projects" icon={Video} />
        </TabsContent>
        <TabsContent value="ads" className="mt-4">
          <ArchiveList items={ads} emptyLabel="ad projects" icon={Megaphone} />
        </TabsContent>
        <TabsContent value="competitors" className="mt-4">
          <ArchiveList items={competitors} emptyLabel="competitors" icon={Package} />
        </TabsContent>
        <TabsContent value="team" className="mt-4">
          <ArchiveList items={teamMembers} emptyLabel="team members" icon={Users} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
