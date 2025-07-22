import { describe, it, expect, beforeEach } from "vitest";
import {
  generateSolanaWallet,
  isValidSolanaPublicKey,
  createKeypairFromPrivateKey,
} from "./wallet-generator";

describe("Solana Wallet Generator", () => {
  describe("generateSolanaWallet", () => {
    it("should generate a valid wallet with public and private keys", () => {
      const wallet = generateSolanaWallet();

      expect(wallet).toHaveProperty("publicKey");
      expect(wallet).toHaveProperty("privateKey");
      expect(typeof wallet.publicKey).toBe("string");
      expect(typeof wallet.privateKey).toBe("string");
      expect(wallet.publicKey.length).toBeGreaterThan(32);
      expect(wallet.privateKey.length).toBeGreaterThan(32);
    });

    it("should generate unique wallets each time", () => {
      const wallet1 = generateSolanaWallet();
      const wallet2 = generateSolanaWallet();

      expect(wallet1.publicKey).not.toBe(wallet2.publicKey);
      expect(wallet1.privateKey).not.toBe(wallet2.privateKey);
    });

    it("should generate valid Solana public keys", () => {
      const wallet = generateSolanaWallet();
      expect(isValidSolanaPublicKey(wallet.publicKey)).toBe(true);
    });
  });

  describe("isValidSolanaPublicKey", () => {
    it("should validate correct Solana public keys", () => {
      const wallet = generateSolanaWallet();
      expect(isValidSolanaPublicKey(wallet.publicKey)).toBe(true);
    });

    it("should reject invalid public keys", () => {
      expect(isValidSolanaPublicKey("invalid-key")).toBe(false);
      expect(isValidSolanaPublicKey("")).toBe(false);
      expect(isValidSolanaPublicKey("123")).toBe(false);
    });
  });

  describe("createKeypairFromPrivateKey", () => {
    it("should recreate keypair from private key", () => {
      const originalWallet = generateSolanaWallet();
      const recreatedKeypair = createKeypairFromPrivateKey(
        originalWallet.privateKey
      );

      expect(recreatedKeypair.publicKey.toBase58()).toBe(
        originalWallet.publicKey
      );
    });

    it("should throw error for invalid private key", () => {
      expect(() => createKeypairFromPrivateKey("invalid-key")).toThrow(
        "Invalid private key"
      );
    });
  });
});
