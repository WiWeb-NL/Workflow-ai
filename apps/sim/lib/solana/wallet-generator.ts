import { Keypair } from "@solana/web3.js";
import { randomBytes } from "tweetnacl";
import { createLogger } from "@/lib/logs/console-logger";

const logger = createLogger("SolanaWalletGenerator");

export interface SolanaWalletData {
  publicKey: string;
  privateKey: string; // Base58 encoded
  mnemonic?: string; // Optional, for future BIP39 support
}

/**
 * Generates a new Solana wallet keypair
 * @returns Object containing public key, private key, and optional mnemonic
 */
export function generateSolanaWallet(): SolanaWalletData {
  try {
    // Generate a new random keypair
    const keypair = Keypair.generate();

    // Get the public key as a base58 string (Solana address)
    const publicKey = keypair.publicKey.toBase58();

    // Get the private key as a base58 string
    const privateKey = Buffer.from(keypair.secretKey).toString("base64");

    logger.info("Generated new Solana wallet", {
      publicKey,
      // Never log the private key in production
      hasPrivateKey: !!privateKey,
    });

    return {
      publicKey,
      privateKey,
    };
  } catch (error) {
    logger.error("Failed to generate Solana wallet", error);
    throw new Error("Failed to generate Solana wallet");
  }
}

/**
 * Validates a Solana public key
 * @param publicKey The public key to validate
 * @returns boolean indicating if the key is valid
 */
export function isValidSolanaPublicKey(publicKey: string): boolean {
  try {
    // Try to create a PublicKey object from the string
    const { PublicKey } = require("@solana/web3.js");
    new PublicKey(publicKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Creates a keypair from a private key in various formats
 * @param privateKey Private key in different formats: Base64, Base58, Uint8Array, or number array
 * @param format Optional format hint: 'base64', 'base58', 'array', or 'auto' for auto-detection
 * @returns Keypair object
 */
export function createKeypairFromPrivateKey(
  privateKey: string | number[] | Uint8Array,
  format?: "base64" | "base58" | "array" | "auto"
): Keypair {
  try {
    let secretKey: Uint8Array;

    // Handle array format (most common from wallets like Phantom)
    if (Array.isArray(privateKey) || privateKey instanceof Uint8Array) {
      secretKey = new Uint8Array(privateKey);
    }
    // Handle string formats
    else if (typeof privateKey === "string") {
      // Auto-detect or use provided format
      if (
        format === "base58" ||
        ((!format || format === "auto") &&
          privateKey.length > 80 &&
          !privateKey.includes("="))
      ) {
        // Base58 format (longer strings without = padding)
        const bs58 = require("bs58");
        secretKey = bs58.decode(privateKey);
      } else {
        // Base64 format (default)
        secretKey = new Uint8Array(Buffer.from(privateKey, "base64"));
      }
    } else {
      throw new Error("Unsupported private key format");
    }

    // Validate secret key length (should be 64 bytes for Solana)
    if (secretKey.length !== 64) {
      throw new Error(
        `Invalid secret key length: ${secretKey.length}. Expected 64 bytes.`
      );
    }

    const keypair = Keypair.fromSecretKey(secretKey);

    logger.info("Successfully created keypair from private key", {
      publicKey: keypair.publicKey.toBase58(),
      format: format || "auto-detected",
      keyLength: secretKey.length,
    });

    return keypair;
  } catch (error) {
    logger.error("Failed to create keypair from private key", {
      error: error instanceof Error ? error.message : error,
      keyType: typeof privateKey,
      keyLength: Array.isArray(privateKey)
        ? privateKey.length
        : privateKey instanceof Uint8Array
          ? privateKey.length
          : (privateKey as string).length,
    });
    throw new Error(
      `Invalid private key: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}
