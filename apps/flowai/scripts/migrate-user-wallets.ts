/**
 * Migration script to create Solana wallets for existing users
 * Run this after implementing the wallet creation feature to ensure
 * all existing users get a wallet address.
 */

import { db } from "@/db";
import { user } from "@/db/schema";
import { isNull } from "drizzle-orm";
import { createUserSolanaWallet } from "@/lib/solana/wallet-storage";
import { createLogger } from "@/lib/logs/console-logger";

const logger = createLogger("WalletMigration");

async function migrateUsersToWallets() {
  try {
    console.log("🚀 Starting wallet migration for existing users...");

    // Find all users without wallet addresses
    const usersWithoutWallets = await db
      .select({ id: user.id, email: user.email })
      .from(user)
      .where(isNull(user.walletAddress));

    console.log(`📊 Found ${usersWithoutWallets.length} users without wallets`);

    if (usersWithoutWallets.length === 0) {
      console.log("✅ All users already have wallets. Nothing to migrate.");
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    // Process users in batches to avoid overwhelming the system
    const batchSize = 10;
    for (let i = 0; i < usersWithoutWallets.length; i += batchSize) {
      const batch = usersWithoutWallets.slice(i, i + batchSize);

      console.log(
        `🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(usersWithoutWallets.length / batchSize)}`
      );

      await Promise.allSettled(
        batch.map(async (userRecord) => {
          try {
            const walletData = await createUserSolanaWallet(userRecord.id);
            logger.info("Created wallet for existing user", {
              userId: userRecord.id,
              email: userRecord.email,
              walletAddress: walletData.walletAddress,
            });
            successCount++;
            console.log(`  ✅ Created wallet for ${userRecord.email}`);
          } catch (error) {
            logger.error("Failed to create wallet for existing user", {
              userId: userRecord.id,
              email: userRecord.email,
              error,
            });
            errorCount++;
            console.log(
              `  ❌ Failed to create wallet for ${userRecord.email}:`,
              error
            );
          }
        })
      );

      // Small delay between batches to be gentle on the system
      if (i + batchSize < usersWithoutWallets.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    console.log("\n📈 Migration Summary:");
    console.log(`  ✅ Successful: ${successCount}`);
    console.log(`  ❌ Failed: ${errorCount}`);
    console.log(`  📊 Total processed: ${successCount + errorCount}`);

    if (errorCount > 0) {
      console.log(
        "\n⚠️  Some users failed to get wallets. Check the logs for details."
      );
      console.log("   You can re-run this script to retry failed users.");
    } else {
      console.log("\n🎉 All users now have Solana wallets!");
    }
  } catch (error) {
    logger.error("Migration script failed", error);
    console.error("💥 Migration failed:", error);
    process.exit(1);
  }
}

// Run the migration if this script is executed directly
if (require.main === module) {
  migrateUsersToWallets()
    .then(() => {
      console.log("✅ Migration completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Migration failed:", error);
      process.exit(1);
    });
}

export { migrateUsersToWallets };
