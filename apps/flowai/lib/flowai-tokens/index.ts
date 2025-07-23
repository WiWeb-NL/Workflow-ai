import { db } from "@/db";
import {
  flowaiTokenTransactions,
  flowaiTokenPricing,
  userStats,
  userSolanaWallets,
} from "@/db/schema";
import { eq, desc, sql, and, gte } from "drizzle-orm";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import crypto from "crypto";
import { createLogger } from "@/lib/logs/console-logger";
import { jupiterPriceService } from "@/lib/jupiter/price-service";

const logger = createLogger("FlowAI-Tokens");

// FlowAI Token Configuration
export const FLOWAI_TOKEN_MINT = new PublicKey(
  "FpVBzhuQhY3uT1ijxwHRob4NjXQzbcpg1FsgNNTwwBLV"
);
export const WORKFLOW_EXECUTION_COST = 1; // 1 FlowAI token per execution

interface TokenBalance {
  balance: number;
  lastUpdated: Date;
}

interface TokenTransaction {
  id: string;
  type: "purchase" | "spend" | "refund" | "bonus";
  amount: number;
  balanceAfter: number;
  description?: string;
  solanaTransactionSignature?: string;
  workflowExecutionId?: string;
  createdAt: Date;
}

export class FlowAITokenService {
  private connection: Connection;

  constructor(rpcUrl?: string) {
    this.connection = new Connection(
      rpcUrl ||
        process.env.SOLANA_RPC_URL ||
        "https://api.mainnet-beta.solana.com"
    );
  }

  /**
   * Get user's current FlowAI token balance
   */
  async getUserTokenBalance(userId: string): Promise<TokenBalance> {
    const stats = await db.query.userStats.findFirst({
      where: eq(userStats.userId, userId),
    });

    return {
      balance: stats?.flowaiTokenBalance || 0,
      lastUpdated: stats?.lastActive || new Date(0), // Use epoch instead of current date
    };
  }

  /**
   * Get user's transaction history
   */
  async getUserTransactionHistory(
    userId: string,
    limit: number = 50
  ): Promise<TokenTransaction[]> {
    const transactions = await db.query.flowaiTokenTransactions.findMany({
      where: eq(flowaiTokenTransactions.userId, userId),
      orderBy: desc(flowaiTokenTransactions.createdAt),
      limit,
    });

    return transactions.map((tx) => ({
      id: tx.id,
      type: tx.transactionType as TokenTransaction["type"],
      amount: tx.amount,
      balanceAfter: tx.balanceAfter,
      description: tx.description || undefined,
      solanaTransactionSignature: tx.solanaTransactionSignature || undefined,
      workflowExecutionId: tx.workflowExecutionId || undefined,
      createdAt: tx.createdAt, // Keep as Date object for interface compatibility
    }));
  }

  /**
   * Add tokens to user's balance (for purchases)
   */
  async addTokens(
    userId: string,
    amount: number,
    solanaTransactionSignature?: string,
    description?: string
  ): Promise<void> {
    await db.transaction(async (tx) => {
      // Get current balance
      const currentStats = await tx.query.userStats.findFirst({
        where: eq(userStats.userId, userId),
      });

      const currentBalance = currentStats?.flowaiTokenBalance || 0;
      const newBalance = currentBalance + amount;

      // Update user stats
      if (currentStats) {
        await tx
          .update(userStats)
          .set({
            flowaiTokenBalance: newBalance,
            lastActive: sql`now()`,
          })
          .where(eq(userStats.userId, userId));
      } else {
        await tx.insert(userStats).values({
          id: crypto.randomUUID(),
          userId,
          flowaiTokenBalance: newBalance,
          totalFlowaiTokensSpent: 0,
          currentPeriodTokensSpent: 0,
        });
      }

      // Record transaction
      await tx.insert(flowaiTokenTransactions).values({
        id: crypto.randomUUID(),
        userId,
        transactionType: "purchase",
        amount,
        balanceAfter: newBalance,
        description,
        solanaTransactionSignature,
      });
    });
  }

  /**
   * Spend tokens (for workflow executions)
   */
  async spendTokens(
    userId: string,
    amount: number,
    workflowExecutionId?: string,
    description?: string
  ): Promise<boolean> {
    try {
      console.log("FlowAI Token Service: Attempting to spend tokens", {
        userId,
        amount,
        workflowExecutionId,
        description,
      });

      await db.transaction(async (tx) => {
        // Get current balance
        const currentStats = await tx.query.userStats.findFirst({
          where: eq(userStats.userId, userId),
        });

        if (!currentStats) {
          console.error("FlowAI Token Service: User stats not found", {
            userId,
          });
          throw new Error("User stats not found");
        }

        const currentBalance = currentStats.flowaiTokenBalance || 0;

        console.log("FlowAI Token Service: Current balance check", {
          userId,
          currentBalance,
          amountToSpend: amount,
          hasEnough: currentBalance >= amount,
        });

        if (currentBalance < amount) {
          console.error("FlowAI Token Service: Insufficient token balance", {
            userId,
            currentBalance,
            required: amount,
          });
          throw new Error("Insufficient token balance");
        }

        const newBalance = currentBalance - amount;
        const totalSpent = (currentStats.totalFlowaiTokensSpent || 0) + amount;
        const periodSpent =
          (currentStats.currentPeriodTokensSpent || 0) + amount;

        console.log("FlowAI Token Service: Updating balances", {
          userId,
          oldBalance: currentBalance,
          newBalance,
          totalSpent,
          periodSpent,
        });

        // Update user stats
        await tx
          .update(userStats)
          .set({
            flowaiTokenBalance: newBalance,
            totalFlowaiTokensSpent: totalSpent,
            currentPeriodTokensSpent: periodSpent,
            lastActive: sql`now()`,
          })
          .where(eq(userStats.userId, userId));

        // Record transaction
        await tx.insert(flowaiTokenTransactions).values({
          id: crypto.randomUUID(),
          userId,
          transactionType: "spend",
          amount: -amount, // negative for spending
          balanceAfter: newBalance,
          description:
            description || `Workflow execution cost: ${amount} tokens`,
          workflowExecutionId,
        });

        console.log(
          "FlowAI Token Service: Transaction completed successfully",
          {
            userId,
            newBalance,
            workflowExecutionId,
          }
        );
      });

      return true;
    } catch (error) {
      console.error("Failed to spend tokens:", error);
      return false;
    }
  }

  /**
   * Check if user has sufficient balance for workflow execution
   */
  async canExecuteWorkflow(userId: string): Promise<boolean> {
    const balance = await this.getUserTokenBalance(userId);
    return balance.balance >= WORKFLOW_EXECUTION_COST;
  }

  /**
   * Charge user for workflow execution
   */
  async chargeForWorkflowExecution(
    userId: string,
    workflowExecutionId: string
  ): Promise<boolean> {
    return await this.spendTokens(
      userId,
      WORKFLOW_EXECUTION_COST,
      workflowExecutionId,
      "Workflow execution"
    );
  }

  /**
   * Get current token pricing options with real-time SOL pricing
   */
  async getTokenPricing(): Promise<
    Array<{
      id: string;
      tokenAmount: number;
      solPrice: number; // Price in SOL units
      usdEquivalent: number;
      bonusTokens: number;
      totalTokens: number;
    }>
  > {
    try {
      // First try to get pricing from database
      const pricing = await db.query.flowaiTokenPricing.findMany({
        where: eq(flowaiTokenPricing.isActive, true),
        orderBy: flowaiTokenPricing.tokenAmount,
      });

      if (pricing.length > 0) {
        // Use database pricing but update SOL prices with real-time data
        const solPriceData = await jupiterPriceService.getSOLPrice();

        return pricing.map((p) => ({
          id: p.id,
          tokenAmount: p.tokenAmount,
          solPrice: parseFloat(p.usdEquivalent || "0") / solPriceData.usdPrice, // Convert USD to SOL
          usdEquivalent: parseFloat(p.usdEquivalent || "0"),
          bonusTokens: p.bonusTokens,
          totalTokens: p.tokenAmount + p.bonusTokens,
        }));
      }

      // If no database pricing, use Jupiter dynamic pricing
      logger.warn(
        "No pricing tiers found in database, using dynamic Jupiter pricing"
      );
      const dynamicPricing = await jupiterPriceService.getFormattedPricing();
      return dynamicPricing;
    } catch (error) {
      logger.error("Failed to get real-time pricing, using fallback", error);

      // Ultimate fallback to static pricing
      const fallbackPricing = [
        {
          id: "starter_100",
          tokenAmount: 100,
          solPrice: 0.054,
          usdEquivalent: 10.0,
          bonusTokens: 0,
          totalTokens: 100,
        },
        {
          id: "basic_500",
          tokenAmount: 500,
          solPrice: 0.243,
          usdEquivalent: 45.0,
          bonusTokens: 50,
          totalTokens: 550,
        },
        {
          id: "pro_1000",
          tokenAmount: 1000,
          solPrice: 0.459,
          usdEquivalent: 85.0,
          bonusTokens: 150,
          totalTokens: 1150,
        },
        {
          id: "enterprise_5000",
          tokenAmount: 5000,
          solPrice: 2.162,
          usdEquivalent: 400.0,
          bonusTokens: 1000,
          totalTokens: 6000,
        },
      ];

      logger.warn("Using static fallback pricing due to API errors");
      return fallbackPricing;
    }
  }

  /**
   * Get specific pricing tier details
   */
  async getPricingTierDetails(pricingTierId: string): Promise<{
    id: string;
    tokenAmount: number;
    solPrice: number;
    usdEquivalent: number;
    bonusTokens: number;
    totalTokens: number;
  } | null> {
    const pricing = await db.query.flowaiTokenPricing.findFirst({
      where: eq(flowaiTokenPricing.id, pricingTierId),
    });

    if (pricing && pricing.isActive) {
      return {
        id: pricing.id,
        tokenAmount: pricing.tokenAmount,
        solPrice: Number(pricing.solanaPriceLamports) / 1_000_000_000,
        usdEquivalent: parseFloat(pricing.usdEquivalent || "0"),
        bonusTokens: pricing.bonusTokens,
        totalTokens: pricing.tokenAmount + pricing.bonusTokens,
      };
    }

    // If not found in database, check default pricing
    const defaultPricingMap: Record<
      string,
      {
        id: string;
        tokenAmount: number;
        solPrice: number;
        usdEquivalent: number;
        bonusTokens: number;
        totalTokens: number;
      }
    > = {
      starter_100: {
        id: "starter_100",
        tokenAmount: 100,
        solPrice: 0.054,
        usdEquivalent: 10.0,
        bonusTokens: 0,
        totalTokens: 100,
      },
      basic_500: {
        id: "basic_500",
        tokenAmount: 500,
        solPrice: 0.27,
        usdEquivalent: 50.0,
        bonusTokens: 50,
        totalTokens: 550,
      },
      pro_1000: {
        id: "pro_1000",
        tokenAmount: 1000,
        solPrice: 0.54,
        usdEquivalent: 100.0,
        bonusTokens: 150,
        totalTokens: 1150,
      },
      enterprise_5000: {
        id: "enterprise_5000",
        tokenAmount: 5000,
        solPrice: 2.16,
        usdEquivalent: 400.0,
        bonusTokens: 1000,
        totalTokens: 6000,
      },
    };

    const defaultTier = defaultPricingMap[pricingTierId];
    if (defaultTier) {
      logger.warn(`Using default pricing tier: ${pricingTierId}`);
      return defaultTier;
    }

    return null;
  }

  /**
   * Get user's Solana wallet for token purchases
   */
  async getUserSolanaWallet(userId: string): Promise<{
    address: string;
    hasPrivateKey: boolean;
  } | null> {
    // Use only the user_solana_wallets table (no fallback)
    const solanaWallet = await db.query.userSolanaWallets.findFirst({
      where: eq(userSolanaWallets.userId, userId),
    });

    if (solanaWallet) {
      return {
        address: solanaWallet.walletAddress,
        hasPrivateKey: !!solanaWallet.encryptedPrivateKey,
      };
    }

    return null;
  }

  /**
   * Get FlowAI token account for user's wallet
   */
  async getUserTokenAccount(
    userWalletAddress: string,
    tokenProgram?: PublicKey
  ): Promise<PublicKey> {
    const userWallet = new PublicKey(userWalletAddress);
    return await getAssociatedTokenAddress(
      FLOWAI_TOKEN_MINT,
      userWallet,
      false,
      tokenProgram || TOKEN_PROGRAM_ID // Default to legacy program
    );
  }

  /**
   * Check FlowAI token balance on Solana for verification
   */
  async getOnChainTokenBalance(userWalletAddress: string): Promise<number> {
    try {
      // Try both token programs (Legacy Token Program first, then Token-2022)
      const tokenPrograms = [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID];

      for (const tokenProgram of tokenPrograms) {
        try {
          const tokenAccount = await this.getUserTokenAccount(
            userWalletAddress,
            tokenProgram
          );
          const accountInfo =
            await this.connection.getTokenAccountBalance(tokenAccount);

          if (accountInfo.value) {
            console.log(
              `Found FlowAI token balance using ${tokenProgram === TOKEN_2022_PROGRAM_ID ? "Token-2022" : "Token Program"}:`,
              accountInfo.value.amount
            );
            // FlowAI tokens have 9 decimals, convert raw amount to human-readable
            const FLOWAI_TOKEN_DECIMALS = 9;
            const rawAmount = parseInt(accountInfo.value.amount);
            const humanReadableAmount =
              rawAmount / Math.pow(10, FLOWAI_TOKEN_DECIMALS);
            return humanReadableAmount;
          }
        } catch (error) {
          // Continue to next program if account not found
          console.debug(
            `Token account not found with ${tokenProgram === TOKEN_2022_PROGRAM_ID ? "Token-2022" : "Token Program"}`
          );
          continue;
        }
      }

      return 0;
    } catch (error) {
      console.error("Failed to get on-chain token balance:", error);
      return 0;
    }
  }

  /**
   * Refund tokens to user (for failed executions, etc.)
   */
  async refundTokens(
    userId: string,
    amount: number,
    reason: string,
    originalTransactionId?: string
  ): Promise<void> {
    await db.transaction(async (tx) => {
      // Get current balance
      const currentStats = await tx.query.userStats.findFirst({
        where: eq(userStats.userId, userId),
      });

      if (!currentStats) {
        throw new Error("User stats not found");
      }

      const currentBalance = currentStats.flowaiTokenBalance || 0;
      const newBalance = currentBalance + amount;
      const totalSpent = Math.max(
        0,
        (currentStats.totalFlowaiTokensSpent || 0) - amount
      );
      const periodSpent = Math.max(
        0,
        (currentStats.currentPeriodTokensSpent || 0) - amount
      );

      // Update user stats
      await tx
        .update(userStats)
        .set({
          flowaiTokenBalance: newBalance,
          totalFlowaiTokensSpent: totalSpent,
          currentPeriodTokensSpent: periodSpent,
          lastActive: sql`now()`,
        })
        .where(eq(userStats.userId, userId));

      // Record transaction
      await tx.insert(flowaiTokenTransactions).values({
        id: crypto.randomUUID(),
        userId,
        transactionType: "refund",
        amount,
        balanceAfter: newBalance,
        description: `Refund: ${reason}`,
        metadata: originalTransactionId ? { originalTransactionId } : {},
      });
    });
  }

  /**
   * Reset current period token spending (for billing period resets)
   */
  async resetPeriodSpending(userId: string): Promise<void> {
    await db
      .update(userStats)
      .set({
        currentPeriodTokensSpent: 0,
        lastActive: sql`now()`,
      })
      .where(eq(userStats.userId, userId));
  }

  /**
   * Get aggregate spending statistics
   */
  async getSpendingStats(userId: string): Promise<{
    totalSpent: number;
    currentPeriodSpent: number;
    averageDaily: number;
    lastExecution: Date | null;
  }> {
    const stats = await db.query.userStats.findFirst({
      where: eq(userStats.userId, userId),
    });

    const lastExecution = await db.query.flowaiTokenTransactions.findFirst({
      where: (table, { eq, and }) =>
        and(eq(table.userId, userId), eq(table.transactionType, "spend")),
      orderBy: desc(flowaiTokenTransactions.createdAt),
    });

    // Calculate average daily spending over last 30 days
    const recentSpending = await db.query.flowaiTokenTransactions.findMany({
      where: (table, { eq, and, gte }) =>
        and(
          eq(table.userId, userId),
          eq(table.transactionType, "spend"),
          gte(table.createdAt, sql`now() - interval '30 days'`)
        ),
    });

    const totalRecentSpent = recentSpending.reduce(
      (sum, tx) => sum + Math.abs(tx.amount),
      0
    );
    const averageDaily = totalRecentSpent / 30;

    return {
      totalSpent: stats?.totalFlowaiTokensSpent || 0,
      currentPeriodSpent: stats?.currentPeriodTokensSpent || 0,
      averageDaily,
      lastExecution: lastExecution?.createdAt || null,
    };
  }
}

// Export singleton instance
export const flowaiTokenService = new FlowAITokenService();
