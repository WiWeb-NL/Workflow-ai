import { Keypair } from "@solana/web3.js";
import { db } from "@/db";
import { userSolanaWallets } from "@/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { createLogger } from "@/lib/logs/console-logger";

const logger = createLogger("Wallet-Manager");

// Encryption key for private keys (in production, use proper key management)
const ENCRYPTION_KEY =
  process.env.WALLET_ENCRYPTION_KEY || "default-key-change-in-production";

interface WalletInfo {
  address: string;
  hasPrivateKey: boolean;
  solBalance?: number;
  flowaiTokenBalance?: number;
}

interface CreateWalletResult {
  success: boolean;
  wallet?: {
    address: string;
    privateKey: string; // Base64 encoded
  };
  error?: string;
}

export class WalletManager {
  /**
   * Encrypt private key for storage
   */
  private encryptPrivateKey(privateKey: string): string {
    const algorithm = "aes-256-gcm";
    const key = crypto.scryptSync(ENCRYPTION_KEY, "salt", 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);

    let encrypted = cipher.update(privateKey, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    // Combine IV, authTag, and encrypted data
    return iv.toString("hex") + ":" + authTag.toString("hex") + ":" + encrypted;
  }

  /**
   * Decrypt private key from storage
   */
  private decryptPrivateKey(encryptedPrivateKey: string): string {
    const parts = encryptedPrivateKey.split(":");
    
    if (parts.length === 3) {
      // New GCM format: iv:authTag:encrypted
      const algorithm = "aes-256-gcm";
      const key = crypto.scryptSync(ENCRYPTION_KEY, "salt", 32);
      const iv = Buffer.from(parts[0], "hex");
      const authTag = Buffer.from(parts[1], "hex");
      const encrypted = parts[2];

      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    }
    
    // Fallback for old format or development
    throw new Error("Invalid encrypted private key format");
  }

  /**
   * Create a new wallet for a user
   * Now uses only user_solana_wallets table (no fallback)
   */
  async createWallet(userId: string): Promise<CreateWalletResult> {
    try {
      // Check if user already has a wallet
      const existingWallet = await this.getUserWallet(userId);
      if (existingWallet) {
        return {
          success: false,
          error: "User already has a wallet",
        };
      }

      // Generate new keypair
      const keypair = Keypair.generate();
      const address = keypair.publicKey.toBase58();
      const privateKeyBytes = keypair.secretKey;
      const privateKeyBase64 = Buffer.from(privateKeyBytes).toString("base64");

      // Encrypt private key
      const encryptedPrivateKey = this.encryptPrivateKey(privateKeyBase64);

      // Store in user_solana_wallets table only
      await db.insert(userSolanaWallets).values({
        id: crypto.randomUUID(),
        userId,
        walletAddress: address,
        encryptedPrivateKey,
        isPrimary: true,
      });

      logger.info("Created new wallet for user", { userId, address });

      return {
        success: true,
        wallet: {
          address,
          privateKey: privateKeyBase64,
        },
      };
    } catch (error) {
      logger.error("Failed to create wallet", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create wallet",
      };
    }
  }

  /**
   * Get user's wallet information
   * Now uses only user_solana_wallets table (no fallback)
   */
  async getUserWallet(userId: string): Promise<WalletInfo | null> {
    try {
      const walletData = await db.query.userSolanaWallets.findFirst({
        where: eq(userSolanaWallets.userId, userId),
      });

      if (walletData) {
        return {
          address: walletData.walletAddress,
          hasPrivateKey: !!walletData.encryptedPrivateKey,
        };
      }

      return null;
    } catch (error) {
      logger.error("Failed to get user wallet", error);
      return null;
    }
  }

  /**
   * Get user's decrypted private key (use with caution)
   * Now uses only user_solana_wallets table (no fallback)
   */
  async getUserPrivateKey(userId: string): Promise<string | null> {
    try {
      const walletData = await db.query.userSolanaWallets.findFirst({
        where: eq(userSolanaWallets.userId, userId),
      });

      if (!walletData?.encryptedPrivateKey) {
        return null;
      }

      // Decrypt private key
      return this.decryptPrivateKey(walletData.encryptedPrivateKey);
    } catch (error) {
      logger.error("Failed to get user private key", error);
      return null;
    }
  }

  /**
   * Import wallet from private key
   */
  async importWallet(
    userId: string,
    privateKeyBase64: string
  ): Promise<CreateWalletResult> {
    try {
      // Check if user already has a wallet
      const existingWallet = await this.getUserWallet(userId);
      if (existingWallet) {
        return {
          success: false,
          error: "User already has a wallet. Delete existing wallet first.",
        };
      }

      // Validate private key
      let keypair: Keypair;
      try {
        const privateKeyBytes = Buffer.from(privateKeyBase64, "base64");
        keypair = Keypair.fromSecretKey(privateKeyBytes);
      } catch (error) {
        return {
          success: false,
          error: "Invalid private key format",
        };
      }

      const address = keypair.publicKey.toBase58();
      const encryptedPrivateKey = this.encryptPrivateKey(privateKeyBase64);

      // Store in user_solana_wallets table only
      await db.insert(userSolanaWallets).values({
        id: crypto.randomUUID(),
        userId,
        walletAddress: address,
        encryptedPrivateKey,
        isPrimary: true,
      });

      logger.info("Imported wallet for user", { userId, address });

      return {
        success: true,
        wallet: {
          address,
          privateKey: privateKeyBase64,
        },
      };
    } catch (error) {
      logger.error("Failed to import wallet", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to import wallet",
      };
    }
  }

  /**
   * Delete user's wallet
   */
  async deleteWallet(
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await db
        .delete(userSolanaWallets)
        .where(eq(userSolanaWallets.userId, userId));

      logger.info("Deleted wallet for user", { userId });

      return { success: true };
    } catch (error) {
      logger.error("Failed to delete wallet", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to delete wallet",
      };
    }
  }

  // Keep all the other methods from the original file that don't involve user table fallback
  // These methods should work the same way as before since they use the wallet address
  // which is now always retrieved from user_solana_wallets

  /**
   * Fix corrupted wallet by regenerating it (development helper)
   */
  async fixCorruptedWallet(userId: string): Promise<CreateWalletResult> {
    try {
      logger.warn("Attempting to fix corrupted wallet", { userId });

      // Delete existing wallet
      await this.deleteWallet(userId);

      // Create new wallet
      const result = await this.createWallet(userId);

      if (result.success) {
        logger.info("Successfully fixed corrupted wallet", {
          userId,
          newAddress: result.wallet?.address,
        });
      }

      return result;
    } catch (error) {
      logger.error("Failed to fix corrupted wallet", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fix wallet",
      };
    }
  }

  /**
   * Validate and repair private key if needed
   */
  async validateAndRepairWallet(
    userId: string
  ): Promise<{ valid: boolean; fixed?: boolean; error?: string }> {
    try {
      const privateKey = await this.getUserPrivateKey(userId);

      if (!privateKey) {
        return { valid: false, error: "No private key found" };
      }

      // Try to create a keypair to validate the private key
      try {
        let keypair: Keypair;

        // Try different decoding methods
        if (privateKey.length === 88) {
          // Standard base64
          const privateKeyBytes = Buffer.from(privateKey, "base64");
          if (privateKeyBytes.length === 64) {
            keypair = Keypair.fromSecretKey(privateKeyBytes);
            return { valid: true };
          }
        }

        // Try other methods...
        return { valid: false, error: "Invalid private key format" };
      } catch (keyError) {
        logger.warn("Invalid private key detected, attempting to fix", {
          userId,
          keyLength: privateKey.length,
          error: keyError instanceof Error ? keyError.message : "Unknown",
        });

        // Try to fix the wallet
        const fixResult = await this.fixCorruptedWallet(userId);
        return {
          valid: fixResult.success,
          fixed: fixResult.success,
          error: fixResult.error,
        };
      }
    } catch (error) {
      logger.error("Failed to validate wallet", error);
      return {
        valid: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

export const walletManager = new WalletManager();
