# Client Feature Requirements — Database & Table Impact

**Product:** Ecommerce Guru (Listing Analyzer Pro)  
**Document purpose:** Map each requested client feature to **existing database tables** (additive changes only) and **new tables**, without breaking current behavior.  
**Status:** Planning only — **not implemented** until client/stakeholder approval.  
**Prepared:** 26 October 2026 (IST)

---

## 1. What this document is for

Your client asked for seven capability areas (Excel attributes, categories, bulk content, multi-marketplace content, revenue calculator, A+ graphics, policy-compliant AI). This document answers:

- What already exists in the app today  
- Which **PostgreSQL tables** would change (additive columns only where noted)  
- Which **new tables** would be added  
- How each change ties to a **feature**, in plain language  

**Principle:** Existing flows keep working. New fields are optional. Current `audits.generated_content`, export columns, and single-product “Generate content” stay the default path.

---

## 2. Current database touchpoints (baseline)

These tables already support listing work today:

| Table | Role today |
|-------|------------|
| `audits` | Product project: name, category (text), title, bullets, keywords, images, `generated_content`, `content_marketplace_id`, `generated_images` (includes A+), scores, workflow step |
| `content_marketplaces` | Per-marketplace AI instructions, rules (JSON), enabled flag |
| `product_profiles` | SKU, priority, manager, `target_marketplaces` (JSON array), workflow template |
| `graphics_projects` | Separate “Create Graphics” projects (lifestyle/feature images) |
| `image_prompt_templates` | Admin prompts for **graphics** and **aplus** image generation |
| `product_orders` | Synced orders → revenue display on product detail (not fee calculator) |
| `settings` | Admin key/value config (email, platform, Amazon, etc.) |
| `amazon_seller_connections` | Amazon OAuth / SP-API connection |
| `amazon_publish_jobs` | Publish job history per audit |

---

## 3. Feature map → table changes

### Feature A — Additional listing attributes (Excel template)

**Client ask:** More attribute columns in Excel for complete product data (per reference file).

**Today:** Export uses ~25 Amazon flat-file-style columns; `feed_product_type` is empty; category goes to `item_type` only.

| Impact type | Table / object | Change |
|-------------|----------------|--------|
| **Modify (additive)** | `audits` | Add optional `listing_attributes` (jsonb) — e.g. material, color, size, compliance fields. Add optional `feed_product_type` (text) or store inside json. |
| **Modify (additive)** | `product_profiles` | Optional defaults: e.g. preferred SKU pattern, default attribute values (jsonb) if needed. |
| **New** | `amazon_listing_attribute_templates` | Defines columns per product type: field key, label, max length, required, Excel column name. |
| **New** | `amazon_product_types` | Catalog: marketplace (IN/US/…), feed product type code, display name, link to attribute template. |

**No breaking change:** Existing Excel columns remain; new columns appended or second sheet “Attributes”. Empty json = same export as today.

**App layers (for reference, not DB):** `amazon-listing-export.ts`, Products bulk export API, audit upload step UI.

---

### Feature B — Category expansion (incl. Amazon India / fees context)

**Client ask:** More product categories aligned with listing requirements (ref: Amazon India fees & pricing).

**Today:** Long hardcoded category list in UI; stored as free text on `audits.category`.

| Impact type | Table / object | Change |
|-------------|----------------|--------|
| **Modify (additive)** | `audits` | Optional `amazon_product_type_id` (FK) or `category_metadata` (jsonb): browse node, marketplace, fee category hint. Keep existing `category` text for backward compatibility. |
| **New** | `amazon_product_types` | Same as Feature A — shared catalog for categories / feed types / marketplace. |
| **Optional new** | `amazon_marketplace_fee_hints` | Lightweight link: product type + marketplace → default referral % (feeds Feature E). |

**No breaking change:** Old projects keep text `category`; new picker can dual-write text + structured id.

**App layers:** Audit workflow category dropdown, export `item_type` / `feed_product_type`.

---

### Feature C — Bulk content creation

**Client ask:** Generate listing content for many products at once.

**Today:** Bulk **Excel export** only (up to 100 products). AI generation is **one audit at a time**.

| Impact type | Table / object | Change |
|-------------|----------------|--------|
| **New** | `content_generation_jobs` | Job header: `user_id`, `workspace_id`, status, total/succeeded/failed counts, created/completed timestamps, optional error summary. |
| **New** | `content_generation_job_items` | Per audit: `job_id`, `audit_id`, status, error message, credits charged, timestamps. |
| **Unchanged (writes)** | `audits` | Still updates `generated_content` (and optionally variants — see Feature D) per item, same as today’s single generate. |

**No breaking change:** Existing `/audits/:id/generate-content` unchanged; bulk is a new API + Products UI action.

**App layers:** New routes, credit preflight sum, notifications optional (`notifications` table may receive rows — already exists).

---

### Feature D — Multi-marketplace content generation (simultaneous)

**Client ask:** Generate content for multiple marketplaces at once; Excel per reference sheet.

**Today:** One `content_marketplace_id` and one `generated_content` blob per audit.

| Impact type | Table / object | Change |
|-------------|----------------|--------|
| **Modify (none required)** | `audits` | Keep `generated_content` + `content_marketplace_id` as **primary** copy (default marketplace). |
| **New** | `audit_content_variants` | Columns: `audit_id`, `content_marketplace_id` (or slug), `generated_content` (jsonb), `updated_at`. Unique (`audit_id`, marketplace). |
| **Modify (optional seed)** | `content_marketplaces` | Add row e.g. `amazon-in` if India rules differ from generic `amazon` slug. |

**No breaking change:** Preview/export default to primary `audits.generated_content` until user picks a variant.

**App layers:** Multi-select on content step, batch call to `generateListingContent`, bulk Excel multi-sheet export.

---

### Feature E — Revenue calculator

**Client ask:** Estimate revenue, fees, and profitability (Amazon India fees page as reference).

**Today:** `product_orders` shows **historical** revenue from connected stores — not referral/FBA/closing fee math.

| Impact type | Table / object | Change |
|-------------|----------------|--------|
| **New** | `marketplace_fee_rules` | Marketplace code, category/product type, referral %, min/max fee, closing fee, currency, optional FBA size tier rules (jsonb), effective_from date. |
| **New (optional)** | `product_profit_scenarios` | Save calculator inputs/outputs per `audit_id` or user: price, COGS, dimensions, computed margin (jsonb). |
| **Unchanged** | `product_orders` | Historical orders unchanged. |
| **Unchanged** | `audits` | No requirement to change unless saving scenario on audit. |

**No breaking change:** Pure new page/tool; optional “save scenario” only.

**App layers:** New calculator UI; admin screen to refresh fee tables (or seed from CSV).

---

### Feature F — A+ Content graphics

**Client ask:** Create/generate graphics for Amazon A+ Content (reference doc).

**Today:** A+ modules, image generation, storage in `audits.generated_images` → `aplus`; templates in `image_prompt_templates` (`category = aplus`).

| Impact type | Table / object | Change |
|-------------|----------------|--------|
| **Modify (data only)** | `image_prompt_templates` | New/updated template rows from client doc (no schema break). |
| **Modify (optional additive)** | `image_prompt_templates` | Optional new jsonb metadata keys in existing `metadata` column (module layout, dimensions). |
| **Modify (json only)** | `audits` | `generated_images.aplus` may gain new module ids; old audits keep old shape. |
| **Unchanged** | `graphics_projects` | Main listing graphics remain separate unless you explicitly link A+ to a graphics project later. |

**No breaking change:** Existing A+ projects continue to load; new modules are additive.

**App layers:** `aplus-generator`, audit workflow A+ step, admin Image Prompt Templates.

---

### Feature G — Amazon listing policy guidelines (AI content)

**Client ask:** AI output must follow marketplace policy documents (reference docs).

**Today:** Long static Amazon instructions in code + `content_marketplaces.ai_instructions`; admin can edit Marketplace Content settings.

| Impact type | Table / object | Change |
|-------------|----------------|--------|
| **Modify (additive)** | `content_marketplaces` | Optional `policy_version`, `policy_excerpt` (text), or `policy_document_id` (FK). |
| **New** | `marketplace_policy_documents` | `id`, marketplace slug/category, title, body text or storage URL, version, `is_active`, timestamps. |
| **Modify (optional)** | `settings` | Global “active policy pack” version key under category e.g. `amazon_compliance`. |
| **Unchanged** | `audits` | Optional future: `result` json could include policy compliance score — not required for v1. |

**No breaking change:** If no policy doc attached, prompts behave as today.

**App layers:** `content-generator.ts`, `content-marketplace-service.ts`, admin upload/paste UI.

---

## 4. Consolidated table checklist

### Existing tables — additive changes only

| Table | Features | Proposed new columns / notes |
|-------|----------|------------------------------|
| `audits` | A, B, D, (F json) | `listing_attributes` jsonb; `feed_product_type` text; `amazon_product_type_id` or `category_metadata` jsonb; `generated_images` extended in app only unless new column needed |
| `product_profiles` | A | Optional attribute/SKU defaults jsonb |
| `content_marketplaces` | D, G | Optional India row; policy fields or FK to policy docs |
| `image_prompt_templates` | F | More seed rows; optional metadata keys |
| `settings` | G | Optional compliance version keys |

### New tables

| Table | Features | Purpose |
|-------|----------|---------|
| `amazon_product_types` | A, B | Product type / category catalog per marketplace |
| `amazon_listing_attribute_templates` | A | Column definitions per product type for Excel + UI |
| `audit_content_variants` | D | Per-marketplace generated copy |
| `content_generation_jobs` | C | Bulk generate job header |
| `content_generation_job_items` | C | Per-audit bulk job line items |
| `marketplace_fee_rules` | E | Referral/closing/FBA fee data |
| `product_profit_scenarios` | E (optional) | Saved calculator runs |
| `marketplace_policy_documents` | G | Versioned policy text for AI prompts |
| `amazon_marketplace_fee_hints` | B, E (optional) | Link types to default fee % |

### Tables explicitly unchanged (for these features)

`auth_*`, `credits`, `plans`, `workspaces`, `team_members`, `graphics_projects` (unless later A+ link), `amazon_seller_connections`, `amazon_publish_jobs`, `product_orders`, `blog_posts`, `sellermate_*`, etc.

---

## 5. Suggested implementation phases (for approval)

| Phase | Features | DB scope |
|-------|----------|----------|
| **1** | A + B + G (partial) | `amazon_product_types`, `amazon_listing_attribute_templates`, `audits` attributes, policy docs |
| **2** | D | `audit_content_variants`, export multi-sheet |
| **3** | C | Job tables + bulk UI |
| **4** | E | Fee rules + calculator UI |
| **5** | F | Template/content from client A+ doc (mostly data) |

Each phase can ship independently without removing prior behavior.

---

## 6. Approvals required before development

- [ ] Confirm feature priority and phase order  
- [ ] Provide reference Excel + policy + A+ documents (exact columns and modules)  
- [ ] Confirm multi-marketplace list (e.g. Amazon IN + US + eBay only)  
- [ ] Confirm revenue calculator scope (India-first vs all export marketplaces)  
- [ ] Approve this table plan or request edits  

**No database migrations or application code will be applied until written approval is given.**

---

## 7. Document control

| Version | Date | Notes |
|---------|------|--------|
| 1.0 | 26 Oct 2026 | Initial planning document from codebase analysis |

---

*End of document*
