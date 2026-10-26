# Scope of Work (SOW)
## Ecommerce Guru — Listing & Support Enhancements

| Field | Detail |
|-------|--------|
| **Document version** | 1.0 |
| **Date** | 26 October 2026 |
| **Product** | Ecommerce Guru (Listing Analyzer Pro) |
| **Status** | Draft for client / stakeholder approval |
| **Deployment target (app)** | `staging` branch → production when approved |

---

## 1. Purpose

This Scope of Work describes **what will be delivered**, **how work will be done**, **dependencies**, and **what is out of scope** for two related efforts:

1. **Platform enhancements** — seven client-requested listing and AI capabilities on the existing Build Your Brand / Products workflow.
2. **Support inbox (Chatwoot)** — WhatsApp voice messages appearing as download-only cards instead of inline audio playback.

No development starts until this SOW (or selected phases) is **approved in writing**.

---

## 2. Background — current state

### 2.1 Ecommerce Guru (in codebase today)

| Area | Current capability |
|------|------------------|
| Listing Excel export | Amazon flat-file style (~25 columns); bulk export up to 100 products |
| Categories | UI picker (~100+ browse-style names); `feed_product_type` empty in export |
| AI content | One marketplace per project; one `generated_content` per audit |
| Bulk operations | Bulk **Excel export** only — not bulk AI generation |
| Multi-marketplace copy | Single primary copy; `product_profiles.target_marketplaces` is metadata only |
| Revenue | Historical order revenue on product detail — **no** Amazon fee / margin calculator |
| A+ graphics | Workflow + admin prompt templates; images in `audits.generated_images.aplus` |
| AI policy | Amazon rules in `content_marketplaces` / seeded instructions — no uploaded policy docs |
| In-app support tickets | Text-only tickets in admin — **separate** from Chatwoot |

### 2.2 Chatwoot (external — not in app repo)

WhatsApp voice notes arrive as media attachments. Inbox may show **“Voice message” / `[VOICE]`** with **download only**, depending on Chatwoot version, file type (OGG vs MP3), and server configuration.

---

## 3. Objectives

| # | Objective |
|---|-----------|
| O1 | Richer Amazon Excel and structured listing attributes without breaking existing exports |
| O2 | Expanded, marketplace-aligned product types / categories (incl. Amazon India context) |
| O3 | Bulk AI listing content generation for many products with credit and job tracking |
| O4 | Simultaneous multi-marketplace content generation and export |
| O5 | Revenue / fee / profitability calculator (Amazon India fees as reference) |
| O6 | A+ Content graphics aligned with client reference modules and templates |
| O7 | AI content constrained by client / marketplace policy documents |
| O8 | Chatwoot agents can **play** WhatsApp voice notes in-browser where possible |

---

## 4. Workstreams

### Workstream A — Ecommerce Guru platform (this repository)

Delivered via phased releases on **`staging`**, validated, then promoted to production per your release process (`bash deploy.sh staging` on server).

### Workstream B — Chatwoot & WhatsApp (Chatwoot server / infrastructure)

Delivered on the **Chatwoot host** (Docker/VM): upgrade, ffmpeg, channel and storage fixes. **Does not** require changes to Listing Analyzer Pro unless you later embed Chatwoot in the site.

---

## 5. Detailed scope — Workstream A (platform)

### Phase A1 — Listing attributes, categories, policy foundation

**Goal:** Match client reference Excel structure (columns TBD from reference file) and improve category / product type accuracy.

| Deliverable | Description |
|-------------|-------------|
| Product type catalog | Admin-maintained or seeded `amazon_product_types` (marketplace, feed type, display name) |
| Attribute templates | `amazon_listing_attribute_templates` driving UI fields and Excel columns |
| Audit fields | Additive columns on `audits`: `listing_attributes` (jsonb), `feed_product_type`, optional category metadata |
| Excel export v2 | Existing columns preserved; new columns or “Attributes” sheet; empty data = same behavior as today |
| Category UI | Structured picker linked to product types; keep legacy text `category` for old projects |
| Policy documents (v1) | `marketplace_policy_documents` + admin upload/paste; inject into AI prompts for Amazon/default marketplace |

**Acceptance criteria**

- Exporting an **old** project without new fields produces the **same** core columns as today.
- New projects can fill attributes and see them in downloaded Excel.
- AI generation includes policy excerpt when a document is active for that marketplace.
- Reference Excel column list signed off against client file.

**Database (additive)**

- Modify: `audits`, `product_profiles` (optional), `content_marketplaces` (optional policy FK/text)
- New: `amazon_product_types`, `amazon_listing_attribute_templates`, `marketplace_policy_documents`

---

### Phase A2 — Multi-marketplace content

**Goal:** Generate and store copy for multiple marketplaces in one action; export per client reference sheet layout.

| Deliverable | Description |
|-------------|-------------|
| Variant storage | `audit_content_variants` (audit + marketplace + `generated_content`) |
| Primary copy | `audits.generated_content` remains default for preview and backward compatibility |
| UI | Multi-select marketplaces on content step; progress and errors per marketplace |
| Export | Multi-sheet or multi-row Excel per reference; reuse bulk export patterns where possible |
| Credits | Charge per marketplace generation (same rules as today, summed) |

**Acceptance criteria**

- Single-marketplace projects behave as today.
- User can generate Amazon + eBay + Shopify (scope list TBD) in one run.
- Excel download includes each selected marketplace.

**Database**

- New: `audit_content_variants`
- Optional seed: `content_marketplaces` row e.g. `amazon-in`

---

### Phase A3 — Bulk content generation

**Goal:** From Products list, select many audits and queue AI content generation (not only bulk Excel export).

| Deliverable | Description |
|-------------|-------------|
| Job API | Create job, list status, per-item success/failure |
| UI | “Bulk generate content” with cap (e.g. 100, aligned with bulk export) |
| Notifications | Optional email/in-app when job completes |
| Credits | Preflight total credits; deduct per successful item |

**Acceptance criteria**

- Existing single-audit generate unchanged.
- Failed items reported with reason; successful items update `generated_content`.

**Database**

- New: `content_generation_jobs`, `content_generation_job_items`

---

### Phase A4 — Revenue calculator

**Goal:** Estimate selling price, fees, COGS, margin using Amazon India fee structure as baseline (extendable).

| Deliverable | Description |
|-------------|-------------|
| Fee rules data | `marketplace_fee_rules` seeded from public fee tables (IN first; scope TBD) |
| Calculator UI | Standalone page or product panel: price, cost, weight/category → fee breakdown, net margin |
| Optional save | `product_profit_scenarios` linked to audit |

**Acceptance criteria**

- Calculator works offline from seeded rules (no SP-API required for v1).
- Disclaimers: estimates only, not tax/legal advice.

**Database**

- New: `marketplace_fee_rules`, optional `product_profit_scenarios`

---

### Phase A5 — A+ Content graphics (content & templates)

**Goal:** Align modules and prompts with client A+ reference document.

| Deliverable | Description |
|-------------|-------------|
| Template updates | New/updated rows in `image_prompt_templates` (category `aplus`) |
| Module list | Extend or configure A+ module cards to match reference |
| Docs | Short admin guide for regenerating modules |

**Acceptance criteria**

- Existing A+ projects still load.
- New generations follow client module/layout reference.

**Database**

- Data changes primarily; optional metadata in `image_prompt_templates`
- `audits.generated_images.aplus` json extended only additively

---

## 6. Detailed scope — Workstream B (Chatwoot voice messages)

**Goal:** Agents hear WhatsApp voice notes in the dashboard without mandatory download.

| Step | Activity |
|------|----------|
| B1 | Document current Chatwoot version, install method (Docker compose / K8s / cloud) |
| B2 | Upgrade Chatwoot to supported release with HTML5 audio for attachments |
| B3 | Install **ffmpeg** in Rails/worker container if transcoding OGG→MP3 is required |
| B4 | Verify WhatsApp channel (Meta Cloud / Evolution / Twilio): media download enabled |
| B5 | Test inbound voice: attachment `file_type` = audio; play in Chrome/Edge |
| B6 | Fix Active Storage / shared volume if 404-on-first-load (rails + sidekiq same storage) |

**Acceptance criteria**

- New WhatsApp voice note shows **play control** (or reliable play after single load).
- Conversation list preview remains `[VOICE]` or improved label (channel-dependent).

**Out of scope for Workstream B**

- Rewriting Chatwoot in Ecommerce Guru
- Automatic speech-to-text transcription (optional future phase)

---

## 7. Technical principles (Workstream A)

1. **Additive schema only** — no removal of `generated_content`, existing export headers, or single-generate APIs.
2. **Staging first** — merge to `staging`, deploy with `bash deploy.sh staging`, UAT, then production.
3. **Credits & permissions** — reuse workspace roles and existing credit preflight patterns.
4. **Reference files** — client Excel, policy PDFs, and A+ doc required before A1/A5 sign-off on column/module parity.

---

## 8. Dependencies & inputs required from client

| Input | Used in |
|-------|---------|
| Reference Excel (listing attributes) | A1 export columns |
| Multi-marketplace reference Excel | A2 export layout |
| Amazon listing policy document(s) | A1 / A7 prompts |
| A+ Content reference doc | A5 templates |
| Marketplace list for multi-generate | A2 |
| Revenue calculator scope (IN only vs all export marketplaces) | A4 |
| Chatwoot server access (SSH/env) | B1–B6 |
| WhatsApp Business / API credentials (read-only for testing) | B4–B5 |

---

## 9. Out of scope (unless added by change order)

- Replacing Chatwoot with native in-app WhatsApp chat
- Voice-to-text transcription of customer voice notes in Chatwoot
- Automatic listing publish to Amazon SP-API for new attribute columns (export-only unless separately scoped)
- Changes to `main`/production deploy without explicit approval
- Clerk/native auth, SMTP, or unrelated dashboard UI (e.g. search placeholder) unless bundled in change order

---

## 10. Testing & acceptance

| Workstream | Testing |
|------------|---------|
| A | `pnpm run typecheck`; per-package build; manual UAT on staging: workflow, export, bulk job, calculator |
| B | Send test WhatsApp voice to staging inbox; verify play in agent dashboard |

Sign-off: named approver confirms each **phase** complete before next phase starts (recommended).

---

## 11. Deployment

| Component | Method |
|-----------|--------|
| Ecommerce Guru | Git `staging` → server `/root/Listing-Analyzer-Pro` → `bash deploy.sh staging` |
| Database | `scripts/sync-local-db.sh` (dev); `scripts/sync-production-db.sh` (prod) after schema migrations |
| Chatwoot | Separate deploy process on Chatwoot host; backup before upgrade |

---

## 12. Recommended phase order & approval gates

| Order | Phase | Workstream | Gate |
|-------|-------|------------|------|
| 1 | A1 | Platform | Approve columns + policy v1 |
| 2 | A5 or parallel | Platform | Approve A+ reference mapping |
| 3 | A2 | Platform | Approve marketplace list |
| 4 | A3 | Platform | Approve bulk limits & credits |
| 5 | A4 | Platform | Approve fee scope (IN vs global) |
| Parallel | B1–B6 | Chatwoot | Approve server access + upgrade window |

---

## 13. Deliverables summary

| # | Deliverable | Format |
|---|-------------|--------|
| D1 | Working features on staging URL | Deployed app |
| D2 | Schema migration scripts | Repo + sync scripts |
| D3 | Admin configuration guide (types, policy, fees) | Markdown in repo / PDF |
| D4 | Database impact reference | `docs/client-features-database-impact.*` |
| D5 | Chatwoot voice fix runbook | Section 6 + optional ops doc |
| D6 | This Scope of Work | PDF / DOCX / Markdown |

---

## 14. Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Client / Product owner | | | |
| Technical lead | | | |

**Approved phases (check all that apply):**

- [ ] A1 — Attributes, categories, policy v1  
- [ ] A2 — Multi-marketplace content  
- [ ] A3 — Bulk content generation  
- [ ] A4 — Revenue calculator  
- [ ] A5 — A+ templates  
- [ ] B — Chatwoot voice playback  

---

*End of Scope of Work*
