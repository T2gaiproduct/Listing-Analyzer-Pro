import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ImageIcon, Plus, MoreVertical, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface GraphicsProject {
  id: number;
  name: string;
  productName: string;
  status: string;
  lifestyleCount: number;
  featureCount: number;
  imageRecords?: Array<{ type: string; currentUrl: string }>;
  updatedAt: string;
  createdAt: string;
}

function fetchProjects(): Promise<{ projects: GraphicsProject[] }> {
  return fetch(`${basePath}/api/graphics/projects`, { credentials: "include" }).then((r) => r.json());
}

export default function ProjectsPage() {
  const [, nav] = useLocation();
  const { data, isLoading } = useQuery({
    queryKey: ["graphics-projects"],
    queryFn: fetchProjects,
  });

  const projects = data?.projects ?? [];

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Hero */}
      <div className="relative bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-8 border border-purple-100">
        <div className="flex items-start justify-between">
          <div className="max-w-md">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              Create Professional<br />Product Graphics
            </h1>
            <p className="text-slate-500 mb-6">
              Generate stunning lifestyle images and feature graphics for your products in minutes.
            </p>
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-6 py-2.5 font-semibold"
              onClick={() => nav("/projects/create")}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create New Project
            </Button>
          </div>
          <div className="hidden md:block">
            <img
              src="https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=200&h=200&fit=crop"
              alt="Product"
              className="w-40 h-40 rounded-full object-cover border-4 border-white shadow-lg"
            />
          </div>
        </div>
      </div>

      {/* Recent Projects */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Recent Projects</h2>
          {projects.length > 0 && (
            <button className="text-sm text-purple-600 font-medium hover:text-purple-700">
              View all
            </button>
          )}
        </div>

        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 bg-slate-50 rounded-lg animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && projects.length === 0 && (
          <Card className="border-0 shadow-sm bg-white">
            <CardContent className="py-12 text-center">
              <ImageIcon className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">No projects yet. Create your first graphics project!</p>
            </CardContent>
          </Card>
        )}

        {!isLoading && projects.length > 0 && (
          <div className="space-y-3">
            {projects.map((p) => {
              const firstImage = p.imageRecords?.[0]?.currentUrl;
              const totalGraphics = p.lifestyleCount + p.featureCount;
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-4 p-4 bg-white rounded-lg border border-slate-100 hover:border-purple-200 hover:shadow-sm transition-all cursor-pointer"
                  onClick={() => nav(`/projects/${p.id}`)}
                >
                  <div className="w-14 h-14 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0">
                    {firstImage ? (
                      <img src={firstImage} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-6 h-6 text-slate-300" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900 text-sm truncate">{p.name}</h3>
                      <StatusBadge status={p.status} />
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Updated {formatDistanceToNow(new Date(p.updatedAt), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-purple-600 border-purple-200 bg-purple-50 text-xs font-semibold">
                      {totalGraphics} {totalGraphics === 1 ? "Graphic" : "Graphics"}
                    </Badge>
                    <button className="p-1 rounded-md hover:bg-slate-50 text-slate-400">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const classes: Record<string, string> = {
    draft: "bg-slate-100 text-slate-600",
    generating: "bg-yellow-50 text-yellow-600",
    completed: "bg-green-50 text-green-600",
    failed: "bg-red-50 text-red-600",
  };
  return (
    <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${classes[status] ?? classes.draft}`}>
      {status}
    </span>
  );
}
