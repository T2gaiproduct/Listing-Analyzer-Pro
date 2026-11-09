import { saveAdminContentMarketplace } from "@/lib/content-marketplaces";

const STARTER_INSTRUCTIONS = `You are generating listing content for this marketplace.
Follow the marketplace title, bullet, keyword, and description rules exactly.
Use the product context provided in the request.`;

export async function createAdminMarketplaceChannel(name: string, slug: string) {
  const n = name.trim();
  const s = slug.trim();
  if (!n || !s) {
    throw new Error("Name and slug are required.");
  }
  return saveAdminContentMarketplace({
    slug: s,
    name: n,
    description: "",
    enabled: false,
    isDefault: false,
    sortOrder: 100,
    aiInstructions: STARTER_INSTRUCTIONS,
    rules: { bulletCount: 5, keywordCount: 10 },
  });
}

export function slugFromMarketplaceName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
