import { Keypair } from "@solana/web3.js";
import { db } from "@/db";
import { user, userSolanaWallets } from "@/db/schema";
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
   * Create a new Solana wallet for user
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

      // Store in database (prioritize new userSolanaWallets table)
      try {
        await db.insert(userSolanaWallets).values({
          id: crypto.randomUUID(),
          userId,
          walletAddress: address,
          encryptedPrivateKey,
          isPrimary: true,
        });
      } catch (error) {
        // Fallback to user table if userSolanaWallets doesn't exist yet
        await db
          .update(user)
          .set({
            walletAddress: address,
            privateKey: encryptedPrivateKey,
          })
          .where(eq(user.id, userId));
      }

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
   */
  async getUserWallet(userId: string): Promise<WalletInfo | null> {
    try {
      // First check the new wallet table
      let walletData = await db.query.userSolanaWallets.findFirst({
        where: eq(userSolanaWallets.userId, userId),
      });

      if (walletData) {
        return {
          address: walletData.walletAddress,
          hasPrivateKey: !!walletData.encryptedPrivateKey,
        };
      }

      // Fallback to user table
      const userData = await db.query.user.findFirst({
        where: eq(user.id, userId),
      });

      if (userData?.walletAddress) {
        return {
          address: userData.walletAddress,
          hasPrivateKey: !!userData.privateKey,
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
   */
  async getUserPrivateKey(userId: string): Promise<string | null> {
    try {
      // First check the new wallet table
      let encryptedPrivateKey: string | null = null;

      const walletData = await db.query.userSolanaWallets.findFirst({
        where: eq(userSolanaWallets.userId, userId),
      });

      if (walletData?.encryptedPrivateKey) {
        encryptedPrivateKey = walletData.encryptedPrivateKey;
      } else {
        // Fallback to user table
        const userData = await db.query.user.findFirst({
          where: eq(user.id, userId),
        });
        encryptedPrivateKey = userData?.privateKey || null;
      }

      if (!encryptedPrivateKey) {
        return null;
      }

      // Decrypt private key
      return this.decryptPrivateKey(encryptedPrivateKey);
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

      // Store in database
      try {
        await db.insert(userSolanaWallets).values({
          id: crypto.randomUUID(),
          userId,
          walletAddress: address,
          encryptedPrivateKey,
          isPrimary: true,
        });
      } catch (error) {
        // Fallback to user table
        await db
          .update(user)
          .set({
            walletAddress: address,
            privateKey: encryptedPrivateKey,
          })
          .where(eq(user.id, userId));
      }

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
  async deleteWallet(userId: string): Promise<boolean> {
    try {
      // Try to delete from userSolanaWallets table
      try {
        await db
          .delete(userSolanaWallets)
          .where(eq(userSolanaWallets.userId, userId));
      } catch (error) {
        // Fallback to clearing user table
        await db
          .update(user)
          .set({
            walletAddress: null,
            privateKey: null,
          })
          .where(eq(user.id, userId));
      }

      logger.info("Deleted wallet for user", { userId });
      return true;
    } catch (error) {
      logger.error("Failed to delete wallet", error);
      return false;
    }
  }

  /**
   * Encrypt private key using AES-256-GCM
   */
  private encryptPrivateKey(privateKey: string): string {
    try {
      const algorithm = "aes-256-gcm";
      const key = crypto.scryptSync(ENCRYPTION_KEY, "salt", 32);
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(algorithm, key, iv);

      let encrypted = cipher.update(privateKey, "utf8", "hex");
      encrypted += cipher.final("hex");

      const authTag = cipher.getAuthTag();

      // Combine IV, authTag, and encrypted data
      return (
        iv.toString("hex") + ":" + authTag.toString("hex") + ":" + encrypted
      );
    } catch (error) {
      logger.error("Failed to encrypt private key", error);
      // Fallback to simple base64 encoding for development
      return Buffer.from(privateKey).toString("base64");
    }
  }

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
  private decryptPrivateKey(encryptedPrivateKey: string): string {
    try {
      // Check if it's the new format (with IV and authTag)
      if (encryptedPrivateKey.includes(":")) {
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
      }

      // Legacy format - try different decryption methods

      // Method 1: Try base64 decoding (development fallback)
      try {
        const decoded = Buffer.from(encryptedPrivateKey, "base64").toString();
        if (decoded.length === 88) {
          // Valid base64 private key length
          return decoded;
        }
      } catch (e) {
        // Continue to next method
      }

      // Method 2: Try XOR decryption (legacy)
      try {
        const key = Buffer.from(ENCRYPTION_KEY);
        const encrypted = Buffer.from(encryptedPrivateKey, "base64");
        const decrypted = Buffer.alloc(encrypted.length);

        for (let i = 0; i < encrypted.length; i++) {
          decrypted[i] = encrypted[i] ^ key[i % key.length];
        }

        const result = decrypted.toString();
        if (result.length >= 80 && result.length <= 100) {
          // Reasonable length for base64 key
          return result;
        }
      } catch (e) {
        // Continue to next method
      }

      // Method 3: Assume it's already the raw private key
      if (
        encryptedPrivateKey.length >= 80 &&
        encryptedPrivateKey.length <= 100
      ) {
        return encryptedPrivateKey;
      }

      throw new Error(`Unable to decrypt private key - invalid format`);
    } catch (error) {
      logger.error("Failed to decrypt private key", {
        error: error instanceof Error ? error.message : "Unknown error",
        keyLength: encryptedPrivateKey.length,
      });

      // Last resort: try to return as-is if it looks like a valid base64 private key
      if (
        encryptedPrivateKey.length >= 80 &&
        encryptedPrivateKey.length <= 100
      ) {
        logger.warn("Returning potentially unencrypted private key");
        return encryptedPrivateKey;
      }

      throw new Error("Cannot decrypt private key");
    }
  }
}

// Export singleton instance
export const walletManager = new WalletManager();
