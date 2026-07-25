import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useUser } from "@clerk/react";
import { formatDistanceToNow } from "date-fns";
import {
  Search,
  Plus,
  LayoutGrid,
  List,
  BarChart3,
  Folder,
  ChevronLeft,
  ChevronRight,
  Pin,
} from "lucide-react";
import { useGetRecents, getGetRecentsQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useTeam } from "@/hooks/use-team";
import { useRecentProjectMutations } from "@/hooks/use-recent-project-mutations";
import { RecentProjectMenu, type EnrichedRecentItem } from "@/components/recent-project-menu";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const PAGE_SIZE = 10;

function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const trimmed = url.trim();
  if (
    trimmed.startsWith("http://")
    || trimmed.startsWith("https://")
    || trimmed.startsWith("data:")
    || trimmed.startsWith("blob:")
  ) {
    return trimmed;
  }
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  return `${basePath}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
}

function ProjectThumbnail({ imageUrl, alt, compact }: { imageUrl: string | null; alt: string; compact?: boolean }) {
  const [failed, setFailed] = useState(false);
  const src = imageUrl && !failed ? imageUrl : null;

  if (!src) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Folder className={cn(compact ? "w-5 h-5" : "w-8 h-8", "text-slate-300")} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
      onError={() => setFailed(true)}
    />
  );
}

function updatedLabel(item: EnrichedRecentItem): string {
  const raw = item.updatedAt ?? item.createdAt;
  if (!raw) return "Recently";
  const date = typeof raw === "string" ? new Date(raw) : raw;
  if (Number.isNaN(date.getTime())) return "Recently";
  return `Updated ${formatDistanceToNow(date, { addSuffix: true })}`;
}

function ProjectCard({
  item,
  onPin,
  onRename,
  onArchive,
  onDelete,
}: {
  item: EnrichedRecentItem;
  onPin: () => void;
  onRename: (name: string) => Promise<void>;
  onArchive: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const image = resolveImageUrl(item.imageUrl);
  const showScore = item.score != null && item.score > 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden hover:shadow-md transition-shadow group">
      <Link href={item.url} className="block">
        <div className="relative aspect-[16/9] max-h-36 bg-slate-100 overflow-hidden">
          <ProjectThumbnail imageUrl={image} alt={item.name} />
          {showScore && (
            <div className="absolute bottom-2 right-2 w-9 h-9 rounded-full bg-white border-2 border-orange-400 flex items-center justify-center shadow-sm">
              <span className="text-xs font-bold text-orange-600">{item.score}</span>
            </div>
          )}
          {item.pinned && (
            <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-white/90 flex items-center justify-center shadow-sm">
              <Pin className="w-3 h-3 text-orange-500 fill-orange-500" />
            </div>
          )}
        </div>
      </Link>
      <div className="p-4">
        <Link href={item.url}>
          <h3 className="font-semibold text-slate-900 line-clamp-2 group-hover:text-orange-600 transition-colors">
            {item.name}
          </h3>
        </Link>
        <div className="flex items-center gap-1.5 mt-2 text-orange-500">
          <BarChart3 className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">{item.typeLabel ?? "Project"}</span>
        </div>
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
          <span className="text-xs text-slate-400">{updatedLabel(item)}</span>
          <RecentProjectMenu
            item={item}
            onPin={onPin}
            onRename={onRename}
            onArchive={onArchive}
            onDelete={onDelete}
          />
        </div>
      </div>
    </div>
  );
}

function ProjectListRow({
  item,
  onPin,
  onRename,
  onArchive,
  onDelete,
}: {
  item: EnrichedRecentItem;
  onPin: () => void;
  onRename: (name: string) => Promise<void>;
  onArchive: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const image = resolveImageUrl(item.imageUrl);

  return (
    <div className="flex items-center gap-4 px-4 py-3 sm:px-6 sm:py-4 hover:bg-slate-50 transition-colors group">
      <Link href={item.url} className="flex items-center gap-4 flex-1 min-w-0">
        <div className="w-14 h-14 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0">
          <ProjectThumbnail imageUrl={image} alt={item.name} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 truncate group-hover:text-orange-600 transition-colors">{item.name}</p>
          <p className="text-xs text-orange-500 mt-0.5">{item.typeLabel ?? "Project"}</p>
        </div>
        {item.score != null && item.score > 0 && (
          <span className="text-sm font-bold text-orange-600 border border-orange-300 rounded-full w-9 h-9 flex items-center justify-center flex-shrink-0">
            {item.score}
          </span>
        )}
        <span className="text-xs text-slate-400 hidden sm:block flex-shrink-0">{updatedLabel(item)}</span>
      </Link>
      <RecentProjectMenu
        item={item}
        onPin={onPin}
        onRename={onRename}
        onArchive={onArchive}
        onDelete={onDelete}
      />
    </div>
  );
}

export default function RecentProjectsPage() {
  const { user, isLoaded: clerkLoaded } = useUser();
  const { isTeamMember } = useTeam();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(1);

  const recentsScope = isTeamMember ? "member" : "owner";
  const { data, isLoading } = useGetRecents(
    { limit: 200 },
    {
      query: {
        queryKey: [...getGetRecentsQueryKey({ limit: 200 }), recentsScope],
        staleTime: 30_000,
        enabled: clerkLoaded && !!user,
      },
    },
  );

  const { pinMutation, renameMutation, archiveMutation, deleteMutation } = useRecentProjectMutations(200);
  const items = (data?.items ?? []) as EnrichedRecentItem[];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    return items.filter((item) => {
      if (q && !item.name.toLowerCase().includes(q)) return false;
      if (typeFilter !== "all" && item.type !== typeFilter) return false;
      if (dateFilter !== "all") {
        const raw = item.updatedAt ?? item.createdAt;
        const ts = raw ? new Date(raw).getTime() : 0;
        const days = (now - ts) / (1000 * 60 * 60 * 24);
        if (dateFilter === "7d" && days > 7) return false;
        if (dateFilter === "30d" && days > 30) return false;
      }
      return true;
    });
  }, [items, search, typeFilter, dateFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const actionProps = (item: EnrichedRecentItem) => ({
    onPin: () => pinMutation.mutate({ type: item.type, id: item.id }),
    onRename: (name: string) => renameMutation.mutateAsync({ type: item.type, id: item.id, name }),
    onArchive: () => archiveMutation.mutateAsync({ type: item.type, id: item.id }),
    onDelete: () => deleteMutation.mutateAsync({ type: item.type, id: item.id }),
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-in fade-in">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-11 w-full max-w-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 w-full min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Recent Projects</h1>
          <p className="text-sm text-slate-500 mt-1">Quick access to your recently worked on projects.</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="gap-2 bg-orange-500 hover:bg-orange-600 text-white shrink-0">
              <Plus className="w-4 h-4" />
              New Project
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem asChild>
              <Link href="/audits/new">Build Your Brand</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/audit-listings">Audit Listings</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/projects/create">Create Graphics</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/videos">Create Videos</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/ads">Manage Ads</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search recent projects..."
            className="pl-9 h-11 rounded-xl bg-white"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[120px] h-10 rounded-full bg-white">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Type</SelectItem>
              <SelectItem value="listing">Brand</SelectItem>
              <SelectItem value="audit">Audit</SelectItem>
              <SelectItem value="graphics">Graphics</SelectItem>
              <SelectItem value="video">Video</SelectItem>
              <SelectItem value="ads">Ads</SelectItem>
            </SelectContent>
          </Select>
          <Select value={dateFilter} onValueChange={(v) => { setDateFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[150px] h-10 rounded-full bg-white">
              <SelectValue placeholder="Date Modified" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Date Modified</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center rounded-full border border-slate-200 bg-white p-1 ml-auto lg:ml-0">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={cn(
                "w-9 h-8 flex items-center justify-center rounded-full transition-colors",
                viewMode === "grid" ? "bg-orange-500 text-white" : "text-slate-500 hover:text-slate-700",
              )}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={cn(
                "w-9 h-8 flex items-center justify-center rounded-full transition-colors",
                viewMode === "list" ? "bg-orange-500 text-white" : "text-slate-500 hover:text-slate-700",
              )}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {pageItems.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm px-6 py-16 text-center">
          <Folder className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600 font-medium">No projects found</p>
          <p className="text-sm text-slate-400 mt-1">
            {items.length === 0 ? "Start a new project to see it here." : "Try adjusting your search or filters."}
          </p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {pageItems.map((item) => (
            <ProjectCard key={`${item.type}-${item.id}`} item={item} {...actionProps(item)} />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden divide-y divide-slate-100">
          {pageItems.map((item) => (
            <ProjectListRow key={`${item.type}-${item.id}`} item={item} {...actionProps(item)} />
          ))}
        </div>
      )}

      {filtered.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <p className="text-sm text-slate-500">
            Showing {(currentPage - 1) * PAGE_SIZE + 1} to {Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} projects
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-lg"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            {Array.from({ length: totalPages }).map((_, i) => {
              const n = i + 1;
              if (totalPages > 5 && Math.abs(n - currentPage) > 1 && n !== 1 && n !== totalPages) {
                if (n === 2 || n === totalPages - 1) {
                  return <span key={n} className="px-1 text-slate-400">…</span>;
                }
                return null;
              }
              return (
                <Button
                  key={n}
                  variant={n === currentPage ? "default" : "outline"}
                  size="icon"
                  className={cn("h-9 w-9 rounded-lg", n === currentPage && "bg-orange-500 hover:bg-orange-600")}
                  onClick={() => setPage(n)}
                >
                  {n}
                </Button>
              );
            })}
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-lg"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
