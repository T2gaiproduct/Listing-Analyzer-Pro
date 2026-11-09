import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { saveAdminContentMarketplace } from "@/lib/content-marketplaces";

const STARTER_INSTRUCTIONS = `You are generating listing content for this marketplace.
Follow the marketplace title, bullet, keyword, and description rules exactly.
Use the product context provided in the request.`;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AdminNewMarketplaceSkillDialog({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [saving, setSaving] = useState(false);

  const derivedSlug =
    slug.trim() ||
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  async function handleCreate() {
    const s = derivedSlug;
    const n = name.trim();
    if (!n || !s) {
      toast({ title: "Name and slug required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const saved = await saveAdminContentMarketplace({
        slug: s,
        name: n,
        description: "",
        enabled: false,
        isDefault: false,
        sortOrder: 100,
        aiInstructions: STARTER_INSTRUCTIONS,
        rules: { bulletCount: 5, keywordCount: 10 },
      });
      const skillSlug = saved.skillSlug ?? `marketplace-content-${saved.slug}`;
      onOpenChange(false);
      setName("");
      setSlug("");
      navigate(`/admin/settings/ai/skills/${skillSlug}`);
      toast({ title: "Marketplace skill created", description: n });
    } catch (e) {
      toast({
        title: "Could not create marketplace",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New marketplace listing skill</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. TikTok Shop"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Slug</Label>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder={derivedSlug || "tiktok-shop"}
              className="mt-1 font-mono text-xs"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleCreate} disabled={saving}>
            {saving ? "Creating…" : "Create skill"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
