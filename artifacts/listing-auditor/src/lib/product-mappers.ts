/** Map Build Your Brand audit records to product UI shapes (client-side fallback). */

import type { AuditResult } from "@workspace/api-client-react";
import { buildProductSuggestions } from "@/lib/product-suggestions";
import { mapProductPriority } from "@/lib/product-priority";
import { isShopifyImportAsin } from "@/lib/shopify-import";

export type ProductStatus = "active" | "in_progress" | "draft" | "failed";

const WORKFLOW_STEP_LABELS = ["Upload", "Listing", "Graphics", "A+ Content", "Export"];

function buildAuditReferenceLinks(audit: AuditLike): Array<{ label: string; url: string }> {
  const referenceLinks: Array<{ label: string; url: string }> = [];
  const asin = audit.asin?.trim();
  const profileRef = audit.referenceLinks?.trim();

  if (asin) {
    if (isShopifyImportAsin(asin)) {
      if (profileRef) {
        referenceLinks.push({ label: "Shopify", url: profileRef });
      }
    } else {
      referenceLinks.push({
        label: "Amazon Ref",
        url: `https://www.amazon.in/dp/${asin}`,
      });
    }
  }

  (audit.competitors ?? []).forEach((c, i) => {
    const label = c.productName?.trim() || `Competitor ${String.fromCharCode(65 + i)}`;
    const competitorAsin = c.asin?.trim();
    const url = competitorAsin && !isShopifyImportAsin(competitorAsin)
      ? `https://www.amazon.in/dp/${competitorAsin}`
      : "#";
    referenceLinks.push({ label, url });
  });

  return referenceLinks;
}

export function deriveSku(productName: string, id: number): string {
  const parts = productName
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.slice(0, 3).toUpperCase());
  const prefix = parts.join("-") || "PRD";
  return `${prefix}-${String(id).padStart(4, "0")}`;
}

function mapProductStatus(status: string, currentStep: number | null): { status: ProductStatus; label: string } {
  if (status === "complete") return { status: "active", label: "Active" };
  if (status === "failed") return { status: "failed", label: "Failed" };
  if (status === "draft" && (currentStep ?? 1) > 1) {
    return { status: "in_progress", label: "In progress" };
  }
  if (status === "pending") return { status: "in_progress", label: "In progress" };
  return { status: "draft", label: "Draft" };
}

function mapStageLabel(status: string, currentStep: number | null): string {
  if (status === "complete") return "Live";
  const step = Math.min(5, Math.max(1, currentStep ?? 1));
  if (step >= 5) return "Ready to export";
  return WORKFLOW_STEP_LABELS[step - 1] ?? "Upload";
}

function calcProgress(status: string, currentStep: number | null): number {
  if (status === "complete") return 100;
  return Math.min(100, Math.round(((currentStep ?? 1) / 5) * 100));
}

function managerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function pickThumbnail(audit: AuditLike): string | null {
  const candidates: string[] = [];
  for (const rec of audit.imageRecords ?? []) {
    const url = rec?.currentUrl?.trim();
    if (url) candidates.push(url);
  }
  for (const url of audit.imageUrls ?? []) {
    if (url?.trim()) candidates.push(url.trim());
  }
  const g = audit.generatedImages;
  if (g) {
    for (const url of [...(g.main ?? []), ...(g.lifestyle ?? []), ...(g.infographic ?? [])]) {
      if (url?.trim()) candidates.push(url.trim());
    }
  }
  return candidates[0] ?? null;
}

function countImages(audit: AuditLike): number {
  const urls = new Set<string>();
  for (const u of audit.imageUrls ?? []) {
    if (u?.trim()) urls.add(u.trim());
  }
  for (const rec of audit.imageRecords ?? []) {
    if (rec?.currentUrl?.trim()) urls.add(rec.currentUrl.trim());
  }
  const g = audit.generatedImages;
  if (g) {
    for (const u of [...(g.main ?? []), ...(g.lifestyle ?? []), ...(g.infographic ?? [])]) {
      if (u?.trim()) urls.add(u.trim());
    }
  }
  return urls.size;
}

function buildNotes(audit: AuditLike): string {
  const summary = audit.result?.summary?.trim();
  if (summary) return summary;
  const bullets = audit.generatedContent?.bulletPoints ?? audit.bulletPoints ?? [];
  if (bullets.length > 0) return bullets.slice(0, 2).join(" ");
  return "No notes yet. Complete the listing step in Build Your Brand to generate product notes.";
}

export interface ProductDetailView {
  id: number;
  name: string;
  title: string;
  sku: string;
  imageUrl: string | null;
  brandName: string | null;
  category: string | null;
  status: ProductStatus;
  statusLabel: string;
  stageLabel: string;
  priorityLabel: string;
  priorityLevel: "low" | "medium" | "high";
  progressPercent: number;
  currentStep: number | null;
  createdAt: string;
  updatedAt: string;
  workflowUrl: string;
  manager: { name: string; initials: string };
  notes: string;
  referenceLinks: Array<{ label: string; url: string }>;
  driveFolder: string;
  driveFolderUrl: string;
  workflowSteps: Array<{ id: number; label: string; completed: boolean; active: boolean }>;
  stats: {
    totalOrders: number;
    revenue: number | null;
    revenueCurrency: string;
    marketplacesActive: number;
    listingScore: number;
    competitorCount: number;
    imageCount: number;
    keywordCount: number;
  };
  aiSuggestions: string[];
  sourceType?: "listing" | "audit" | "graphics" | "video" | "ads";
  sourceTypeLabel?: string;
  statsAuditId?: number | null;
  isShopifyImport?: boolean;
  referenceUrl?: string | null;
  listingTitle?: string;
  bulletPoints?: string[];
  targetKeywords?: string[];
  descriptionHtml?: string;
  listingPrice?: number | null;
  listingCurrency?: string | null;
}

interface GraphicsProjectLike {
  id: number;
  name: string;
  productName: string;
  category?: string | null;
  status: string;
  sourceImageUrls?: string[] | null;
  imageRecords?: Array<{ currentUrl?: string }> | null;
  generatedCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

function pickGraphicsThumbnail(project: GraphicsProjectLike): string | null {
  for (const rec of project.imageRecords ?? []) {
    if (rec?.currentUrl?.trim()) return rec.currentUrl.trim();
  }
  for (const url of project.sourceImageUrls ?? []) {
    if (url?.trim()) return url.trim();
  }
  return null;
}

function genericProgress(status: string): number {
  if (status === "complete" || status === "completed" || status === "active") return 100;
  if (status === "generating" || status === "processing" || status === "pending") return 55;
  if (status === "failed") return 0;
  return 25;
}

export function mapGraphicsToProductDetail(project: GraphicsProjectLike): ProductDetailView {
  const name = project.name?.trim() || project.productName?.trim() || "Untitled Project";
  const brand = project.productName?.trim() || "Brand";
  const mapped = mapProductStatus(project.status ?? "draft", null);
  const workflowUrl = `/projects/${project.id}`;

  return {
    id: project.id,
    name,
    title: name,
    sku: `GFX-${String(project.id).padStart(4, "0")}`,
    imageUrl: pickGraphicsThumbnail(project),
    brandName: brand,
    category: project.category ?? null,
    status: mapped.status,
    statusLabel: mapped.label,
    stageLabel: project.status === "completed" ? "Graphics ready" : "Graphics",
    priorityLabel: "Medium Priority",
    priorityLevel: "medium",
    progressPercent: genericProgress(project.status),
    currentStep: null,
    createdAt: project.createdAt ?? new Date().toISOString(),
    updatedAt: project.updatedAt ?? project.createdAt ?? new Date().toISOString(),
    workflowUrl,
    sourceType: "graphics",
    sourceTypeLabel: "Create Graphics",
    statsAuditId: null,
    manager: { name: "Account Owner", initials: "AO" },
    notes: `Graphics project for ${project.productName}. Open the workflow to generate lifestyle and feature images.`,
    referenceLinks: [],
    driveFolder: `${brand} / ${name}`,
    driveFolderUrl: workflowUrl,
    workflowSteps: ["Upload assets", "Generate graphics", "Customize", "Download"].map((label, index) => ({
      id: index + 1,
      label,
      completed: project.status === "completed" || project.status === "complete",
      active: project.status !== "completed" && project.status !== "complete" && index === 1,
    })),
    stats: {
      totalOrders: 0,
      revenue: null,
      revenueCurrency: "USD",
      marketplacesActive: 0,
      listingScore: 0,
      competitorCount: 0,
      imageCount: project.generatedCount ?? 0,
      keywordCount: 0,
    },
    aiSuggestions: [
      "Generate lifestyle and infographic images in the Graphics workflow",
      "Use consistent brand colors across all generated visuals",
      "Add more source images for better AI output quality",
    ],
  };
}

interface AuditLike {
  id: number;
  productName: string;
  projectName?: string | null;
  brandName?: string | null;
  category?: string | null;
  asin?: string | null;
  referenceLinks?: string | null;
  status: string;
  currentStep?: number | null;
  overallScore?: number;
  createdAt?: string;
  updatedAt?: string;
  imageUrls?: string[];
  imageRecords?: Array<{ currentUrl?: string }>;
  generatedImages?: { main?: string[]; infographic?: string[]; lifestyle?: string[] };
  title?: string | null;
  generatedContent?: {
    title?: string;
    bulletPoints?: string[];
    keywords?: string[];
  };
  bulletPoints?: string[];
  targetKeywords?: string[];
  result?: AuditResult | null;
  competitors?: Array<{ id?: number; productName?: string; asin?: string | null }>;
}

export function isBuildBrandAudit(audit: AuditLike): boolean {
  return !audit.asin?.trim() || isShopifyImportAsin(audit.asin);
}

export function mapAuditToProductDetail(
  audit: AuditLike,
  managerName = "Account Owner",
  opts?: { sourceType?: "listing" | "audit" },
): ProductDetailView {
  const sourceType = opts?.sourceType ?? (
    audit.asin?.trim() && !isShopifyImportAsin(audit.asin) ? "audit" : "listing"
  );
  const isShopifyImport = isShopifyImportAsin(audit.asin);
  const name = audit.projectName?.trim() || audit.productName?.trim() || "Untitled Product";
  const mapped = mapProductStatus(audit.status ?? "draft", audit.currentStep ?? null);
  const stageLabel = isShopifyImport
    ? "Imported from Shopify"
    : sourceType === "audit"
      ? (audit.status === "complete" ? "Audit Results" : "Audit in progress")
      : mapStageLabel(audit.status ?? "draft", audit.currentStep ?? null);
  const progress = sourceType === "audit"
    ? (audit.status === "complete" ? 100 : audit.overallScore ? Math.min(95, audit.overallScore) : 40)
    : calcProgress(audit.status ?? "draft", audit.currentStep ?? null);
  const brand = audit.brandName?.trim() || "Brand";
  const workflowUrl = sourceType === "audit"
    ? `/audits/${audit.id}`
    : `/audits/workflow?resume=${audit.id}`;

  const referenceLinks = buildAuditReferenceLinks(audit);

  const aiSuggestions = buildProductSuggestions({
    productName: audit.productName,
    title: audit.title,
    brandName: audit.brandName,
    category: audit.category,
    bulletPoints: audit.bulletPoints,
    generatedContent: audit.generatedContent,
    targetKeywords: audit.targetKeywords,
    imageUrls: audit.imageUrls,
    imageRecords: audit.imageRecords,
    generatedImages: audit.generatedImages,
    currentStep: audit.currentStep,
    status: audit.status,
    overallScore: audit.overallScore,
    result: audit.result,
    competitorCount: audit.competitors?.length ?? 0,
  });

  const priority = mapProductPriority({
    overallScore: audit.overallScore,
    status: audit.status,
    currentStep: audit.currentStep,
    aiSuggestionCount: aiSuggestions.length,
  });

  return {
    id: audit.id,
    name,
    title: name,
    sku: deriveSku(name, audit.id),
    imageUrl: pickThumbnail(audit),
    brandName: audit.brandName ?? null,
    category: audit.category ?? null,
    status: mapped.status,
    statusLabel: mapped.status === "active" ? "Live" : mapped.label,
    stageLabel,
    priorityLabel: priority.label,
    priorityLevel: priority.level,
    progressPercent: progress,
    currentStep: audit.currentStep ?? null,
    createdAt: audit.createdAt ?? new Date().toISOString(),
    updatedAt: audit.updatedAt ?? new Date().toISOString(),
    workflowUrl,
    sourceType,
    sourceTypeLabel: isShopifyImport ? "Shopify Import" : (sourceType === "audit" ? "Audit Listing" : "Build Your Brand"),
    statsAuditId: audit.id,
    isShopifyImport,
    listingTitle: audit.title?.trim() || name,
    bulletPoints: (audit.bulletPoints ?? []).filter((bullet) => typeof bullet === "string"),
    targetKeywords: (audit.targetKeywords ?? []).filter((keyword) => typeof keyword === "string"),
    descriptionHtml: audit.generatedContent?.htmlDescription?.trim()
      || (audit.bulletPoints ?? []).map((bullet) => `<li>${bullet}</li>`).join(""),
    manager: { name: managerName, initials: managerInitials(managerName) },
    notes: buildNotes(audit),
    referenceLinks,
    driveFolder: `${brand} / ${name}`,
    driveFolderUrl: workflowUrl,
    workflowSteps: WORKFLOW_STEP_LABELS.map((label, index) => ({
      id: index + 1,
      label,
      completed: (audit.currentStep ?? 1) > index + 1 || audit.status === "complete",
      active: (audit.currentStep ?? 1) === index + 1 && audit.status !== "complete",
    })),
    stats: {
      totalOrders: 0,
      revenue: null,
      revenueCurrency: "INR",
      marketplacesActive: 0,
      listingScore: audit.overallScore ?? 0,
      competitorCount: audit.competitors?.length ?? 0,
      imageCount: countImages(audit),
      keywordCount: (audit.targetKeywords ?? []).length,
    },
    aiSuggestions,
  };
}
