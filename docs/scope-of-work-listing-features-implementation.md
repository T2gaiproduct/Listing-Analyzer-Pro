# Scope of Work — How It Can Be Done
## Client Listing & Content Features (Implementation Plan)

**Document version:** 1.0  
**Date:** 27 October 2026  
**Product:** Ecommerce Guru (Listing Analyzer Pro)  
**Purpose:** Detailed description of **how each requested feature can be built** on the existing platform without breaking current workflows.

---

## 1. Principles

- **Additive only:** Existing Excel export, single-product “Generate content,” and current `audits` data stay working.
- **Phased delivery:** Each feature can ship independently after UAT on `staging`.
- **Reference-driven:** Final column lists, category taxonomy, policy text, and A+ modules must be signed off against client PFA files and the Amazon India fees page.
- **Stack:** Node.js API (`artifacts/api-server`), React UI (`artifacts/listing-auditor`), PostgreSQL (Drizzle schema in `lib/db`).

---

## 2. Feature 1 — Additional Listing Attributes (Excel template)

### 2.1 Goal

Expand the Amazon/listing Excel export so it includes **more attribute columns** (material, dimensions, compliance, etc.) per client reference file, for comprehensive product data coverage.

### 2.2 How it can be done

**Step A — Capture reference columns**

1. Import client PFA Excel: list every column header, data type, max length, required vs optional, and which Amazon feed/product type it maps to.
2. Map each column to either:
   - an existing export field (title, bullets, keywords, images), or
   - a **new dynamic attribute** key.

**Step B — Data model**

1. Add nullable **`listing_attributes`** (JSON object) on **`audits`**: `{ "material": "Steel", "color": "Black", ... }`.
2. Add optional **`feed_product_type`** (text) on **`audits`** for Amazon template row.
3. Create **`amazon_listing_attribute_templates`** table:
   - `product_type_slug`, `marketplace_code`, `attribute_key`, `label`, `excel_column_name`, `max_length`, `required`, `sort_order`, `value_type` (text/number/enum).
4. Create **`amazon_product_types`** table (shared with Feature 2): links browse/category to template and feed type.

**Step C — UI**

1. On **Build Your Brand → Upload** (or new “Listing attributes” step): show fields driven by selected product type template (not a flat hardcoded list).
2. Allow manual entry and optional **import from CSV/Excel** (row per SKU) in a later sub-phase if needed.
3. Store values in `audits.listing_attributes`.

**Step D — Export engine**

1. Extend **`amazon-listing-export.ts`**:
   - Keep current **`AMAZON_FLAT_FILE_HEADERS`** row unchanged for backward compatibility.
   - Append new columns **after** existing headers **or** add sheet **“Attributes”** with key/value pairs (client preference from PFA).
2. Extend **`buildBulkExcelBuffer`** so bulk product export includes new columns for each audit.
3. Validation before export: warn on missing required attributes; block export only if client requires hard validation.

**Step E — Testing**

1. Export old audit without attributes → identical core columns to today.
2. Export new audit with full attributes → matches reference file layout.
3. Bulk export 10 products with mixed completeness.

---

## 3. Feature 2 — Category expansion (Amazon India / fees context)

### 3.1 Goal

Support **more product categories** aligned with listing and fee requirements (reference: [Amazon India fees and pricing](https://sell.amazon.in/fees-and-pricing)).

### 3.2 How it can be done

**Step A — Taxonomy source**

1. Build **`amazon_product_types`** seed data:
   - `marketplace_code` (IN, US, …)
   - `display_name`, `browse_node_or_category_label`
   - `feed_product_type` (Amazon inventory template code)
   - Optional: `referral_fee_percent`, `closing_fee_inr` (for Feature 5 linkage)
2. Initial seed from client list + public Amazon IN category/fee tables (manual CSV maintained by admin).

**Step B — Replace hardcoded UI list**

1. Today: long static array **`AMAZON_CATEGORIES`** in `audit-workflow.tsx`.
2. Replace with API **`GET /api/catalog/amazon-product-types?marketplace=IN`** (paginated search).
3. Picker: search + marketplace filter; store:
   - `audits.category` (display text, backward compatible)
   - `audits.amazon_product_type_id` or `category_metadata` json.

**Step C — Admin**

1. **Admin → Catalog** (new page): CRUD product types, import CSV, enable/disable types.
2. Optional sync job later if SP-API product type definitions become available.

**Step D — Export & AI**

1. Excel: populate **`feed_product_type`** and **`item_type`** from selected type.
2. Pass structured category + product type into **`generateListingContent`** product context block.

**Step E — Testing**

1. Old projects keep text category; export still works.
2. New picker sets feed type; fee hint visible in UI if seeded.

---

## 4. Feature 3 — Bulk content creation

### 4.1 Goal

Generate **AI listing content for many products at once** from the Products list (not only one audit at a time).

### 4.2 How it can be done

**Step A — Job tables**

1. **`content_generation_jobs`**: `id`, `user_id`, `workspace_id`, `status` (queued/running/completed/failed), `total`, `completed`, `failed`, `created_at`, `finished_at`, `error_summary`.
2. **`content_generation_job_items`**: `job_id`, `audit_id`, `status`, `error_message`, `credits_charged`, timestamps.

**Step B — API**

1. **`POST /api/products/bulk-generate-content`**
   - Body: `{ items: [{ auditId, workspaceId? }], contentMarketplaceId? }`
   - Cap: same as bulk export (e.g. 100).
   - Preflight credits: sum per audit; reject if insufficient.
2. Background worker pattern (same process async queue or sequential batch in request with timeout guard):
   - For each audit: load audit → call existing **`generateListingContent`** → write **`audits.generated_content`** (+ snapshot rules unchanged).
3. **`GET /api/content-generation-jobs/:id`** for progress polling.

**Step C — UI**

1. **Products** page: action **“Bulk generate content”** next to bulk Excel export.
2. Modal: confirm count, credits, marketplace; show progress bar; list failures with audit name + error.

**Step D — Credits & permissions**

1. Reuse workspace **`build_brand` / `audits` edit** permissions.
2. Deduct credits per successful generation (same as single generate).

**Step E — Testing**

1. Single generate unchanged.
2. Bulk 5 audits: 3 success, 2 missing product name → partial success reporting.

---

## 5. Feature 4 — Multi-marketplace content generation

### 5.1 Goal

Generate listing content for **multiple marketplaces in one action**; export layout per client reference Excel.

### 5.2 How it can be done

**Step A — Storage**

1. Keep **`audits.generated_content`** as **primary** copy (default marketplace preview/export).
2. Add **`audit_content_variants`**:
   - `audit_id`, `content_marketplace_id`, `generated_content` (json), `updated_at`
   - Unique (`audit_id`, `content_marketplace_id`).

**Step B — Generation API**

1. Extend **`POST /audits/:id/generate-content`** to accept **`marketplaceIds: number[]`** (optional).
2. When array length > 1:
   - Loop **`resolveContentMarketplaceForGeneration`** per id.
   - Call **`generateListingContent`** once per marketplace (parallel with concurrency limit e.g. 3).
   - Write primary to `audits` (first or user-selected default); others to **`audit_content_variants`**.
3. Credits: charge per marketplace generated.

**Step C — UI**

1. **Content step:** multi-select marketplaces (checkboxes using existing **`ContentMarketplaceSelect`** pattern).
2. Preview tabs: Amazon | eBay | Shopify | …
3. **Regenerate** per tab without wiping other variants.

**Step D — Multi-marketplace Excel**

1. Extend bulk/single export:
   - One **sheet per marketplace** or one row set per marketplace (per client PFA sheet).
2. Map each variant’s title/bullets/keywords/description into marketplace-specific columns.

**Step E — Testing**

1. Single marketplace → identical to today.
2. Three marketplaces → three variants stored; export produces three sheets/sections.

---

## 6. Feature 5 — Revenue calculator

### 6.1 Goal

Estimate **revenue, fees, and profit** using Amazon India fee structure as baseline (extensible to other marketplaces).

### 6.2 How it can be done

**Step A — Fee data**

1. Table **`marketplace_fee_rules`**:
   - `marketplace_code`, `category_or_product_type`, `referral_fee_percent`, `min_fee`, `max_fee`, `closing_fee`, `currency`, `fba_tier_rules` (json), `effective_from`.
2. Seed from [Amazon IN fees and pricing](https://sell.amazon.in/fees-and-pricing) (manual admin CSV import; quarterly update process).

**Step B — Calculator logic (pure functions)**

1. Inputs: selling price, COGS, shipping cost, optional FBA dimensions/weight, product type (from Feature 2).
2. Outputs: referral fee, closing fee, FBA fee (if selected), net margin, margin %, break-even price.
3. No SP-API required for v1.

**Step C — UI**

1. New page **`/tools/revenue-calculator`** or panel on **product detail**.
2. Link product type from audit when opened from a project.
3. Optional **`product_profit_scenarios`** table to save inputs/results per audit.

**Step D — Testing**

1. Sample IN category matches published fee example on Amazon page.
2. Edge cases: zero price, missing product type → clear validation messages.

---

## 7. Feature 6 — A+ Content graphics

### 7.1 Goal

**Create or generate graphics** for Amazon A+ Content per client reference document (modules, sizes, copy layout).

### 7.2 How it can be done

**Note:** A+ generation already exists (`generate-aplus`, **`audits.generated_images.aplus`**, **`image_prompt_templates`** with `category = aplus`).

**Step A — Reference mapping**

1. Parse client PFA doc: module names, image dimensions, headline/body rules, number of modules per layout (Standard vs Premium).

**Step B — Templates**

1. Insert/update rows in **`image_prompt_templates`** for each module (prompt, headline/body templates, metadata for size/aspect ratio).
2. Align **`useAplusModuleCards`** / API seed with reference module IDs.

**Step C — UI**

1. Audit workflow A+ step: show modules from reference; generate/regenerate per module (existing flow).
2. Optional: “Generate all modules” batch with credit preflight (already partially exists).

**Step D — Export**

1. Zip **`aplus/`** folder in listing export (already supported); verify dimensions in filenames/metadata for client handoff.

**Step E — Testing**

1. Legacy audits with old module ids still load.
2. New project generates full module set per doc.

---

## 8. Feature 7 — Amazon listing policy guidelines (AI content)

### 8.1 Goal

Ensure **AI-generated content complies** with marketplace policy documents (client PFA docs).

### 8.2 How it can be done

**Step A — Policy storage**

1. Table **`marketplace_policy_documents`**:
   - `content_marketplace_id` or slug, `title`, `version`, `body_text` (or file URL), `category_scope` (optional), `is_active`, timestamps.
2. Optional link from **`content_marketplaces.policy_document_id`**.

**Step B — Admin**

1. **Admin → Marketplace Content** or new **Policy documents**: upload PDF/text or paste; version and activate.

**Step C — Prompt injection**

1. In **`content-generator.ts`** / **`content-marketplace-service.ts`**:
   - After loading `ai_instructions`, append: “MUST comply with the following policy: …” from active document(s).
   - Truncate to token budget; prioritize prohibited claims, formatting, category rules.

**Step D — Optional validation pass**

1. Post-generation checklist (rules-based or small LLM pass): flag banned phrases (“#1”, “guaranteed”, medical claims).
2. Surface warnings in audit UI; do not block save unless admin enables “strict mode.”

**Step E — Testing**

1. Without policy doc → behavior matches today.
2. With doc containing banned terms → generated copy avoids them in sample products.

---

## 9. Recommended implementation order

| Phase | Features | Rationale |
|-------|----------|-----------|
| **1** | Feature 2 (categories/types) + Feature 1 (attributes) | Types drive attribute templates and Excel columns |
| **2** | Feature 7 (policy) | Improves all AI content before scaling bulk/multi |
| **3** | Feature 4 (multi-marketplace) | Builds on stable single generate + variants |
| **4** | Feature 3 (bulk generate) | Reuses generate API at scale |
| **5** | Feature 5 (revenue calculator) | Uses product types from Phase 1 |
| **6** | Feature 6 (A+ alignment) | Mostly templates/content from PFA doc |

---

## 10. Dependencies from client

| Item | Used for |
|------|----------|
| PFA Excel — listing attributes | Feature 1 column spec |
| PFA Excel — multi-marketplace | Feature 4 export layout |
| PFA — A+ Content doc | Feature 6 modules |
| PFA — Listing policy doc(s) | Feature 7 prompts |
| Confirmation of marketplace list | Feature 4 |
| Amazon IN fee categories priority | Feature 5 seed |

---

## 11. Database summary (new / modified)

**New tables:** `amazon_product_types`, `amazon_listing_attribute_templates`, `audit_content_variants`, `content_generation_jobs`, `content_generation_job_items`, `marketplace_fee_rules`, `marketplace_policy_documents`, optional `product_profit_scenarios`.

**Modified (additive columns only):** `audits` (`listing_attributes`, `feed_product_type`, category metadata), optional `content_marketplaces`, `product_profiles`.

**Unchanged behavior:** Existing `generated_content` shape, current export headers as default row, single-marketplace generate API default.

---

## 12. Deployment & QA

1. Merge to **`staging`** → `bash deploy.sh staging` on server.
2. Run **`scripts/sync-production-db.sh`** (or staging DB sync) after migrations.
3. QA checklist per feature (export files, bulk job, calculator numbers, A+ images, policy spot-check).
4. Promote to production after written sign-off per phase.

---

## 13. Approval

| Phase | Approve (initials / date) |
|-------|---------------------------|
| Phase 1 — Categories + attributes | |
| Phase 2 — Policy AI | |
| Phase 3 — Multi-marketplace | |
| Phase 4 — Bulk content | |
| Phase 5 — Revenue calculator | |
| Phase 6 — A+ reference alignment | |

---

*End of document*
