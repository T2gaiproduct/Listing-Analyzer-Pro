import { useCallback, useMemo, useRef, useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft, FileUp, Play } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ADMIN_AI_SKILLS_HREF } from "@/lib/admin-ai-settings-nav";
import { useAdminContentMarketplaces } from "@/lib/content-marketplaces";
import { useAdminProductCategories } from "@/lib/graphics-module-examples";
import {
  DEFAULT_SKILL_INSTRUCTIONS_TEXT,
  SAMPLE_PRODUCTS,
  type SkillType,
  parseSkillInstructions,
  runSkillTest,
} from "@/lib/admin-skill-editor";

const AI_MODELS = [
  "Claude Sonnet 5.5",
  "GPT-5.4",
  "Gemini 2.5 Flash",
  "OpenAI GPT-4o",
] as const;

export default function AdminAiSkillEditorPage() {
  const { toast } = useToast();
  const [, params] = useRoute("/admin/settings/ai/skills/:skillId");
  const skillId = params?.skillId ?? "new";
  const isNew = skillId === "new";

  const [instructionsText, setInstructionsText] = useState(DEFAULT_SKILL_INSTRUCTIONS_TEXT);
  const [skillType, setSkillType] = useState<SkillType>("product_content");
  const [category, setCategory] = useState("Home Decor");
  const [marketplace, setMarketplace] = useState("amazon");
  const [aiModel, setAiModel] = useState<string>(AI_MODELS[0]);
  const [sampleProductId, setSampleProductId] = useState<string>(SAMPLE_PRODUCTS[0].id);
  const [testOutput, setTestOutput] = useState<ReturnType<typeof runSkillTest> | null>(null);
  const [uploadName, setUploadName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: mpData } = useAdminContentMarketplaces();
  const { data: catData } = useAdminProductCategories();

  const marketplaces = mpData?.marketplaces ?? [];
  const categories = catData?.categories ?? [];

  const parsed = useMemo(() => parseSkillInstructions(instructionsText), [instructionsText]);
  const pageTitle = isNew ? "New skill" : parsed.name || "Edit skill";

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setInstructionsText(text);
      setUploadName(file.name);
    };
    reader.readAsText(file);
  }, []);

  const runTest = useCallback(() => {
    setTestOutput(
      runSkillTest({
        instructionsText,
        sampleProductId,
        aiModel,
      }),
    );
  }, [aiModel, instructionsText, sampleProductId]);

  const saveDraft = () => {
    toast({
      title: "Draft saved",
      description: "Skill rules are stored locally until publishing API is connected.",
    });
  };

  const publishSkill = () => {
    toast({
      title: "Skill published",
      description: `${parsed.name} is marked live for ${skillType.replace("_", " ")}.`,
    });
  };

  return (
    <div className="min-h-full bg-slate-50/80">
      <header className="sticky top-0 z-10 border-b bg-white/95 backdrop-blur px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-3">
          <Link href={ADMIN_AI_SKILLS_HREF}>
            <Button type="button" variant="ghost" size="icon" className="shrink-0" aria-label="Back to skills">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">{pageTitle}</h1>
            <Badge variant="outline" className="text-amber-800 bg-amber-50 border-amber-200 font-medium">
              {pageTitle} · Draft
            </Badge>
          </div>
          <div className="flex gap-2 ml-auto">
            <Button type="button" variant="outline" onClick={saveDraft}>
              Save draft
            </Button>
            <Button
              type="button"
              className="bg-teal-700 hover:bg-teal-800 text-white"
              onClick={publishSkill}
            >
              Publish skill
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Skill file</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className={cn(
                  "w-full rounded-lg border-2 border-dashed border-slate-200 bg-slate-50/80",
                  "px-4 py-8 text-center hover:border-teal-300 hover:bg-teal-50/40 transition-colors",
                )}
              >
                <FileUp className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                <p className="text-sm font-semibold text-slate-800">Upload a skill file</p>
                <p className="text-xs text-muted-foreground mt-1">.md, .txt or .json — replaces the text below</p>
                <p className="text-xs text-slate-500 mt-3">{uploadName ? uploadName : "No file yet"}</p>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".md,.txt,.json,text/plain,application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />

              <div>
                <Label className="text-xs text-muted-foreground">Skill instructions (editable)</Label>
                <Textarea
                  value={instructionsText}
                  onChange={(e) => setInstructionsText(e.target.value)}
                  className="mt-1.5 font-mono text-xs min-h-[220px] bg-slate-50"
                  spellCheck={false}
                />
                <p className="text-[11px] text-muted-foreground mt-2">
                  One rule per line as key: value. Try changing bullets or title_max and watch the test output.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Where this skill applies</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Skill type</Label>
                <Select value={skillType} onValueChange={(v) => setSkillType(v as SkillType)}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="product_content">Product content</SelectItem>
                    <SelectItem value="product_images">Product images</SelectItem>
                    <SelectItem value="aplus_content">A+ content</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.length === 0 && (
                      <SelectItem value="Home Decor">Home Decor</SelectItem>
                    )}
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Marketplace</Label>
                <Select value={marketplace} onValueChange={setMarketplace}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {marketplaces.length === 0 && (
                      <SelectItem value="amazon">Amazon</SelectItem>
                    )}
                    {marketplaces.map((m) => (
                      <SelectItem key={m.id} value={m.slug}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">AI model</Label>
                <Select value={aiModel} onValueChange={setAiModel}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AI_MODELS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column — test output */}
        <Card className="xl:min-h-[640px] flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Test output</CardTitle>
            <Button type="button" size="sm" className="gap-1.5" onClick={runTest}>
              <Play className="w-3.5 h-3.5" />
              Run test
            </Button>
          </CardHeader>
          <CardContent className="space-y-4 flex-1">
            <div>
              <Label className="text-xs text-muted-foreground">Sample product</Label>
              <Select value={sampleProductId} onValueChange={setSampleProductId}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SAMPLE_PRODUCTS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!testOutput && (
              <p className="text-sm text-muted-foreground py-12 text-center">
                Run a test to preview title, bullets, and description using this skill.
              </p>
            )}

            {testOutput && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <section>
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">
                    <span>Title</span>
                    <span className="tabular-nums">
                      {testOutput.titleCount}/{testOutput.titleMax}
                    </span>
                  </div>
                  <p className="text-sm font-medium leading-snug border rounded-lg bg-white px-3 py-2.5">
                    {testOutput.title}
                  </p>
                </section>

                <section>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-2">
                    {testOutput.bullets.length} bullet points
                  </p>
                  <ul className="space-y-2 text-sm border rounded-lg bg-white px-3 py-2.5 list-disc pl-5">
                    {testOutput.bullets.map((b) => (
                      <li key={b.slice(0, 24)}>{b}</li>
                    ))}
                  </ul>
                </section>

                <section>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">
                    Description
                  </p>
                  <p className="text-sm leading-relaxed border rounded-lg bg-white px-3 py-2.5">
                    {testOutput.description}
                  </p>
                </section>

                <div className="flex flex-wrap gap-2 pt-2">
                  <Badge
                    variant="outline"
                    className={
                      testOutput.bannedFound.length === 0
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : "bg-rose-50 text-rose-800 border-rose-200"
                    }
                  >
                    {parsed.banned.length} banned terms,{" "}
                    {testOutput.bannedFound.length === 0 ? "none found" : testOutput.bannedFound.join(", ")}
                  </Badge>
                  <Badge variant="secondary">Tone: {parsed.tone}</Badge>
                </div>

                <p className="text-[11px] text-muted-foreground">
                  Generated by {testOutput.modelLabel} following this skill. Sample product category:{" "}
                  {testOutput.sampleCategory}.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
