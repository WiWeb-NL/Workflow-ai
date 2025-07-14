import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { createLogger } from "@/lib/logs/console-logger";
import {
  generateSolanaWallet,
  type SolanaWalletData,
} from "./wallet-generator";

const logger = createLogger("SolanaWalletStorage");

export interface UserWalletData {
  userId: string;
  walletAddress: string;
  // Note: We store private keys encrypted/securely in a real implementation
  // For this example, we'll just store the public address in the user table
}

/**
 * Creates a new Solana wallet for a user and stores the public address
 * @param userId The user ID to create a wallet for
 * @returns The wallet data (only public information)
 */
export async function createUserSolanaWallet(
  userId: string
): Promise<UserWalletData> {
  try {
    // Check if user already has a wallet
    const existingUser = await db
      .select({ walletAddress: user.walletAddress })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (existingUser.length === 0) {
      throw new Error("User not found");
    }

    if (existingUser[0]?.walletAddress) {
      logger.info("User already has a wallet address", {
        userId,
        walletAddress: existingUser[0].walletAddress,
      });
      return {
        userId,
        walletAddress: existingUser[0].walletAddress,
      };
    }

    // Generate a new Solana wallet
    const walletData = generateSolanaWallet();

    // Update the user record with the wallet address
    await db
      .update(user)
      .set({
        walletAddress: walletData.publicKey,
        privateKey: walletData.privateKey, // Store securely in a real app
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));

    logger.info("Created and stored Solana wallet for user", {
      userId,
      walletAddress: walletData.publicKey,
    });

    // TODO: In a production system, you would want to:
    // 1. Encrypt the private key before storing it
    // 2. Store it in a separate, more secure table/service
    // 3. Use environment-specific encryption keys
    // 4. Consider using a hardware security module (HSM)

    // For now, we only return the public information
    return {
      userId,
      walletAddress: walletData.publicKey,
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
      .select({ walletAddress: user.walletAddress })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    return result[0]?.walletAddress || null;
  } catch (error) {
    logger.error("Failed to get user wallet address", {
      error,
      userId,
    });
    return null;
  }
}

/**
 * Updates a user's wallet address
 * @param userId The user ID
 * @param walletAddress The new wallet address
 */
export async function updateUserWalletAddress(
  userId: string,
  walletAddress: string
): Promise<void> {
  try {
    await db
      .update(user)
      .set({
        walletAddress,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));

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
