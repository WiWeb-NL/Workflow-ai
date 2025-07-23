import { createLogger } from "@/lib/logs/console-logger";

const logger = createLogger("Jupiter-Price-Service");

// SOL mint address
const SOL_MINT = "So11111111111111111111111111111111111111112";

interface JupiterPriceResponse {
  [mintAddress: string]: {
    usdPrice: number;
    blockId: number;
    decimals: number;
    priceChange24h: number;
  };
}

interface PriceData {
  usdPrice: number;
  priceChange24h: number;
  lastUpdated: Date;
}

export class JupiterPriceService {
  private cachedSOLPrice: PriceData | null = null;
  private cacheValidityMs = 30000; // 30 seconds cache

  /**
   * Get real-time SOL price from Jupiter API
   */
  async getSOLPrice(): Promise<PriceData> {
    // Return cached price if still valid
    if (
      this.cachedSOLPrice &&
      Date.now() - this.cachedSOLPrice.lastUpdated.getTime() <
        this.cacheValidityMs
    ) {
      return this.cachedSOLPrice;
    }

    try {
      const response = await fetch(
        `https://lite-api.jup.ag/price/v3?ids=${SOL_MINT}`,
        {
          headers: {
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Jupiter API error: ${response.status}`);
      }

      const data: JupiterPriceResponse = await response.json();
      const solData = data[SOL_MINT];

      if (!solData) {
        throw new Error("SOL price not found in Jupiter response");
      }

      const priceData: PriceData = {
        usdPrice: solData.usdPrice,
        priceChange24h: solData.priceChange24h,
        lastUpdated: new Date(),
      };

      // Cache the price
      this.cachedSOLPrice = priceData;

      logger.info("SOL price updated from Jupiter", {
        usdPrice: priceData.usdPrice,
        priceChange24h: priceData.priceChange24h,
        blockId: solData.blockId,
      });

      return priceData;
    } catch (error) {
      logger.error("Failed to fetch SOL price from Jupiter", error);

      // Return fallback price if cache exists but is stale
      if (this.cachedSOLPrice) {
        logger.warn("Using stale cached SOL price due to API error");
        return this.cachedSOLPrice;
      }

      // Ultimate fallback
      return {
        usdPrice: 185, // Fallback to $185
        priceChange24h: 0,
        lastUpdated: new Date(),
      };
    }
  }

  /**
   * Calculate dynamic pricing based on real-time SOL price
   * Base cost per credit: $0.10
   */
  async getDynamicPricing() {
    const solPrice = await this.getSOLPrice();
    const costPerCredit = 0.1; // $0.10 per credit

    const pricing = [
      {
        id: "starter_100",
        name: "Starter Pack",
        tokenAmount: 100,
        usdPrice: 100 * costPerCredit, // $10
        solPrice: (100 * costPerCredit) / solPrice.usdPrice,
        bonusTokens: 0,
      },
      {
        id: "basic_500",
        name: "Basic Pack",
        tokenAmount: 500,
        usdPrice: 500 * costPerCredit * 0.9, // $45 (10% discount)
        solPrice: (500 * costPerCredit * 0.9) / solPrice.usdPrice,
        bonusTokens: 50,
        popular: true,
      },
      {
        id: "pro_1000",
        name: "Pro Pack",
        tokenAmount: 1000,
        usdPrice: 1000 * costPerCredit * 0.85, // $85 (15% discount)
        solPrice: (1000 * costPerCredit * 0.85) / solPrice.usdPrice,
        bonusTokens: 150,
      },
      {
        id: "enterprise_5000",
        name: "Enterprise Pack",
        tokenAmount: 5000,
        usdPrice: 5000 * costPerCredit * 0.8, // $400 (20% discount)
        solPrice: (5000 * costPerCredit * 0.8) / solPrice.usdPrice,
        bonusTokens: 1000,
      },
    ];

    return {
      pricing,
      solPriceInfo: {
        currentPrice: solPrice.usdPrice,
        priceChange24h: solPrice.priceChange24h,
        lastUpdated: solPrice.lastUpdated,
      },
    };
  }

  /**
   * Get formatted pricing for API responses
   */
  async getFormattedPricing() {
    const { pricing, solPriceInfo } = await this.getDynamicPricing();

    return pricing.map((tier) => ({
      id: tier.id,
      tokenAmount: tier.tokenAmount,
      solPrice: Number(tier.solPrice.toFixed(6)), // Round to 6 decimals
      usdEquivalent: Number(tier.usdPrice.toFixed(2)),
      bonusTokens: tier.bonusTokens,
      totalTokens: tier.tokenAmount + tier.bonusTokens,
      popular: tier.popular,
    }));
  }
}

// Export singleton instance
export const jupiterPriceService = new JupiterPriceService();
