import type { ToolConfig } from "../types";
import type { SolanaAccountsParams, SolanaAccountsResponse } from "./types";
import { createLogger } from "@/lib/logs/console-logger";

const logger = createLogger("SolanaAccountsTool");

export const solanaAccountsTool: ToolConfig<
  SolanaAccountsParams,
  SolanaAccountsResponse
> = {
  id: "solana_accounts",
  name: "Solana Token Accounts",
  description: "Get SOL balance and all SPL token accounts for a Solana wallet",
  version: "1.0.0",

  params: {
    walletAddress: {
      type: "string",
      required: true,
      requiredForToolCall: true,
      description: "Solana wallet address to check",
    },
  },

  request: {
    url: "/api/solana/accounts",
    method: "POST",
    headers: () => ({
      "Content-Type": "application/json",
    }),
    body: (params) => {
      if (!params.walletAddress) {
        throw new Error("walletAddress must be provided");
      }

      logger.info("Accounts request parameters:", {
        walletAddress: params.walletAddress,
      });

      return {
        walletAddress: params.walletAddress,
      };
    },
    isInternalRoute: true,
  },

  transformResponse: async (response): Promise<SolanaAccountsResponse> => {
    logger.info("Received accounts response status:", response.status);

    try {
      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            `Failed to fetch accounts with status ${response.status}`
        );
      }

      logger.info("Successfully fetched accounts:", {
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
      logger.error("Error parsing accounts response:", error);
      throw new Error(error.message || "Failed to parse accounts response");
    }
  },

  transformError: (error: any) => {
    logger.error("Accounts error occurred:", error);

    if (error.message?.includes("invalid address")) {
      return "Invalid wallet address provided";
    }
    if (error.message?.includes("private key")) {
      return "Invalid private key provided";
    }
    if (error.message?.includes("network")) {
      return "Network connection error. Please try again.";
    }

    return (
      error.message ||
      "Failed to fetch account information due to an unexpected error"
    );
  },
};
