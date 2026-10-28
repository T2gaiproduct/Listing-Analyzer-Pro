# Listing & Content Features — Implementation Verification

**Document version:** 1.0  
**Date:** 28 October 2026  
**Product:** Ecommerce Guru (Listing Analyzer Pro)  
**Purpose:** Detailed verification of the implementation plan: Feature 7 status, gaps, and per-feature database and file impacts. No implementation without client approval.

---

## 1. Feature 7 — Why the SOW Says “Done” vs Engineering “Partial”

The scope table marks **Feature 7 (Amazon listing policy guidelines for AI content) as Done**. Engineering review distinguishes:

- **Done (for today’s product):** Amazon listing **JSON** generation via the main content flow already embeds compliance guidance in AI prompts.
- **Partial (for the full program):** There is no single mandatory “policy layer” for bulk jobs, multi-marketplace variants, A+ copy, automated post-checks, or regression tests.

### 1.1 What is already in the product

**Amazon rules in code**

- File: `artifacts/api-server/src/lib/amazon-listing-instructions.ts`
- Export: `AMAZON_LISTING_AI_INSTRUCTIONS` — title, bullets, keywords, HTML description, and Amazon compliance (no “Best/#1”, no ALL CAPS, no unverifiable claims, etc.).

**Wired into listing generation for Amazon**

- Seeds: `artifacts/api-server/src/lib/content-marketplace-defaults.ts` sets Amazon `aiInstructions` to `AMAZON_LISTING_AI_INSTRUCTIONS`.
- Table: `content_marketplaces` (`lib/db/src/schema/content-marketplaces.ts`) — columns `ai_instructions`, `rules` (jsonb: title/bullet limits, etc.).
- Migration/seed: `artifacts/api-server/src/lib/ensure-content-marketplaces.ts`.
- Generation: `artifacts/api-server/src/lib/content-generator.ts` builds prompts with `marketplace.aiInstructions`, formatted rules, and product context.

**API routes using that generator**

- `artifacts/api-server/src/routes/audits.ts`:
  - `POST /generate-content`
  - `POST /audits/:id/generate-content`  
  Both call `generateListingContent()` after credit checks.

**Admin can edit policy text without deploy (content marketplaces)**

- API: `artifacts/api-server/src/routes/admin-content-marketplaces.ts`
- UI: `artifacts/listing-auditor/src/pages/admin/settings/content-marketplaces.tsx`  
  Admins edit `aiInstructions` and rules per marketplace slug.

**Audits record content marketplace**

- Column: `audits.content_marketplace_id` (added in ensure-content-marketplaces migration).

**Other marketplaces**

- Shorter `genericInstructions(...)` in content-marketplace-defaults — includes generic “avoid policy violations” text, not the full Amazon document.

**Conclusion for “Done”:** If Feature 7 means *Amazon listing policy guidelines are applied when generating listing JSON in the default flow*, that is **largely true today** for Amazon.

### 1.2 What is not done (program-wide Feature 7)

| Gap | Detail |
|-----|--------|
| No shared policy module | Compliance is prompt text, not one required function all callers use. |
| No `marketplace_policy_documents` table | No versioned client PFA upload; policy is code seed + Admin textarea. |
| A+ copy separate path | `artifacts/api-server/src/lib/ebc-generator.ts` — short A+ system prompt; does not inject `AMAZON_LISTING_AI_INSTRUCTIONS`. |
| A+ images | `aplus-generator.ts` + `image_prompt_templates` — image prompts, not listing policy doc. |
| Bulk / variants | Not built yet — new code could bypass policy if it calls AI directly. |
| No post-generation validator | No automated banned-phrase check after model output. |
| No regression test | No test that every generation entry point includes policy. |
| Agents | `sellermate-agent-runtime.ts` — separate content policy text. |

**Recommendation:** Treat Feature 7 as **done for current single-path listing generation**; complete **central policy helper + tests before or with Features 3–4**; wire **ebc-generator** if A+ copy must match listing policy.

---

## 2. Per-feature database and file impacts

Cross-cutting for most features: `lib/db/src/schema/`, `scripts/sync-local-db.sh`, `scripts/sync-production-db.sh`, `scripts/sql/production-schema-upgrade.sql`, credits/permissions as needed.

---

### Feature 1 — Additional listing attributes (Excel)

**Goal:** Dynamic attributes per product type; export columns match feedback Excel.

**New / modified tables**

| Table | Purpose |
|-------|---------|
| `attribute_definitions` (new) | Per product type: key, label, type, max length, required, export_column_name, sort order, optional allowed values json. |
| `audit_attribute_values` (new) | EAV: audit_id, attribute_key, value; unique (audit_id, attribute_key). |
| `amazon_product_types` (new, shared with Feature 2) | FK for product_type_id on definitions. |
| `audits` (modify, additive) | Optional amazon_product_type_id; keep category text for legacy. |

**Main files / areas**

- DB schema and migrations (see cross-cutting).
- API: routes for definitions and audit attribute values.
- Export: `artifacts/api-server/src/lib/amazon-listing-export.ts`; possibly `resolve-listing-content.ts`.
- UI: `projects/create.tsx`, `audit-workflow.tsx` — dynamic forms from API.
- Admin: Catalog / attributes CRUD and optional CSV import.

**Backward compatibility:** Missing optional attributes → blank export cells; existing audits without values export without error.

---

### Feature 2 — Category expansion (Amazon India context)

**New / modified tables**

| Table | Purpose |
|-------|---------|
| `amazon_product_types` (new) | marketplace_code, display_name, feed_product_type, browse label, enabled, optional referral_fee_percent, closing_fee_inr, etc. |
| `audits` (modify) | Optional amazon_product_type_id; keep category string + alias migration. |

**Main files / areas**

- Admin: new Catalog product-types page — CRUD, CSV import.
- API: list/filter product types by marketplace.
- UI: replace hardcoded `AMAZON_CATEGORIES` in `projects/create.tsx`, `audit-workflow.tsx`, `graphics-wizard.tsx`.
- Export: `amazon-listing-export.ts` — feed_product_type / item_type from selected type.
- One-time migration: old category strings → product type or alias.

**Backward compatibility:** Audits with only category text still open and display.

---

### Feature 3 — Bulk content creation

**New tables**

| Table | Purpose |
|-------|---------|
| `bulk_jobs` or `content_generation_jobs` | user, workspace, status, counts, credits reserved, timestamps. |
| `bulk_job_items` or `content_generation_job_items` | Per audit: status, error, attempts, credits charged/refunded. |

**Main files / areas**

- API: create job, status, cancel, retry failed.
- Worker: background processor with concurrency — must call `generateListingContent()`, not duplicate prompts.
- Credits: extend preflight/reserve/refund (pattern from `credit-preflight.js`, audit content deduct).
- UI: Products list multi-select, preflight, progress view.
- Optional: notifications on job complete.

**Backward compatibility:** Single-audit generate unchanged.

---

### Feature 4 — Multi-marketplace content + Excel workbook

**New / modified tables**

| Table | Purpose |
|-------|---------|
| `audit_content_variants` (new) | audit_id, content_marketplace_id, generated_content jsonb; unique pair. |
| `content_marketplaces` (extend) | Export sheet names, column maps — extend existing table. |
| Assumptions log (new table or json) | Assumptions & Doubts for export sheet. |
| `audits` | Keep generated_content as primary/default marketplace copy. |

**Main files / areas**

- Generation: `content-generator.ts` — loop marketplaces, upsert variants; consistency check library.
- Export: new multi-sheet Excel module (ExcelJS); wire from audit export routes.
- UI: multi-marketplace select, review flags before export.
- Admin: extend content-marketplaces settings.

**Backward compatibility:** Additive export format; single-marketplace preview still uses audits.generated_content.

---

### Feature 5 — Revenue calculator

**New / modified tables**

| Table | Purpose |
|-------|---------|
| `amazon_product_types` | Referral/closing fees from Feature 2. |
| `fee_rules` (optional) | Price bands per product type. |
| `fba_fee_tiers` (optional) | Weight/size tiers. |
| `product_profit_scenarios` (optional) | Saved scenarios. |

**Main files / areas**

- New: `lib/revenue-calculator.ts` (pure functions + unit tests).
- API: calculate endpoint; optional persist scenario.
- Admin: fee rules under Catalog.
- UI: calculator panel on audit/product; optional bulk list column.

---

### Feature 6 — A+ content graphics (SOP alignment)

**Tables**

| Table | Purpose |
|-------|---------|
| `image_prompt_templates` (existing) | New/updated rows; optional metadata json for dimensions/modules. |

**Main files / areas**

- `image-prompt-template-service.ts`, `aplus-generator.ts`, `aplus-image-size.ts`.
- Admin image prompt templates; seeds in ensure-image-prompt-templates.
- Frontend: `aplus-content-wizard.tsx`, `audit-workflow.tsx`, `useAplusModuleCards`.
- Export: aplus/ folder in listing zip — verify dimensions in names/metadata.
- Legacy module ID mapping in template service.

**Feature 7 tie-in:** Wire `ebc-generator.ts` to shared policy if A+ copy must match listing policy.

---

### Feature 7 — Complete policy program (beyond current “Done”)

**Optional new tables**

| Table | Purpose |
|-------|---------|
| `marketplace_policy_documents` | Versioned policy body, active flag, marketplace slug. |
| `content_marketplaces` (additive) | Optional policy_document_id FK. |

**Main files / areas**

- New: `lib/listing-policy.ts` — load policy → prompt block; optional post-parse lint.
- Modify: `content-generator.ts`, `ebc-generator.ts` to use helper only.
- Future: bulk worker and variant generator must use same paths.
- Admin: policy document CRUD or link from content marketplaces.
- Tests: assert all generation entry points include policy.

---

## 3. Recommended build order (from agreed SOW)

1. Feature 2 — Category expansion (feeds 1 and 5).  
2. Feature 1 — Listing attributes (parallel possible with 5).  
3. Feature 5 — Revenue calculator.  
4. Features 3 and 4 — Shared job queue and credit preflight.  
5. Feature 6 — A+ graphics (parallel anytime).  
6. Feature 7 hardening — Central policy + tests with Features 3–4.  
7. Cross-feature testing (section 10 of SOW).

---

## 4. Cross-cutting rules (all features)

- Every new AI output path must use the policy layer (once centralized).  
- Product types, attributes, fees, A+ modules in DB + Admin, not hardcoded.  
- Old audits open and export as before.  
- Credit estimate before multiplied generation; block if insufficient.  
- Conflicts flagged for human review (Feature 4); no silent publish.

---

## 5. Open questions (block detail, not architecture)

- Primary marketplace: India fees vs AE columns in attribute template.  
- Feature 4: which marketplaces and sheet layouts in scope.  
- Whether policy layer must cover non-Amazon marketplaces at same depth as Amazon.  
- First categories and required attributes per type.  
- Bulk size targets and credit budget per run.  
- Revenue calculator: GST on fees, FBA tier model.  
- Mandatory Assumptions & Doubts and image review before export.

---

## 6. Approval gate

No implementation should start until the client confirms:

1. Feature 7 strictness (current prompts only vs central module + tests before bulk/variants).  
2. Phase to start (e.g. Feature 2 only, or Feature 2 + Feature 7 hardening).  
3. Answers to open marketplace and calculator questions.

---

*Generated from engineering verification against the Listing Analyzer Pro codebase (October 2026).*
