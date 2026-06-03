import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Search, Image, Users, RotateCcw, Trash2, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ArchivedItem {
  id: number;
  type: "audit" | "project" | "competitor" | "teamMember";
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
  deletedAt: string;
  createdAt: string;
}

interface ArchiveResponse {
  audits: ArchivedItem[];
  projects: ArchivedItem[];
  competitors: ArchivedItem[];
  teamMembers: ArchivedItem[];
}

function fetchArchive(): Promise<ArchiveResponse> {
  return fetch("/api/archive").then((r) => r.json());
}

function RecoverButton({ type, id }: { type: string; id: number }) {
  const qc = useQueryClient();
  const recover = useMutation({
    mutationFn: () => fetch(`/api/archive/${type}/${id}/recover`, { method: "POST" }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["archive"] });
      qc.invalidateQueries({ queryKey: ["admin-audits"] });
      qc.invalidateQueries({ queryKey: ["admin-graphics-logs"] });
      qc.invalidateQueries({ queryKey: ["admin-team-activity"] });
    },
  });

  return (
    <Button
      size="sm"
      variant="outline"
      className="gap-1 text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
      onClick={() => recover.mutate()}
      disabled={recover.isPending}
    >
      <RotateCcw className="w-3.5 h-3.5" />
      Recover
    </Button>
  );
}

function DeleteButton({ type, id }: { type: string; id: number }) {
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const del = useMutation({
    mutationFn: () => fetch(`/api/archive/${type}/${id}`, { method: "DELETE" }).then((r) => r.ok),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["archive"] });
      setConfirming(false);
    },
  });

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <Button size="sm" variant="ghost" className="text-xs text-muted-foreground" onClick={() => setConfirming(false)}>Cancel</Button>
        <Button size="sm" variant="destructive" className="text-xs" onClick={() => del.mutate()} disabled={del.isPending}>
          {del.isPending ? "Deleting..." : "Confirm Delete"}
        </Button>
      </div>
    );
  }

  return (
    <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => setConfirming(true)}>
      <Trash2 className="w-3.5 h-3.5" />
    </Button>
  );
}

function ArchiveList({ items, type, icon: Icon }: { items: ArchivedItem[]; type: string; icon: React.ComponentType<{ className?: string }> }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <AlertCircle className="w-8 h-8 mb-3 opacity-40" />
        <p className="text-sm">No archived {type}s found</p>
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
                <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-slate-600" />
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
                    {item.userId && (
                      <Badge variant="secondary" className="text-xs">User: {item.userId.slice(0, 8)}...</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    {item.asin && <span>ASIN: {item.asin}</span>}
                    {item.invitedEmail && <span>{item.invitedEmail}</span>}
                    {item.status && <span className="capitalize">{item.status}</span>}
                    <span>Deleted {formatDistanceToNow(new Date(item.deletedAt), { addSuffix: true })}</span>
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

export default function AdminArchivePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["archive"],
    queryFn: fetchArchive,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-500" />
      </div>
    );
  }

  const audits = data?.audits ?? [];
  const projects = data?.projects ?? [];
  const competitors = data?.competitors ?? [];
  const teamMembers = data?.teamMembers ?? [];
  const total = audits.length + projects.length + competitors.length + teamMembers.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Archive</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {total} deleted item{total !== 1 ? "s" : ""} across all users
          </p>
        </div>
      </div>

      <Tabs defaultValue="audits" className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-md">
          <TabsTrigger value="audits" className="gap-1">
            <Search className="w-3.5 h-3.5" />
            Audits {audits.length > 0 && `(${audits.length})`}
          </TabsTrigger>
          <TabsTrigger value="projects" className="gap-1">
            <Image className="w-3.5 h-3.5" />
            Projects {projects.length > 0 && `(${projects.length})`}
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
          <ArchiveList items={audits} type="audit" icon={Search} />
        </TabsContent>
        <TabsContent value="projects" className="mt-4">
          <ArchiveList items={projects} type="project" icon={Image} />
        </TabsContent>
        <TabsContent value="competitors" className="mt-4">
          <ArchiveList items={competitors} type="competitor" icon={Package} />
        </TabsContent>
        <TabsContent value="team" className="mt-4">
          <ArchiveList items={teamMembers} type="team member" icon={Users} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
