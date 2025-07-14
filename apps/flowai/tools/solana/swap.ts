import type { ToolConfig } from "../types";
import type { SolanaSwapParams, SolanaSwapResponse } from "./types";
import { createLogger } from "@/lib/logs/console-logger";

const logger = createLogger("SolanaSwapTool");

export const solanaSwapTool: ToolConfig<SolanaSwapParams, SolanaSwapResponse> =
  {
    id: "solana_swap",
    name: "Solana Token Swap",
    description:
      "Swap tokens on Solana using Jupiter aggregator for best prices",
    version: "1.0.0",

    params: {
      privateKey: {
        type: "string",
        required: true,
        description:
          "Private key of the wallet performing the swap (supports Base64, Base58, or number array formats)",
      },
      privateKeyFormat: {
        type: "string",
        required: false,
        description:
          "Format of the private key: 'base64', 'base58', 'array', or 'auto' for auto-detection (default: auto)",
      },
      inputMint: {
        type: "string",
        required: true,
        requiredForToolCall: true,
        description: "Input token mint address (token being sold)",
      },
      outputMint: {
        type: "string",
        required: true,
        requiredForToolCall: true,
        description: "Output token mint address (token being bought)",
      },
      amountSwap: {
        type: "number",
        required: true,
        requiredForToolCall: true,
        description: "Amount of input tokens to swap (in token units, not raw)",
      },
      slippageBps: {
        type: "number",
        required: false,
        description: "Maximum slippage in basis points (default: 50 = 0.5%)",
      },
      priorityFee: {
        type: "number",
        required: false,
        description:
          "Priority fee in micro lamports for faster transaction processing",
      },
      computeUnitLimit: {
        type: "number",
        required: false,
        description: "Compute unit limit for the transaction",
      },
      dynamicComputeUnitLimit: {
        type: "boolean",
        required: false,
        description: "Whether to use dynamic compute unit limit calculation",
      },
      network: {
        type: "string",
        required: false,
        description: "Solana network to use (mainnet, devnet, testnet)",
      },
    },

    request: {
      url: "/api/solana/swap",
      method: "POST",
      headers: () => ({
        "Content-Type": "application/json",
      }),
      body: (params) => {
        logger.info("Swap request parameters:", {
          inputMint: params.inputMint,
          outputMint: params.outputMint,
          amountSwap: params.amountSwap,
          slippageBps: params.slippageBps || 50,
          network: params.network || "mainnet",
          hasPrivateKey: !!params.privateKey,
          priorityFee: params.priorityFee,
        });

        return {
          privateKey: params.privateKey,
          privateKeyFormat: params.privateKeyFormat || "auto",
          inputMint: params.inputMint,
          outputMint: params.outputMint,
          amountSwap: params.amountSwap,
          slippageBps: params.slippageBps || 50,
          ...(params.priorityFee && { priorityFee: params.priorityFee }),
          ...(params.computeUnitLimit && {
            computeUnitLimit: params.computeUnitLimit,
          }),
          ...(params.dynamicComputeUnitLimit !== undefined && {
            dynamicComputeUnitLimit: params.dynamicComputeUnitLimit,
          }),
          network: params.network || "mainnet",
        };
      },
      isInternalRoute: true,
    },

    transformResponse: async (response): Promise<SolanaSwapResponse> => {
      logger.info("Received swap response status:", response.status);

      try {
        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error || `Swap failed with status ${response.status}`
          );
        }

        logger.info("Token swap successful:", {
          signature: result.transaction?.signature,
          inputMint: result.inputMint,
          outputMint: result.outputMint,
          inputAmount: result.inputAmount,
          outputAmount: result.outputAmount,
          priceImpactPct: result.priceImpactPct,
        });

        return {
          success: true,
          output: result,
        };
      } catch (error: any) {
        logger.error("Error parsing swap response:", error);
        throw new Error(error.message || "Failed to parse swap response");
      }
    },

    transformError: (error: any) => {
      logger.error("Swap error occurred:", error);

      if (error.message?.includes("insufficient funds")) {
        return "Insufficient input token balance to complete the swap";
      }
      if (error.message?.includes("slippage")) {
        return "Swap failed due to high slippage. Try increasing slippage tolerance or reducing amount.";
      }
      if (error.message?.includes("no route found")) {
        return "No swap route found between the specified tokens";
      }
      if (error.message?.includes("invalid mint")) {
        return "Invalid input or output token mint address";
      }
      if (error.message?.includes("private key")) {
        return "Invalid private key provided";
      }

      return error.message || "Token swap failed due to an unexpected error";
    },
  };
