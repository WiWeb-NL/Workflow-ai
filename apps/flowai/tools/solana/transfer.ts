import type { ToolConfig } from "../types";
import type { SolanaTransferParams, SolanaTransferResponse } from "./types";
import { createLogger } from "@/lib/logs/console-logger";

const logger = createLogger("SolanaTransferTool");

export const solanaTransferTool: ToolConfig<
  SolanaTransferParams,
  SolanaTransferResponse
> = {
  id: "solana_transfer",
  name: "Solana Token Transfer",
  description: "Transfer SPL tokens to another Solana wallet address",
  version: "1.0.0",

  params: {
    privateKey: {
      type: "string",
      required: true,
      description:
        "Private key of the sender wallet (supports Base64, Base58, or number array formats)",
    },
    privateKeyFormat: {
      type: "string",
      required: false,
      description:
        "Format of the private key: 'base64', 'base58', 'array', or 'auto' for auto-detection (default: auto)",
    },
    recipientAddress: {
      type: "string",
      required: true,
      requiredForToolCall: true,
      description: "Solana wallet address of the recipient",
    },
    tokenMint: {
      type: "string",
      required: true,
      requiredForToolCall: true,
      description: "SPL token mint address to transfer",
    },
    amount: {
      type: "number",
      required: true,
      requiredForToolCall: true,
      description: "Amount of tokens to transfer (in token units, not raw)",
    },
    decimals: {
      type: "number",
      required: false,
      description: "Token decimals (will be auto-detected if not provided)",
    },
    memo: {
      type: "string",
      required: false,
      description: "Optional memo for the transaction",
    },
    network: {
      type: "string",
      required: false,
      description: "Solana network to use (mainnet, devnet, testnet)",
    },
  },

  request: {
    url: "/api/solana/transfer",
    method: "POST",
    headers: () => ({
      "Content-Type": "application/json",
    }),
    body: (params) => {
      logger.info("Transfer request parameters:", {
        recipientAddress: params.recipientAddress,
        tokenMint: params.tokenMint,
        amount: params.amount,
        network: params.network || "mainnet",
        hasPrivateKey: !!params.privateKey,
        hasMemo: !!params.memo,
      });

      return {
        privateKey: params.privateKey,
        privateKeyFormat: params.privateKeyFormat || "auto",
        recipientAddress: params.recipientAddress,
        tokenMint: params.tokenMint,
        amount: params.amount,
        ...(params.decimals && { decimals: params.decimals }),
        ...(params.memo && { memo: params.memo }),
        network: params.network || "mainnet",
      };
    },
    isInternalRoute: true,
  },

  transformResponse: async (response): Promise<SolanaTransferResponse> => {
    logger.info("Received transfer response status:", response.status);

    try {
      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || `Transfer failed with status ${response.status}`
        );
      }

      logger.info("Token transfer successful:", {
        signature: result.transaction?.signature,
        fromAddress: result.fromAddress,
        toAddress: result.toAddress,
        tokenMint: result.tokenMint,
        uiAmount: result.uiAmount,
      });

      return {
        success: true,
        output: result,
      };
    } catch (error: any) {
      logger.error("Error parsing transfer response:", error);
      throw new Error(error.message || "Failed to parse transfer response");
    }
  },

  transformError: (error: any) => {
    logger.error("Transfer error occurred:", error);

    if (error.message?.includes("insufficient funds")) {
      return "Insufficient token balance to complete the transfer";
    }
    if (error.message?.includes("invalid recipient")) {
      return "Invalid recipient wallet address";
    }
    if (error.message?.includes("invalid mint")) {
      return "Invalid or non-existent token mint address";
    }
    if (error.message?.includes("private key")) {
      return "Invalid private key provided";
    }

    return error.message || "Token transfer failed due to an unexpected error";
  },
};
