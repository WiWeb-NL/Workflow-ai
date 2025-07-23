#!/usr/bin/env tsx

import { db } from "@/db";
import { flowaiTokenPricing } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Script to set up default FlowAI token pricing tiers
 * Run with: npx tsx scripts/setup-flowai-pricing.ts
 */

const DEFAULT_PRICING_TIERS = [
  {
    id: "starter_100",
    tokenAmount: 100,
    solanaPriceLamports: "100000000", // 0.1 SOL in lamports
    usdEquivalent: "5.00",
    bonusTokens: 0,
  },
  {
    id: "basic_500",
    tokenAmount: 500,
    solanaPriceLamports: "450000000", // 0.45 SOL in lamports
    usdEquivalent: "22.50",
    bonusTokens: 50,
  },
  {
    id: "pro_1000",
    tokenAmount: 1000,
    solanaPriceLamports: "800000000", // 0.8 SOL in lamports
    usdEquivalent: "40.00",
    bonusTokens: 200,
  },
  {
    id: "enterprise_5000",
    tokenAmount: 5000,
    solanaPriceLamports: "3500000000", // 3.5 SOL in lamports
    usdEquivalent: "175.00",
    bonusTokens: 1500,
  },
];

async function setupPricingTiers() {
  console.log("🚀 Setting up FlowAI token pricing tiers...");

  try {
    for (const tier of DEFAULT_PRICING_TIERS) {
      // Check if tier already exists
      const existing = await db.query.flowaiTokenPricing.findFirst({
        where: eq(flowaiTokenPricing.id, tier.id),
      });

      if (existing) {
        console.log(`✅ Pricing tier ${tier.id} already exists, skipping...`);
        continue;
      }

      // Insert new pricing tier
      await db.insert(flowaiTokenPricing).values({
        ...tier,
        isActive: true,
      });

      console.log(
        `✅ Created pricing tier: ${tier.id} (${tier.tokenAmount} + ${tier.bonusTokens} bonus tokens for ${Number(tier.solanaPriceLamports) / 1_000_000_000} SOL)`
      );
    }

    console.log("🎉 FlowAI token pricing setup complete!");

    // Display summary
    const allTiers = await db.query.flowaiTokenPricing.findMany({
      where: eq(flowaiTokenPricing.isActive, true),
    });

    console.log("\n📊 Active Pricing Tiers:");
    for (const tier of allTiers) {
      const solPrice = Number(tier.solanaPriceLamports) / 1_000_000_000;
      const totalTokens = tier.tokenAmount + tier.bonusTokens;
      console.log(
        `  • ${tier.id}: ${totalTokens} tokens (${tier.tokenAmount} + ${tier.bonusTokens} bonus) for ${solPrice} SOL (~$${tier.usdEquivalent})`
      );
    }
  } catch (error) {
    console.error("❌ Error setting up pricing tiers:", error);
    process.exit(1);
  }
}

// Run the setup if this file is executed directly
if (require.main === module) {
  setupPricingTiers().then(() => {
    process.exit(0);
  });
}

export { setupPricingTiers };
