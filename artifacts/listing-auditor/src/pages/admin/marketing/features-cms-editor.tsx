import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { HomepageCmsMap } from "@/lib/homepage-cms";
import { HOMEPAGE_CMS_DEFAULTS } from "@/lib/homepage-cms";
import { featureItemKeys, MAX_FEATURE_ITEMS } from "@/lib/features-cms";

interface FeaturesCmsEditorProps {
  data: HomepageCmsMap;
  onChange: (key: string, val: string) => void;
}

function placeholder(key: string): string {
  return HOMEPAGE_CMS_DEFAULTS[key] ?? "";
}

export function FeaturesCmsEditor({ data, onChange }: FeaturesCmsEditorProps) {
  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700">Section header</CardTitle>
          <p className="text-xs text-slate-500 mt-1">
            Heading and subheading shown above the feature cards on the homepage.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs text-slate-500">Eyebrow (mobile)</Label>
            <Input
              className="mt-1 h-8 text-sm"
              value={data["features.eyebrow"] ?? ""}
              placeholder={placeholder("features.eyebrow")}
              onChange={(e) => onChange("features.eyebrow", e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs text-slate-500">Section heading</Label>
            <Input
              className="mt-1 h-8 text-sm"
              value={data["features.heading"] ?? ""}
              placeholder={placeholder("features.heading")}
              onChange={(e) => onChange("features.heading", e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs text-slate-500">Section subheading</Label>
            <Textarea
              className="mt-1 text-sm resize-none"
              rows={2}
              value={data["features.subheading"] ?? ""}
              placeholder={placeholder("features.subheading")}
              onChange={(e) => onChange("features.subheading", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700">Feature cards</CardTitle>
          <p className="text-xs text-slate-500 mt-1">
            Up to {MAX_FEATURE_ITEMS} features. Each card needs a title to appear on the homepage. Click Save Changes when done.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: MAX_FEATURE_ITEMS }, (_, i) => i + 1).map((index) => {
            const keys = featureItemKeys(index);
            const title = data[keys.title] ?? "";

            return (
              <Card key={index} className="border border-slate-200 shadow-none">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm font-medium text-slate-800">
                    Feature {index}
                    {title ? ` — ${title}` : ""}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  <div>
                    <Label className="text-xs text-slate-500">Title</Label>
                    <Input
                      className="mt-1 h-8 text-sm"
                      value={title}
                      placeholder={placeholder(keys.title)}
                      onChange={(e) => onChange(keys.title, e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Description</Label>
                    <Textarea
                      className="mt-1 text-sm resize-none"
                      rows={2}
                      value={data[keys.desc] ?? ""}
                      placeholder={placeholder(keys.desc)}
                      onChange={(e) => onChange(keys.desc, e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Link URL</Label>
                    <Input
                      className="mt-1 h-8 text-sm"
                      value={data[keys.href] ?? ""}
                      placeholder={placeholder(keys.href)}
                      onChange={(e) => onChange(keys.href, e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
