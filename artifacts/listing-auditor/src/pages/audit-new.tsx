import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Upload, FileText, Image, FileText as FileTextIcon, Download, Sparkles, MoreVertical, Edit, Trash2 } from "lucide-react";

const steps = [
  { number: "1", icon: Upload, title: "Upload Product Information", desc: "Upload product data or click the picture" },
  { number: "2", icon: FileText, title: "Listing", desc: "AI generates compelling product titles, bullets & descriptions" },
  { number: "3", icon: Image, title: "Graphics", desc: "Create stunning product images and infographics" },
  { number: "4", icon: FileTextIcon, title: "A+ Content", desc: "Generate professional A+ content to boost conversions" },
  { number: "5", icon: Download, title: "Export", desc: "Export and publish your listing to your store" },
];

type SavedProject = {
  id: string;
  name: string;
  category: string;
  images: number;
  date: string;
  url?: string;
};

const LS_RECENT = "listing_auditor_recent_projects";
const LS_DRAFT  = "listing_auditor_draft_projects";

function loadProjects(key: string): SavedProject[] {
  try { return JSON.parse(localStorage.getItem(key) ?? "[]") as SavedProject[]; } catch { return []; }
}

const menuOptions = [
  { label: "Open", icon: ArrowRight, danger: false },
  { label: "Share", icon: Sparkles, danger: false },
  { label: "Rename", icon: Edit, danger: false },
  { label: "Delete", icon: Trash2, danger: true },
];

function ProjectRow({ project, onDelete, onRename }: { project: SavedProject; onDelete: () => void; onRename: (name: string) => void }) {
  const [, setLocation] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState(project.name);

  function handleClick() {
    const targetUrl = project.url || `/audits/workflow?resume=${project.id}`;
    setLocation(targetUrl);
  }

  function handleMenuAction(label: string) {
    setMenuOpen(false);
    if (label === "Open") {
      const targetUrl = project.url || `/audits/workflow?resume=${project.id}`;
      setLocation(targetUrl);
    } else if (label === "Share") {
      const shareUrl = `${window.location.origin}${project.url || `/audits/workflow?resume=${project.id}`}`;
      navigator.clipboard.writeText(shareUrl).catch(() => {});
      alert("Link copied to clipboard!");
    } else if (label === "Rename") {
      setRenameOpen(true);
    } else if (label === "Delete") {
      onDelete();
    }
  }

  return (
    <div className="relative">
      <div
        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
        onClick={handleClick}
      >
        <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
          <Image className="w-5 h-5 text-slate-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{project.name}</p>
          <p className="text-xs text-muted-foreground">
            {project.category} • {project.images} image{project.images !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground">{project.date}</span>
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </Button>
            {menuOpen && (
              <div
                className="absolute right-0 top-8 z-50 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden w-36"
                onClick={(e) => e.stopPropagation()}
              >
                {menuOptions.map(({ label, icon: Icon, danger }) => (
                  <button
                    key={label}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${danger ? "text-red-600 hover:bg-red-50" : "text-slate-700 hover:bg-slate-50"}`}
                    onClick={() => handleMenuAction(label)}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {renameOpen && (
        <div className="absolute inset-0 bg-white rounded-lg z-50 flex items-center gap-2 px-3 py-2 shadow-lg border border-slate-200">
          <input
            className="flex-1 text-sm border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-orange-300"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { onRename(newName); setRenameOpen(false); }
              if (e.key === "Escape") { setRenameOpen(false); setNewName(project.name); }
            }}
            autoFocus
          />
          <button
            className="text-xs text-orange-600 font-semibold hover:text-orange-700"
            onClick={() => { onRename(newName); setRenameOpen(false); }}
          >
            Save
          </button>
          <button
            className="text-xs text-slate-400 hover:text-slate-600"
            onClick={() => { setRenameOpen(false); setNewName(project.name); }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

export default function AuditNew() {
  const [, setLocation] = useLocation();
  const [recentProjects, setRecentProjects] = useState<SavedProject[]>([]);
  const [draftProjects, setDraftProjects]   = useState<SavedProject[]>([]);

  useEffect(() => {
    setRecentProjects(loadProjects(LS_RECENT));
    setDraftProjects(loadProjects(LS_DRAFT));
  }, []);

  function deleteRecent(id: string) {
    const updated = recentProjects.filter((p) => p.id !== id);
    setRecentProjects(updated);
    localStorage.setItem(LS_RECENT, JSON.stringify(updated));
  }

  function renameRecent(id: string, name: string) {
    const updated = recentProjects.map((p) => (p.id === id ? { ...p, name } : p));
    setRecentProjects(updated);
    localStorage.setItem(LS_RECENT, JSON.stringify(updated));
  }

  function deleteDraft(id: string) {
    const updated = draftProjects.filter((p) => p.id !== id);
    setDraftProjects(updated);
    localStorage.setItem(LS_DRAFT, JSON.stringify(updated));
  }

  function renameDraft(id: string, name: string) {
    const updated = draftProjects.map((p) => (p.id === id ? { ...p, name } : p));
    setDraftProjects(updated);
    localStorage.setItem(LS_DRAFT, JSON.stringify(updated));
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-500 max-w-5xl mx-auto">
      {/* Hero */}
      <div className="text-center pt-6 pb-2">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          Create Product Listings{" "}
          <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">Using AI</span>
          <Sparkles className="inline w-6 h-6 text-orange-400 ml-1 align-middle" />
        </h1>
        <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
          Turn product information into high-converting listings in minutes.
        </p>
        <Button
          size="lg"
          className="mt-6 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-8 rounded-xl shadow-lg shadow-orange-500/20"
          onClick={() => setLocation("/audits/workflow")}
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Start Generating
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
        <p className="text-xs text-muted-foreground mt-3">
          Works with Shopify, Walmart, eBay, and most product pages
        </p>
      </div>

      {/* How It Works */}
      <div className="space-y-6">
        <div className="flex items-center justify-center gap-3">
          <div className="h-px w-8 bg-orange-300" />
          <span className="text-xs font-semibold text-orange-500 uppercase tracking-widest">How It Works</span>
          <div className="h-px w-8 bg-orange-300" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={step.number} className="relative">
                <Card className="border-border/60 hover:border-orange-300/50 transition-colors h-full">
                  <CardContent className="p-5 flex flex-col items-center text-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center text-orange-600">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{step.title}</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-snug">{step.desc}</p>
                    </div>
                  </CardContent>
                </Card>
                {i < steps.length - 1 && (
                  <div className="hidden lg:flex absolute top-1/2 -right-3 w-6 items-center justify-center z-10">
                    <ArrowRight className="w-4 h-4 text-orange-300" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Projects */}
        <Card className="border-border/60">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">Recent Projects</h3>
              <Button variant="ghost" size="sm" className="text-orange-500 text-xs h-7 px-2">
                View All
              </Button>
            </div>
            {recentProjects.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No recent projects yet.<br />
                <span className="text-xs">Saved projects will appear here.</span>
              </div>
            ) : (
              <div className="space-y-1">
                {recentProjects.slice(0, 5).map((project) => (
                  <ProjectRow
                    key={project.id}
                    project={project}
                    onDelete={() => deleteRecent(project.id)}
                    onRename={(name) => renameRecent(project.id, name)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Draft Projects */}
        <Card className="border-border/60">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">Draft Projects</h3>
              <Button variant="ghost" size="sm" className="text-orange-500 text-xs h-7 px-2">
                View All
              </Button>
            </div>
            {draftProjects.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No drafts yet.<br />
                <span className="text-xs">Use "Save Draft" while working to save here.</span>
              </div>
            ) : (
              <div className="space-y-1">
                {draftProjects.slice(0, 5).map((project) => (
                  <ProjectRow
                    key={project.id}
                    project={project}
                    onDelete={() => deleteDraft(project.id)}
                    onRename={(name) => renameDraft(project.id, name)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
