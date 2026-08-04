import { db, pool } from "./index.js";
import { blogPosts } from "./schema/index.js";
import { eq } from "drizzle-orm";

const now = new Date();

const SEED_BLOG_POSTS = [
  {
    title: "Why Every Amazon Seller Should Run an AI Listing Audit in 2026",
    slug: "why-ai-listing-audit-amazon-2026",
    excerpt:
      "Most listings lose sales from fixable issues in titles, bullets, images, and keywords—not bad products. Learn how an AI audit surfaces those gaps in minutes.",
    content: `Amazon shoppers decide in seconds. If your title is vague, your bullets repeat the same phrase, or your main image doesn't read on mobile, you lose the click—even when your product is strong.

An AI listing audit scores your page across the categories that actually move conversion: title clarity, bullet structure, image coverage, and keyword relevance. Instead of guessing what to fix, you get a prioritized list of issues and concrete rewrite suggestions.

SellerLens runs a full audit in under a minute. You paste your ASIN or listing URL, and the system compares your content against Amazon best practices and optional competitor listings. The result is an overall score plus per-category breakdowns so you know exactly where to start.

Teams use audits before launches, after PPC pushes stall, and when organic rank plateaus. One pass often reveals quick wins: missing keywords in the title, weak benefit-led bullets, or image slots left empty.

If you haven't audited your hero SKU this quarter, start there. Small copy and image fixes compound into better CTR, higher conversion, and stronger ad efficiency—without changing your product or price.`,
    featuredImage:
      "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1200&h=630&fit=crop",
    status: "published",
    publishedAt: now,
    seoTitle: "Why Amazon Sellers Need AI Listing Audits in 2026 | SellerLens",
    seoDescription:
      "Discover how AI listing audits uncover title, bullet, image, and keyword issues on Amazon—and why sellers run them before every major launch.",
    tags: ["amazon", "listing audit", "ai", "conversion"],
    category: "Listing Optimization",
    author: "SellerLens Team",
    readMinutes: 6,
  },
  {
    title: "5 Amazon Title Mistakes That Tank Your Click-Through Rate",
    slug: "amazon-title-mistakes-click-through-rate",
    excerpt:
      "Your title is the first thing shoppers read. These five common patterns hurt CTR—and how to rewrite them for clarity and search.",
    content: `Your product title is prime retail space. Amazon allows up to 200 characters in many categories, but mobile shoppers often see only the first 60–80. Every word must earn its place.

Mistake #1: Keyword stuffing without readability. Search terms crammed together look spammy and hurt trust. Lead with the product shoppers recognize, then add attributes (size, count, material) in natural language.

Mistake #2: Brand name repeated twice. You already have brand registry and byline space—don't waste title characters repeating your logo name.

Mistake #3: Missing the core use case. "Premium quality" tells nobody what the product does. State the job: "Insulated Travel Mug — Keeps Coffee Hot 12 Hours, Leak-Proof Lid."

Mistake #4: Ignoring mobile truncation. Put the highest-value words first. If shoppers only see "Wireless Bluetooth Earbuds Noise…" they should already know what they're buying.

Mistake #5: No differentiation from competitors. If ten listings start with the same generic phrase, you blend into the grid. Highlight one concrete benefit or spec competitors omit.

SellerLens audits flag title length, keyword coverage, and clarity issues automatically. Run your ASIN, compare against a rival listing, and export suggested rewrites you can test in Manage Inventory or your feed tool.

Better titles lift CTR first; conversion follows when bullets and images match the promise in the headline.`,
    featuredImage:
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&h=630&fit=crop",
    status: "published",
    publishedAt: now,
    seoTitle: "5 Amazon Title Mistakes That Hurt CTR (and How to Fix Them)",
    seoDescription:
      "Avoid keyword stuffing, weak hooks, and mobile truncation. Practical title fixes every Amazon seller can apply today.",
    tags: ["amazon seo", "product title", "ctr", "keywords"],
    category: "Amazon Tips",
    author: "SellerLens Team",
    readMinutes: 5,
  },
  {
    title: "How to Compare Your Amazon Listing Against Competitors (Without Spreadsheets)",
    slug: "compare-amazon-listing-competitors",
    excerpt:
      "Side-by-side competitor analysis helps you spot gaps in keywords, images, and positioning. Here's a faster workflow than manual copy-paste.",
    content: `Competitor research on Amazon used to mean opening ten tabs, copying titles into a spreadsheet, and squinting at image galleries. That works once—but it's slow when you're optimizing a catalog every month.

A structured competitor comparison answers three questions: What keywords do they emphasize that you miss? How many image slots and lifestyle angles do they use? Where is their copy stronger on benefits vs. features?

SellerLens lets you add a competitor ASIN after your audit. The tool analyzes both listings with the same scoring model, then highlights strengths and weaknesses side by side. You see which category scores lag—title, bullets, images, or keywords—and get suggestions tailored to close the gap.

Use competitor mode when you're entering a crowded niche, refreshing a stale SKU, or briefing a designer on image gaps. Agencies run it for every client onboarding so the first content sprint targets real market gaps, not generic templates.

Pro tip: compare against the listing that owns the sponsored top slot for your target keyword, not just the organic #1. That's often the listing shoppers benchmark mentally.

Pair competitor insights with your audit score trend over time. When your overall score climbs and your gap vs. the rival narrows, you're usually seeing movement in impressions and conversion within a few weeks.`,
    featuredImage:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&h=630&fit=crop",
    status: "published",
    publishedAt: now,
    seoTitle: "Amazon Competitor Listing Comparison Guide | SellerLens",
    seoDescription:
      "Compare your Amazon listing to competitors on keywords, images, and copy—without spreadsheets. A practical workflow for sellers and agencies.",
    tags: ["competitor analysis", "amazon", "listing audit"],
    category: "Listing Optimization",
    author: "SellerLens Team",
    readMinutes: 7,
  },
  {
    title: "Agency Playbook: Managing Multiple Amazon Client Workspaces",
    slug: "agency-multiple-amazon-workspaces",
    excerpt:
      "Agencies juggling several brands need clean credit pools, member permissions, and workspace isolation. How SellerLens structures account vs. client workspaces.",
    content: `Amazon agencies rarely serve one brand. You onboard clients, assign strategists, fund credits per account, and need dashboards that don't leak data across clients.

SellerLens separates your owner workspace—the account hub where plan credits sit—from client workspaces you create for each brand. Fund a workspace pool from unallocated account credits, then assign member credits to teammates working that client. Everyone sees only the projects and audits inside their workspace.

The account dashboard shows portfolio-level stats: total audits, projects saved, workspace count (including your owner workspace plus clients), and credit balance across pools. Drill into a client workspace for scoped audits, graphics, and recent projects without mixing another brand's ASINs into the view.

Roles control who can invite members, edit billing, or run audits only. Growth and Pro plans unlock multiple workspaces; Starter suits solo sellers with a single owner workspace.

Onboarding checklist for agencies: create a workspace per client, fund the pool from account credits, invite the client's reviewers with view-only roles, run a baseline audit on hero ASINs, and add top competitors for gap analysis. Re-audit monthly and track score deltas in client reports.

Clean workspace hygiene reduces rework, protects client data, and makes capacity planning obvious—which accounts are heavy on image credits vs. audit credits this month.`,
    featuredImage:
      "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&h=630&fit=crop",
    status: "published",
    publishedAt: now,
    seoTitle: "Managing Multiple Amazon Client Workspaces for Agencies",
    seoDescription:
      "How agencies use SellerLens workspaces, credit pools, and roles to manage multiple Amazon brands without mixing client data.",
    tags: ["agency", "workspaces", "amazon agency", "team"],
    category: "For Agencies",
    author: "SellerLens Team",
    readMinutes: 6,
  },
  {
    title: "Understanding Your SellerLens Audit Score: What Each Category Means",
    slug: "understanding-sellerlens-audit-score",
    excerpt:
      "Your overall score is only the headline. Learn how title, bullets, images, and keyword scores combine—and what to fix first.",
    content: `SellerLens breaks every audit into four scored categories, each weighted toward how shoppers and Amazon's algorithm evaluate your listing.

Title score reflects clarity, length, keyword coverage, and mobile readability. Bullets score measures benefit-led structure, variety, and whether you avoid redundant phrases. Images score checks hero quality, slot fill rate, and whether visuals support the claims in your copy. Keywords score looks at backend and frontend term alignment with the product's search intent.

The overall score is a weighted blend—not an average you can fix by polishing one section while ignoring others. A 72 with a 45 in images usually means visual gaps are dragging conversion even if your copy is strong.

When you open an audit, read issues before suggestions. Issues explain the problem in plain language; suggestions give rewrite examples you can accept or edit. Competitor comparison adds context: if your title scores 80 but the rival scores 92, prioritize title work before chasing keyword tweaks.

Re-run audits after you publish changes. Scores aren't grades for morale—they're regression tests. A drop in bullets after a bulk edit signals accidental truncation or policy-risk phrasing.

Teams on SellerLens often set internal targets: 85+ overall before launch, 90+ on hero SKUs in competitive niches. Pair scores with business metrics—CTR from Brand Analytics, conversion from Business Reports—to validate that copy changes move the numbers, not just the dashboard.`,
    featuredImage:
      "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=1200&h=630&fit=crop",
    status: "published",
    publishedAt: now,
    seoTitle: "SellerLens Audit Score Explained: Title, Bullets, Images, Keywords",
    seoDescription:
      "What SellerLens audit scores mean for title, bullets, images, and keywords—and how to prioritize fixes that improve Amazon conversion.",
    tags: ["audit score", "sellerlens", "amazon listing"],
    category: "Product Guides",
    author: "SellerLens Team",
    readMinutes: 5,
  },
];

async function seed() {
  console.log("Seeding blog posts...");
  for (const post of SEED_BLOG_POSTS) {
    const existing = await db
      .select({ id: blogPosts.id })
      .from(blogPosts)
      .where(eq(blogPosts.slug, post.slug));

    if (existing.length > 0) {
      console.log(`  ⏭  Skipping "${post.slug}" — already exists (id ${existing[0]!.id})`);
      continue;
    }

    const [inserted] = await db.insert(blogPosts).values(post).returning({ id: blogPosts.id });
    console.log(`  ✓  Inserted "${post.title}" (id ${inserted!.id})`);
  }
  console.log("Done.");
  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
