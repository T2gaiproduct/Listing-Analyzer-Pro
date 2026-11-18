import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { HomepageCmsMap } from "@/lib/homepage-cms";
import {
  MAX_ABOUT_MILESTONES,
  MAX_ABOUT_MISSION_HIGHLIGHTS,
  MAX_ABOUT_VALUES,
  milestoneKeys,
  missionHighlightKeys,
  valueKeys,
} from "@/lib/about-cms";

interface AboutCmsEditorProps {
  data: HomepageCmsMap;
  onChange: (key: string, val: string) => void;
}

export function AboutCmsEditor({ data, onChange }: AboutCmsEditorProps) {
  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700">Mission highlights (sidebar cards)</CardTitle>
          <p className="text-xs text-slate-500 mt-1">Shown beside &quot;Our Mission&quot; on /about. Icons are fixed per slot.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: MAX_ABOUT_MISSION_HIGHLIGHTS }, (_, i) => i + 1).map((index) => {
            const keys = missionHighlightKeys(index);
            return (
              <div key={index} className="rounded-lg border border-slate-200 p-3 space-y-2">
                <p className="text-xs font-medium text-slate-600">Highlight {index}</p>
                <Input
                  className="h-8 text-sm"
                  value={data[keys.title] ?? ""}
                  onChange={(e) => onChange(keys.title, e.target.value)}
                  placeholder="Instant Analysis"
                />
                <Textarea
                  className="text-sm resize-none"
                  rows={2}
                  value={data[keys.desc] ?? ""}
                  onChange={(e) => onChange(keys.desc, e.target.value)}
                  placeholder="Short supporting line"
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700">Values grid</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: MAX_ABOUT_VALUES }, (_, i) => i + 1).map((index) => {
            const keys = valueKeys(index);
            return (
              <div key={index} className="rounded-lg border border-slate-200 p-3 space-y-2">
                <p className="text-xs font-medium text-slate-600">Value {index}</p>
                <Input
                  className="h-8 text-sm"
                  value={data[keys.title] ?? ""}
                  onChange={(e) => onChange(keys.title, e.target.value)}
                />
                <Textarea
                  className="text-sm resize-none"
                  rows={2}
                  value={data[keys.desc] ?? ""}
                  onChange={(e) => onChange(keys.desc, e.target.value)}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700">Journey timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: MAX_ABOUT_MILESTONES }, (_, i) => i + 1).map((index) => {
            const keys = milestoneKeys(index);
            return (
              <div key={index} className="rounded-lg border border-slate-200 p-3 space-y-2">
                <p className="text-xs font-medium text-slate-600">Milestone {index}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs text-slate-500">Year</Label>
                    <Input
                      className="mt-1 h-8 text-sm"
                      value={data[keys.year] ?? ""}
                      onChange={(e) => onChange(keys.year, e.target.value)}
                      placeholder="2026"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs text-slate-500">Title</Label>
                    <Input
                      className="mt-1 h-8 text-sm"
                      value={data[keys.title] ?? ""}
                      onChange={(e) => onChange(keys.title, e.target.value)}
                    />
                  </div>
                </div>
                <Textarea
                  className="text-sm resize-none"
                  rows={2}
                  value={data[keys.desc] ?? ""}
                  onChange={(e) => onChange(keys.desc, e.target.value)}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}