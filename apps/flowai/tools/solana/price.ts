import type { ToolConfig } from "../types";
import type { SolanaPriceParams, SolanaPriceResponse } from "./types";
import { createLogger } from "@/lib/logs/console-logger";

const logger = createLogger("SolanaPriceTool");

export const solanaPriceTool: ToolConfig<
  SolanaPriceParams,
  SolanaPriceResponse
> = {
  id: "solana_price",
  name: "Solana Token Price",
  description: "Get current market prices for Solana tokens",
  version: "1.0.0",

  params: {
    tokenMints: {
      type: "array",
      required: true,
      requiredForToolCall: true,
      description: "Array of SPL token mint addresses to get prices for",
    },
  },

  request: {
    url: "/api/solana/price",
    method: "POST",
    headers: () => ({
      "Content-Type": "application/json",
    }),
    body: (params) => {
      if (!Array.isArray(params.tokenMints) || params.tokenMints.length === 0) {
        throw new Error("tokenMints must be a non-empty array");
      }

      logger.info("Price request parameters:", {
        tokenMints: params.tokenMints,
        mintCount: params.tokenMints.length,
      });

      return {
        tokenMints: params.tokenMints,
      };
    },
    isInternalRoute: true,
  },

  transformResponse: async (response): Promise<SolanaPriceResponse> => {
    logger.info("Received price response status:", response.status);

    try {
      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            `Failed to fetch prices with status ${response.status}`
        );
      }

      logger.info("Successfully fetched prices:", {
        priceCount: Object.keys(result.prices || {}).length,
        currency: result.prices
          ? (Object.values(result.prices)[0] as any)?.currency
          : "unknown",
      });

      return {
        success: true,
        output: result,
      };
    } catch (error: any) {
      logger.error("Error parsing price response:", error);
      throw new Error(error.message || "Failed to parse price response");
    }
  },

  transformError: (error: any) => {
    logger.error("Price error occurred:", error);

    if (error.message?.includes("invalid mint")) {
      return "One or more token mint addresses are invalid";
    }
    if (error.message?.includes("not found")) {
      return "Price data not available for one or more tokens";
    }
    if (error.message?.includes("rate limit")) {
      return "Price API rate limit exceeded. Please try again later.";
    }

    return (
      error.message || "Failed to fetch token prices due to an unexpected error"
    );
  },
};
