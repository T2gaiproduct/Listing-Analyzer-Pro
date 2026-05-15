import { db, pool } from "./index.js";
import { plansTable } from "./schema/index.js";
import { eq } from "drizzle-orm";

const SEED_PLANS = [
  {
    name: "Starter",
    description: "Perfect for solo sellers getting started with AI optimization.",
    priceMonthly: 29,
    priceYearly: 23,
    aiCredits: 100,
    imageCredits: 20,
    auditCredits: 10,
    teamMembers: 1,
    features: [
      "10 listing audits/mo",
      "100 AI content credits",
      "20 image generation credits",
      "Competitor comparison",
      "Score breakdown & suggestions",
      "Email support",
    ],
    excludedFeatures: ["Team members", "API access"],
    tag: null,
    sortOrder: 1,
    isHighlighted: false,
    ctaText: "Start Free Trial",
    isTrial: true,
    trialDays: 14,
    isActive: true,
  },
  {
    name: "Growth",
    description: "For growing brands that need more power and faster results.",
    priceMonthly: 79,
    priceYearly: 63,
    aiCredits: 500,
    imageCredits: 100,
    auditCredits: 50,
    teamMembers: 3,
    features: [
      "50 listing audits/mo",
      "500 AI content credits",
      "100 image generation credits",
      "Competitor comparison",
      "Score breakdown & suggestions",
      "Priority email support",
      "3 team members",
    ],
    excludedFeatures: ["API access"],
    tag: "Most Popular",
    sortOrder: 2,
    isHighlighted: true,
    ctaText: "Start Free Trial",
    isTrial: true,
    trialDays: 14,
    isActive: true,
  },
  {
    name: "Pro",
    description: "For agencies and power sellers with high-volume needs.",
    priceMonthly: 149,
    priceYearly: 119,
    aiCredits: 2000,
    imageCredits: 400,
    auditCredits: 999,
    teamMembers: 10,
    features: [
      "Unlimited listing audits",
      "2,000 AI content credits",
      "400 image generation credits",
      "Competitor comparison",
      "Score breakdown & suggestions",
      "Dedicated support",
      "10 team members",
      "API access",
    ],
    excludedFeatures: [],
    tag: "Best Value",
    sortOrder: 3,
    isHighlighted: false,
    ctaText: "Start Free Trial",
    isTrial: true,
    trialDays: 14,
    isActive: true,
  },
  {
    name: "Enterprise",
    description: "Custom solution for large agencies and enterprise brands.",
    priceMonthly: 0,
    priceYearly: 0,
    aiCredits: 999999,
    imageCredits: 999999,
    auditCredits: 999,
    teamMembers: 999,
    features: [
      "Unlimited everything",
      "Custom AI credit allocation",
      "Unlimited image generation",
      "Competitor comparison",
      "Score breakdown & suggestions",
      "Dedicated account manager",
      "Unlimited team members",
      "Full API access",
      "White-label reports",
    ],
    excludedFeatures: [],
    tag: null,
    sortOrder: 4,
    isHighlighted: false,
    ctaText: "Contact Sales",
    isTrial: false,
    trialDays: 0,
    isActive: true,
  },
];

async function seed() {
  console.log("Seeding plans...");
  for (const plan of SEED_PLANS) {
    const existing = await db.select({ id: plansTable.id }).from(plansTable).where(eq(plansTable.name, plan.name));
    if (existing.length > 0) {
      console.log(`  ⏭  Skipping "${plan.name}" — already exists (id ${existing[0]!.id})`);
    } else {
      const [inserted] = await db.insert(plansTable).values(plan).returning({ id: plansTable.id });
      console.log(`  ✓  Inserted "${plan.name}" (id ${inserted!.id})`);
    }
  }
  console.log("Done.");
  await pool.end();
}

seed().catch((err) => { console.error(err); process.exit(1); });
