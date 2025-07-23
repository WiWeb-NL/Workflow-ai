import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userSolanaWallets } from "@/db/schema";
import { createLogger } from "@/lib/logs/console-logger";
import { WalletManager } from "./wallet-manager";

const logger = createLogger("SolanaWalletStorage");

export interface UserWalletData {
  userId: string;
  walletAddress: string;
}

/**
 * Creates a new Solana wallet for a user using the proper wallet manager
 * @param userId The user ID to create a wallet for
 * @returns The wallet data (only public information)
 */
export async function createUserSolanaWallet(
  userId: string
): Promise<UserWalletData> {
  try {
    // Check if user already has a wallet
    const existingWallet = await db
      .select({ address: userSolanaWallets.walletAddress })
      .from(userSolanaWallets)
      .where(eq(userSolanaWallets.userId, userId))
      .limit(1);

    if (existingWallet[0]?.address) {
      logger.info("User already has a wallet address", {
        userId,
        walletAddress: existingWallet[0].address,
      });
      return {
        userId,
        walletAddress: existingWallet[0].address,
      };
    }

    // Create a new wallet using the wallet manager
    const walletManager = new WalletManager();
    const result = await walletManager.createWallet(userId);

    if (!result.success || !result.wallet) {
      throw new Error(result.error || "Failed to create wallet");
    }

    logger.info("Created and stored Solana wallet for user", {
      userId,
      walletAddress: result.wallet.address,
    });

    return {
      userId,
      walletAddress: result.wallet.address,
    };
  } catch (error) {
    logger.error("Failed to create Solana wallet for user", {
      error,
      userId,
    });
    throw new Error("Failed to create wallet");
  }
}

/**
 * Gets the wallet address for a user
 * @param userId The user ID
 * @returns The wallet address or null if not found
 */
export async function getUserWalletAddress(
  userId: string
): Promise<string | null> {
  try {
    const result = await db
      .select({ address: userSolanaWallets.walletAddress })
      .from(userSolanaWallets)
      .where(eq(userSolanaWallets.userId, userId))
      .limit(1);

    return result[0]?.address || null;
  } catch (error) {
    logger.error("Failed to get user wallet address", {
      error,
      userId,
    });
    return null;
  }
}

/**
 * Updates a user's wallet address (deprecated - wallets should be immutable)
 * @param userId The user ID
 * @param walletAddress The new wallet address
 */
export async function updateUserWalletAddress(
  userId: string,
  walletAddress: string
): Promise<void> {
  try {
    await db
      .update(userSolanaWallets)
      .set({
        walletAddress: walletAddress,
        updatedAt: new Date(),
      })
      .where(eq(userSolanaWallets.userId, userId));

    logger.info("Updated user wallet address", {
      userId,
      walletAddress,
    });
  } catch (error) {
    logger.error("Failed to update user wallet address", {
      error,
      userId,
      walletAddress,
    });
    throw new Error("Failed to update wallet address");
  }
}
