import type { ToolConfig } from "../types";
import type { SolanaAccountsParams, SolanaAccountsResponse } from "./types";
import { createLogger } from "@/lib/logs/console-logger";

const logger = createLogger("SolanaBalanceTool");

export const solanaBalanceTool: ToolConfig<
  SolanaAccountsParams,
  SolanaAccountsResponse
> = {
  id: "solana_balance",
  name: "Solana Balance",
  description: "Get SOL balance and token accounts for a Solana wallet",
  version: "1.0.0",

  params: {
    walletAddress: {
      type: "string",
      required: true,
      requiredForToolCall: true,
      description: "Solana wallet address to check balance",
    },
  },

  request: {
    url: "/api/solana/accounts",
    method: "POST",
    headers: () => ({
      "Content-Type": "application/json",
    }),
    body: (params) => {
      logger.info("Balance request for wallet:", {
        walletAddress: params.walletAddress,
      });

      return {
        walletAddress: params.walletAddress,
      };
    },
    isInternalRoute: true,
  },

  transformResponse: async (response): Promise<SolanaAccountsResponse> => {
    logger.info("Received balance response status:", response.status);

    try {
      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            `Failed to fetch balance with status ${response.status}`
        );
      }

      logger.info("Successfully fetched wallet balance:", {
        walletAddress: result.walletAddress,
        solBalance: result.solBalance,
        tokenAccountsCount: result.tokenAccounts?.length || 0,
        totalValueUsd: result.totalValueUsd,
      });

      return {
        success: true,
        output: result,
      };
    } catch (error: any) {
      logger.error("Error parsing balance response:", error);
      throw new Error(error.message || "Failed to parse balance response");
    }
  },

  transformError: (error: any) => {
    logger.error("Balance error occurred:", error);

    if (error.message?.includes("invalid address")) {
      return "Invalid wallet address provided";
    }
    if (error.message?.includes("network")) {
      return "Network connection error. Please try again.";
    }

    return (
      error.message ||
      "Failed to fetch wallet balance due to an unexpected error"
    );
  },
};
