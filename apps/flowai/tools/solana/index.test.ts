/**
 * @vitest-environment jsdom
 *
 * Solana Tools Unit Tests
 *
 * This file contains unit tests for the Solana tools, which include
 * SPL token transfers, Jupiter swaps, account queries, and price fetching.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  solanaTransferTool,
  solanaSwapTool,
  solanaAccountsTool,
  solanaPriceTool,
} from "./index";

// Mock the logger to avoid console output during tests
vi.mock("@/lib/logs/console-logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock Solana dependencies
vi.mock("@solana/web3.js", () => ({
  Connection: vi.fn(),
  PublicKey: vi.fn(),
  Transaction: vi.fn(),
  SystemProgram: vi.fn(),
  sendAndConfirmTransaction: vi.fn(),
  VersionedTransaction: vi.fn(),
  LAMPORTS_PER_SOL: 1_000_000_000,
}));

vi.mock("@solana/spl-token", () => ({
  getAssociatedTokenAddress: vi.fn(),
  createAssociatedTokenAccountInstruction: vi.fn(),
  createTransferInstruction: vi.fn(),
  getAccount: vi.fn(),
  getMint: vi.fn(),
}));

vi.mock("@/lib/solana/wallet-generator", () => ({
  createKeypairFromPrivateKey: vi.fn(() => ({
    publicKey: {
      toBase58: () => "mockPublicKey123",
    },
    secretKey: new Uint8Array(64),
  })),
}));

describe("Solana Tools", () => {
  describe("Solana Transfer Tool", () => {
    it("should have correct tool configuration", () => {
      expect(solanaTransferTool.id).toBe("solana_transfer");
      expect(solanaTransferTool.name).toBe("Solana Token Transfer");
      expect(solanaTransferTool.description).toContain("Transfer SPL tokens");
      expect(solanaTransferTool.version).toBe("1.0.0");
    });

    it("should have required parameters defined", () => {
      const params = solanaTransferTool.params;

      expect(params.privateKey).toBeDefined();
      expect(params.privateKey.required).toBe(true);

      expect(params.recipientAddress).toBeDefined();
      expect(params.recipientAddress.required).toBe(true);
      expect(params.recipientAddress.requiredForToolCall).toBe(true);

      expect(params.tokenMint).toBeDefined();
      expect(params.tokenMint.required).toBe(true);
      expect(params.tokenMint.requiredForToolCall).toBe(true);

      expect(params.amount).toBeDefined();
      expect(params.amount.required).toBe(true);
      expect(params.amount.requiredForToolCall).toBe(true);

      // Network parameter should exist for transfer operations
      expect(params.network).toBeDefined();
      expect(params.network.required).toBe(false);
    });

    it("should construct request body correctly", () => {
      const params = {
        privateKey: "testPrivateKey",
        recipientAddress: "testRecipient123",
        tokenMint: "testMint123",
        amount: 100,
        memo: "Test transfer",
        network: "devnet" as const,
      };

      const requestBody = solanaTransferTool.request.body!(params);

      expect(requestBody).toEqual({
        privateKey: "testPrivateKey",
        privateKeyFormat: "auto",
        recipientAddress: "testRecipient123",
        tokenMint: "testMint123",
        amount: 100,
        memo: "Test transfer",
        network: "devnet",
      });
    });
  });

  describe("Solana Swap Tool", () => {
    it("should have correct tool configuration", () => {
      expect(solanaSwapTool.id).toBe("solana_swap");
      expect(solanaSwapTool.name).toBe("Solana Token Swap");
      expect(solanaSwapTool.description).toContain("Jupiter aggregator");
      expect(solanaSwapTool.version).toBe("1.0.0");
    });

    it("should have required parameters defined", () => {
      const params = solanaSwapTool.params;

      expect(params.privateKey).toBeDefined();
      expect(params.privateKey.required).toBe(true);

      expect(params.inputMint).toBeDefined();
      expect(params.inputMint.required).toBe(true);
      expect(params.inputMint.requiredForToolCall).toBe(true);

      expect(params.outputMint).toBeDefined();
      expect(params.outputMint.required).toBe(true);
      expect(params.outputMint.requiredForToolCall).toBe(true);

      expect(params.amount).toBeDefined();
      expect(params.amount.required).toBe(true);
      expect(params.amount.requiredForToolCall).toBe(true);

      expect(params.slippageBps).toBeDefined();
      expect(params.slippageBps.required).toBe(false);

      // Network parameter should exist for swap operations
      expect(params.network).toBeDefined();
      expect(params.network.required).toBe(false);
    });

    it("should construct request body with defaults", () => {
      const params = {
        privateKey: "testPrivateKey",
        inputMint: "inputMint123",
        outputMint: "outputMint123",
        amountSwap: 50,
        network: "mainnet" as const,
      };

      const requestBody = solanaSwapTool.request.body!(params);

      expect(requestBody).toEqual({
        privateKey: "testPrivateKey",
        privateKeyFormat: "auto",
        inputMint: "inputMint123",
        outputMint: "outputMint123",
        amount: 50,
        slippageBps: 50, // default value
        network: "mainnet",
      });
    });
  });

  describe("Solana Accounts Tool", () => {
    it("should have correct tool configuration", () => {
      expect(solanaAccountsTool.id).toBe("solana_accounts");
      expect(solanaAccountsTool.name).toBe("Solana Token Accounts");
      expect(solanaAccountsTool.description).toContain("SOL balance");
      expect(solanaAccountsTool.version).toBe("1.0.0");
    });

    it("should require walletAddress parameter", () => {
      const params = solanaAccountsTool.params;

      expect(params.walletAddress).toBeDefined();
      expect(params.walletAddress.required).toBe(true);
      expect(params.walletAddress.requiredForToolCall).toBe(true);

      // Network parameter should no longer exist
      expect(params.network).toBeUndefined();

      // privateKey should not be a parameter anymore
      expect(params.privateKey).toBeUndefined();
    });

    it("should construct request body correctly", () => {
      const params = {
        walletAddress: "testWallet123",
      };

      const requestBody = solanaAccountsTool.request.body!(params);

      expect(requestBody).toEqual({
        walletAddress: "testWallet123",
      });
    });

    it("should throw error when walletAddress is not provided", () => {
      const params = {
        walletAddress: undefined as any,
      };

      expect(() => {
        solanaAccountsTool.request.body!(params);
      }).toThrow("walletAddress must be provided");
    });
  });

  describe("Solana Price Tool", () => {
    it("should have correct tool configuration", () => {
      expect(solanaPriceTool.id).toBe("solana_price");
      expect(solanaPriceTool.name).toBe("Solana Token Price");
      expect(solanaPriceTool.description).toContain("market prices");
      expect(solanaPriceTool.version).toBe("1.0.0");
    });

    it("should have required parameters defined", () => {
      const params = solanaPriceTool.params;

      expect(params.tokenMints).toBeDefined();
      expect(params.tokenMints.required).toBe(true);
      expect(params.tokenMints.requiredForToolCall).toBe(true);

      // vsCurrency parameter should no longer exist (Jupiter only supports USD)
      expect(params.vsCurrency).toBeUndefined();
    });

    it("should construct request body correctly", () => {
      const params = {
        tokenMints: ["mint1", "mint2", "mint3"],
      };

      const requestBody = solanaPriceTool.request.body!(params);

      expect(requestBody).toEqual({
        tokenMints: ["mint1", "mint2", "mint3"],
      });
    });

    it("should throw error for empty tokenMints array", () => {
      const params = {
        tokenMints: [],
      };

      expect(() => {
        solanaPriceTool.request.body!(params);
      }).toThrow("tokenMints must be a non-empty array");
    });

    it("should throw error for non-array tokenMints", () => {
      const params = {
        tokenMints: "not-an-array" as any,
      };

      expect(() => {
        solanaPriceTool.request.body!(params);
      }).toThrow("tokenMints must be a non-empty array");
    });
  });

  describe("Tool Request Configuration", () => {
    it("should have correct request configuration for all tools", () => {
      const tools = [
        solanaTransferTool,
        solanaSwapTool,
        solanaAccountsTool,
        solanaPriceTool,
      ];

      tools.forEach((tool) => {
        expect(tool.request.method).toBe("POST");
        expect(tool.request.isInternalRoute).toBe(true);
        expect(tool.request.headers).toBeTypeOf("function");
        expect(tool.request.body).toBeTypeOf("function");

        // Test headers function
        const headers = tool.request.headers({} as any);
        expect(headers["Content-Type"]).toBe("application/json");
      });
    });

    it("should have correct API endpoints", () => {
      expect(solanaTransferTool.request.url).toBe("/api/solana/transfer");
      expect(solanaSwapTool.request.url).toBe("/api/solana/swap");
      expect(solanaAccountsTool.request.url).toBe("/api/solana/accounts");
      expect(solanaPriceTool.request.url).toBe("/api/solana/price");
    });
  });
});
