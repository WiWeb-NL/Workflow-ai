import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createLogger } from "@/lib/logs/console-logger";

const logger = createLogger("SolanaPriceAPI");

// Request schema - handle both string arrays and table objects
const PriceRequestSchema = z.object({
  tokenMints: z.array(z.any()).min(1, "At least one token mint is required"),
});

// Extract mint addresses from various input formats
function extractMintAddresses(tokenMints: any[]): string[] {
  return tokenMints
    .map((item) => {
      // Handle string directly
      if (typeof item === "string") return item.trim();

      // Handle table object with cells
      if (typeof item === "object" && item !== null) {
        if (item.cells && typeof item.cells === "object") {
          return (
            item.cells["Token Mint Address"] ||
            item.cells.tokenMintAddress ||
            item.cells.mint ||
            Object.values(item.cells)[0]
          );
        }
        // Handle direct object structure
        return (
          item["Token Mint Address"] ||
          item.tokenMintAddress ||
          item.mint ||
          item[0] ||
          Object.values(item)[0]
        );
      }
      return String(item).trim();
    })
    .filter(Boolean)
    .filter((mint) => mint && mint.length > 20) // Basic validation for Solana addresses
    .slice(0, 50); // Limit to prevent abuse
}

// Get token prices from Jupiter
async function getTokenPricesFromJupiter(tokenMints: string[]) {
  try {
    // Jupiter V3 API allows up to 50 tokens at once
    const ids = tokenMints.slice(0, 50).join(",");
    const response = await fetch(`https://lite-api.jup.ag/price/v3?ids=${ids}`);

    if (!response.ok) {
      throw new Error(`Jupiter API error: ${response.status}`);
    }

    const data = await response.json();

    const prices: Record<string, any> = {};
    for (const mint of tokenMints) {
      const tokenData = data[mint];
      if (tokenData && tokenData.usdPrice) {
        prices[mint] = {
          usd: tokenData.usdPrice,
          last_updated_at: Math.floor(Date.now() / 1000),
        };
      }
    }

    return prices;
  } catch (error) {
    logger.error("Failed to fetch prices from Jupiter", error);
    throw error;
  }
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    const body = await req.json();

    // Validate request body
    const validatedData = PriceRequestSchema.parse(body);
    const { tokenMints: rawTokenMints } = validatedData;

    // Extract mint addresses from the input
    const tokenMints = extractMintAddresses(rawTokenMints);

    if (tokenMints.length === 0) {
      return NextResponse.json(
        { error: "No valid token mint addresses found" },
        { status: 400 }
      );
    }

    logger.info(`[${requestId}] Fetching token prices`, {
      tokenMints,
      mintCount: tokenMints.length,
    });

    let priceData: Record<string, any> = {};

    // Use Jupiter for price data
    try {
      priceData = await getTokenPricesFromJupiter(tokenMints);
      logger.info(`[${requestId}] Successfully fetched prices from Jupiter`);
    } catch (jupiterError) {
      logger.error(`[${requestId}] Jupiter API failed`, {
        jupiterError,
      });
      return NextResponse.json(
        { error: "Failed to fetch token prices from Jupiter" },
        { status: 500 }
      );
    }

    // Transform the response to match our interface
    const prices: Record<string, any> = {};

    for (const mint of tokenMints) {
      const tokenData = priceData[mint.toLowerCase()] || priceData[mint];

      if (tokenData) {
        prices[mint] = {
          price: tokenData.usd || 0,
          currency: "usd",
          lastUpdated: tokenData.last_updated_at
            ? new Date(tokenData.last_updated_at * 1000).toISOString()
            : new Date().toISOString(),
        };
      } else {
        // Return null/zero price for tokens without data
        prices[mint] = {
          price: 0,
          currency: "usd",
          lastUpdated: new Date().toISOString(),
        };
      }
    }

    const successfulPrices = Object.values(prices).filter(
      (p) => p.price > 0
    ).length;

    logger.info(`[${requestId}] Successfully processed token prices`, {
      totalRequested: tokenMints.length,
      successfulPrices,
      currency: "usd",
    });

    return NextResponse.json({
      prices,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      logger.warn(`[${requestId}] Invalid request data`, {
        errors: error.errors,
      });
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    logger.error(`[${requestId}] Failed to fetch token prices`, error);

    if (error.message?.includes("rate limit")) {
      return NextResponse.json(
        { error: "Price API rate limit exceeded. Please try again later." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch token prices" },
      { status: 500 }
    );
  }
}
