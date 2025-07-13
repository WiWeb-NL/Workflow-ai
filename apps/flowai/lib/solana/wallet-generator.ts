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
 * Creates a keypair from a private key
 * @param privateKey Base64 encoded private key
 * @returns Keypair object
 */
export function createKeypairFromPrivateKey(privateKey: string): Keypair {
  try {
    const secretKey = Buffer.from(privateKey, "base64");
    return Keypair.fromSecretKey(secretKey);
  } catch (error) {
    logger.error("Failed to create keypair from private key", error);
    throw new Error("Invalid private key");
  }
}
