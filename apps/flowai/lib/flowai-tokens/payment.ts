import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createTransferInstruction,
  getOrCreateAssociatedTokenAccount,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { flowaiTokenService, FLOWAI_TOKEN_MINT } from "./index";
import { db } from "@/db";
import { flowaiTokenPricing } from "@/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

interface PurchaseTokensParams {
  userId: string;
  pricingTierId: string;
  userWalletAddress: string;
  userSignedTransaction: string; // Base64 encoded signed transaction
}

interface PurchaseResult {
  success: boolean;
  transactionSignature?: string;
  tokensAdded?: number;
  error?: string;
}

interface TokenPurchaseIntent {
  id: string;
  userId: string;
  tokenAmount: number;
  bonusTokens: number;
  totalTokens: number;
  solanaPriceLamports: bigint;
  recipientAddress: string;
  expiresAt: Date;
}

export class SolanaPaymentService {
  private connection: Connection;
  private treasuryWallet: PublicKey;

  constructor(rpcUrl?: string, treasuryAddress?: string) {
    this.connection = new Connection(
      rpcUrl ||
        process.env.SOLANA_RPC_URL ||
        "https://api.mainnet-beta.solana.com"
    );

    this.treasuryWallet = new PublicKey(
      treasuryAddress ||
        process.env.FLOWAI_TREASURY_WALLET ||
        "11111111111111111111111111111112"
    );
  }

  /**
   * Create a payment transaction for token purchase
   */
  async createTokenPurchaseTransaction(
    userId: string,
    pricingTierId: string,
    userWalletAddress: string
  ): Promise<{
    transaction: Transaction;
    purchaseIntent: TokenPurchaseIntent;
  }> {
    // Get pricing info
    const pricing = await db.query.flowaiTokenPricing.findFirst({
      where: eq(flowaiTokenPricing.id, pricingTierId),
    });

    if (!pricing || !pricing.isActive) {
      throw new Error("Invalid or inactive pricing tier");
    }

    const userWallet = new PublicKey(userWalletAddress);
    const solanaPriceLamports = BigInt(pricing.solanaPriceLamports);

    // Create purchase intent
    const purchaseIntent: TokenPurchaseIntent = {
      id: crypto.randomUUID(),
      userId,
      tokenAmount: pricing.tokenAmount,
      bonusTokens: pricing.bonusTokens,
      totalTokens: pricing.tokenAmount + pricing.bonusTokens,
      solanaPriceLamports,
      recipientAddress: userWalletAddress,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
    };

    // Create transaction for SOL payment to treasury
    const transaction = new Transaction();

    // Add SOL transfer to treasury
    const transferInstruction = SystemProgram.transfer({
      fromPubkey: userWallet,
      toPubkey: this.treasuryWallet,
      lamports: Number(solanaPriceLamports),
    });

    transaction.add(transferInstruction);

    // Get recent blockhash
    const { blockhash } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = userWallet;

    return {
      transaction,
      purchaseIntent,
    };
  }

  /**
   * Process a completed token purchase
   */
  async procesTokenPurchase(
    params: PurchaseTokensParams
  ): Promise<PurchaseResult> {
    try {
      // Verify the transaction was sent and successful
      const transaction = Transaction.from(
        Buffer.from(params.userSignedTransaction, "base64")
      );

      // Send transaction to Solana
      const signature = await this.connection.sendRawTransaction(
        transaction.serialize(),
        {
          skipPreflight: false,
          preflightCommitment: "processed",
        }
      );

      // Wait for confirmation
      const confirmation = await this.connection.confirmTransaction(
        signature,
        "confirmed"
      );

      if (confirmation.value.err) {
        return {
          success: false,
          error: `Transaction failed: ${confirmation.value.err}`,
        };
      }

      // Get pricing details
      const pricing = await db.query.flowaiTokenPricing.findFirst({
        where: eq(flowaiTokenPricing.id, params.pricingTierId),
      });

      if (!pricing) {
        return {
          success: false,
          error: "Pricing tier not found",
        };
      }

      const totalTokens = pricing.tokenAmount + pricing.bonusTokens;

      // Add tokens to user's balance
      await flowaiTokenService.addTokens(
        params.userId,
        totalTokens,
        signature,
        `Purchased ${pricing.tokenAmount} tokens${pricing.bonusTokens > 0 ? ` + ${pricing.bonusTokens} bonus` : ""}`
      );

      return {
        success: true,
        transactionSignature: signature,
        tokensAdded: totalTokens,
      };
    } catch (error) {
      console.error("Token purchase processing failed:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Transfer FlowAI tokens from treasury to user (for completed purchases)
   */
  async transferFlowAITokens(
    userWalletAddress: string,
    amount: number,
    treasuryPrivateKey: string
  ): Promise<string> {
    const userWallet = new PublicKey(userWalletAddress);

    // Get or create user's FlowAI token account
    const userTokenAccount = await getOrCreateAssociatedTokenAccount(
      this.connection,
      // This would need the treasury's keypair for signing
      null as any, // Placeholder - would need actual keypair
      FLOWAI_TOKEN_MINT,
      userWallet,
      false,
      "confirmed",
      undefined,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    // Get treasury's FlowAI token account
    const treasuryTokenAccount = await getOrCreateAssociatedTokenAccount(
      this.connection,
      null as any, // Placeholder - would need actual keypair
      FLOWAI_TOKEN_MINT,
      this.treasuryWallet,
      false,
      "confirmed",
      undefined,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    // Create transfer instruction
    const transferInstruction = createTransferInstruction(
      treasuryTokenAccount.address,
      userTokenAccount.address,
      this.treasuryWallet,
      amount,
      [],
      TOKEN_2022_PROGRAM_ID
    );

    const transaction = new Transaction().add(transferInstruction);
    const { blockhash } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = this.treasuryWallet;

    // This would need to be signed with the treasury private key
    // For now, we'll simulate this as the token balance is managed in our database
    const simulatedSignature = `flowai_transfer_${crypto.randomUUID()}`;

    return simulatedSignature;
  }

  /**
   * Verify a Solana transaction exists and was successful
   */
  async verifyTransaction(signature: string): Promise<{
    exists: boolean;
    success: boolean;
    amount?: number;
    from?: string;
    to?: string;
  }> {
    try {
      const transaction = await this.connection.getTransaction(signature, {
        commitment: "confirmed",
      });

      if (!transaction) {
        return { exists: false, success: false };
      }

      const success = transaction.meta?.err === null;

      // Parse transaction details
      let amount: number | undefined;
      let from: string | undefined;
      let to: string | undefined;

      if (transaction.transaction.message.instructions.length > 0) {
        // This is a simplified check - in reality you'd parse the instruction data
        const instruction = transaction.transaction.message.instructions[0];

        if (transaction.meta?.preBalances && transaction.meta?.postBalances) {
          // Calculate SOL transfer amount
          const balanceChange =
            transaction.meta.preBalances[0] - transaction.meta.postBalances[0];
          amount = balanceChange;
        }

        // Get account keys
        const accountKeys = transaction.transaction.message.accountKeys;
        from = accountKeys[0]?.toBase58();
        to = accountKeys[1]?.toBase58();
      }

      return {
        exists: true,
        success,
        amount,
        from,
        to,
      };
    } catch (error) {
      console.error("Error verifying transaction:", error);
      return { exists: false, success: false };
    }
  }

  /**
   * Get current SOL price in USD (for pricing calculations)
   */
  async getCurrentSOLPrice(): Promise<number> {
    try {
      // This would typically call a price API like CoinGecko
      // For now, we'll return a placeholder
      return 100; // $100 per SOL as example
    } catch (error) {
      console.error("Failed to get SOL price:", error);
      return 100; // Default fallback
    }
  }

  /**
   * Calculate token pricing in lamports based on USD equivalent
   */
  async calculateTokenPricing(usdAmount: number): Promise<bigint> {
    const solPrice = await this.getCurrentSOLPrice();
    const solAmount = usdAmount / solPrice;
    return BigInt(Math.round(solAmount * LAMPORTS_PER_SOL));
  }

  /**
   * Update token pricing based on current market rates
   */
  async updateTokenPricing(): Promise<void> {
    const solPrice = await this.getCurrentSOLPrice();

    // Define standard pricing tiers
    const pricingTiers = [
      { tokens: 100, usd: 10, bonus: 0 },
      { tokens: 500, usd: 40, bonus: 50 }, // 10% bonus
      { tokens: 1000, usd: 75, bonus: 150 }, // 15% bonus
      { tokens: 5000, usd: 350, bonus: 1000 }, // 20% bonus
    ];

    for (const tier of pricingTiers) {
      const solanaPriceLamports = await this.calculateTokenPricing(tier.usd);

      await db.insert(flowaiTokenPricing).values({
        id: crypto.randomUUID(),
        tokenAmount: tier.tokens,
        solanaPriceLamports: solanaPriceLamports.toString(),
        usdEquivalent: tier.usd.toString(),
        bonusTokens: tier.bonus,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  /**
   * Get wallet balance in SOL
   */
  async getWalletSOLBalance(walletAddress: string): Promise<number> {
    try {
      const publicKey = new PublicKey(walletAddress);
      const balance = await this.connection.getBalance(publicKey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      console.error("Failed to get wallet balance:", error);
      return 0;
    }
  }
}

// Export singleton instance
export const solanaPaymentService = new SolanaPaymentService();
