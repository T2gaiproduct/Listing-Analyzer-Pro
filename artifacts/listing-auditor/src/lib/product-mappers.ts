/** Map Build Your Brand audit records to product UI shapes (client-side fallback). */

import type { AuditResult } from "@workspace/api-client-react";
import { buildProductSuggestions } from "@/lib/product-suggestions";
import { mapProductPriority } from "@/lib/product-priority";

export type ProductStatus = "active" | "in_progress" | "draft" | "failed";

const WORKFLOW_STEP_LABELS = ["Upload", "Listing", "Graphics", "A+ Content", "Export"];

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
}

interface AuditLike {
  id: number;
  productName: string;
  projectName?: string | null;
  brandName?: string | null;
  category?: string | null;
  asin?: string | null;
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
  return !audit.asin?.trim();
}

export function mapAuditToProductDetail(audit: AuditLike, managerName = "Account Owner"): ProductDetailView {
  const name = audit.projectName?.trim() || audit.productName?.trim() || "Untitled Product";
  const mapped = mapProductStatus(audit.status ?? "draft", audit.currentStep ?? null);
  const stageLabel = mapStageLabel(audit.status ?? "draft", audit.currentStep ?? null);
  const progress = calcProgress(audit.status ?? "draft", audit.currentStep ?? null);
  const brand = audit.brandName?.trim() || "Brand";
  const workflowUrl = `/audits/workflow?resume=${audit.id}`;

  const referenceLinks: Array<{ label: string; url: string }> = [];
  if (audit.asin?.trim()) {
    referenceLinks.push({
      label: "Amazon Ref",
      url: `https://www.amazon.in/dp/${audit.asin.trim()}`,
    });
  }
  (audit.competitors ?? []).forEach((c, i) => {
    const label = c.productName?.trim() || `Competitor ${String.fromCharCode(65 + i)}`;
    const url = c.asin?.trim() ? `https://www.amazon.in/dp/${c.asin.trim()}` : "#";
    referenceLinks.push({ label, url });
  });

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
