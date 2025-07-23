import { db } from "./db/index.js";
import { sql } from "drizzle-orm";

console.log("🔍 Checking wallet-related tables...\n");

try {
  // Check if user_solana_wallets table exists
  const tables = await db.execute(sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND (table_name LIKE '%wallet%' OR table_name = 'user')
    ORDER BY table_name
  `);

  console.log(
    "📋 Found tables:",
    tables.map((t) => t.table_name)
  );

  // Check user_solana_wallets table
  try {
    const walletCount = await db.execute(
      sql`SELECT COUNT(*) as count FROM user_solana_wallets`
    );
    console.log(`\n💰 user_solana_wallets: ${walletCount[0].count} records`);

    const walletSample = await db.execute(sql`
      SELECT userId, walletAddress, 
             CASE WHEN encryptedPrivateKey IS NOT NULL THEN 'YES' ELSE 'NO' END as has_private_key
      FROM user_solana_wallets 
      LIMIT 3
    `);
    console.log("Sample records:", walletSample);
  } catch (e) {
    console.log(
      "❌ user_solana_wallets table does not exist or error:",
      e.message
    );
  }

  // Check user table wallet fields
  try {
    const userWalletCount = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM "user" 
      WHERE "walletAddress" IS NOT NULL
    `);
    console.log(
      `\n👤 user table with wallets: ${userWalletCount[0].count} records`
    );

    const userWalletSample = await db.execute(sql`
      SELECT id, "walletAddress", 
             CASE WHEN "privateKey" IS NOT NULL THEN 'YES' ELSE 'NO' END as has_private_key
      FROM "user" 
      WHERE "walletAddress" IS NOT NULL
      LIMIT 3
    `);
    console.log("Sample user wallet records:", userWalletSample);
  } catch (e) {
    console.log("❌ Error checking user table:", e.message);
  }
} catch (error) {
  console.error("❌ Error:", error);
}

process.exit(0);
