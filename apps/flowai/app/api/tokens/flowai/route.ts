import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { FlowAITokenService } from "@/lib/flowai-tokens";
import { solanaPaymentService } from "@/lib/solana/payment";
import { walletManager } from "@/lib/solana/wallet-manager";
import { jupiterPriceService } from "@/lib/jupiter/price-service";
import { createLogger } from "@/lib/logs/console-logger";
import crypto from "crypto";

const logger = createLogger("FlowAITokensAPI");
const flowaiTokenService = new FlowAITokenService();

export const dynamic = "force-dynamic";

/**
 * GET /api/tokens/flowai
 * Get user's FlowAI token balance and transaction history
 */
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    // Get the session
    const session = await getSession();
    if (!session?.user?.id) {
      logger.warn(`[${requestId}] Unauthorized token balance request`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const includeTransactions = searchParams.get("transactions") === "true";
    const limit = parseInt(searchParams.get("limit") || "50");

    // Get token balance
    const balance = await flowaiTokenService.getUserTokenBalance(userId);

    const response: any = {
      balance: balance.balance,
      lastUpdated: balance.lastUpdated,
    };

    // Get transaction history if requested
    if (includeTransactions) {
      const transactions = await flowaiTokenService.getUserTransactionHistory(
        userId,
        limit
      );
      response.transactions = transactions;
    }

    // Get spending statistics
    const stats = await flowaiTokenService.getSpendingStats(userId);
    response.stats = stats;

    logger.debug(
      `[${requestId}] Retrieved FlowAI token data for user ${userId}`,
      {
        balance: balance.balance,
        includeTransactions,
        transactionCount: includeTransactions
          ? response.transactions?.length
          : 0,
      }
    );

    return NextResponse.json(response);
  } catch (error: any) {
    logger.error(`[${requestId}] Error retrieving FlowAI token data:`, error);
    return NextResponse.json(
      { error: error.message || "Failed to retrieve token data" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tokens/flowai
 * Purchase FlowAI tokens (initiate payment process)
 */
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    // Get the session
    const session = await getSession();
    if (!session?.user?.id) {
      logger.warn(`[${requestId}] Unauthorized token purchase request`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case "get_pricing":
        // Get available token pricing tiers with real-time SOL pricing
        const pricing = await flowaiTokenService.getTokenPricing();
        const solPriceData = await jupiterPriceService.getSOLPrice();

        const solPriceInfo = {
          currentPrice: solPriceData.usdPrice,
          priceChange24h: solPriceData.priceChange24h,
          lastUpdated: solPriceData.lastUpdated.toISOString(),
        };

        logger.debug(
          `[${requestId}] Retrieved token pricing for user ${userId}`,
          {
            tierCount: pricing.length,
            solPrice: solPriceData.usdPrice,
          }
        );

        return NextResponse.json({ pricing, solPriceInfo });

      case "get_wallet":
        // Get user's Solana wallet info for purchases
        const wallet = await walletManager.getUserWallet(userId);

        if (!wallet) {
          logger.warn(
            `[${requestId}] No Solana wallet found for user ${userId}`
          );
          return NextResponse.json(
            { error: "No Solana wallet found" },
            { status: 404 }
          );
        }

        // Get wallet balances
        const solBalance = await solanaPaymentService.getSOLBalance(
          wallet.address
        );
        const flowaiBalance = await solanaPaymentService.getFlowAITokenBalance(
          wallet.address
        );

        logger.debug(
          `[${requestId}] Retrieved Solana wallet for user ${userId}`,
          {
            address: wallet.address,
            hasPrivateKey: wallet.hasPrivateKey,
            solBalance,
            flowaiBalance,
          }
        );

        return NextResponse.json({
          wallet: {
            ...wallet,
            solBalance,
            flowaiTokenBalance: flowaiBalance,
          },
        });

      case "create_wallet":
        // Create new Solana wallet for user
        const createResult = await walletManager.createWallet(userId);

        if (!createResult.success) {
          return NextResponse.json(
            { error: createResult.error },
            { status: 400 }
          );
        }

        logger.info(`[${requestId}] Created wallet for user ${userId}`, {
          address: createResult.wallet?.address,
        });

        return NextResponse.json({
          success: true,
          wallet: createResult.wallet,
        });

      case "import_wallet":
        // Import wallet from private key
        const { privateKey } = data;

        if (!privateKey) {
          return NextResponse.json(
            { error: "Private key is required" },
            { status: 400 }
          );
        }

        const importResult = await walletManager.importWallet(
          userId,
          privateKey
        );

        if (!importResult.success) {
          return NextResponse.json(
            { error: importResult.error },
            { status: 400 }
          );
        }

        logger.info(`[${requestId}] Imported wallet for user ${userId}`, {
          address: importResult.wallet?.address,
        });

        return NextResponse.json({
          success: true,
          wallet: importResult.wallet,
        });

      case "export_private_key":
        // Export user's private key (use with extreme caution)
        const { format = "array" } = data;
        const exportResult = await walletManager.exportPrivateKey(
          userId,
          format
        );

        if (!exportResult.success) {
          return NextResponse.json(
            { error: exportResult.error || "Failed to export private key" },
            { status: 404 }
          );
        }

        logger.warn(
          `[${requestId}] Private key exported for user ${userId} in ${format} format`
        );

        return NextResponse.json({
          success: true,
          privateKey: exportResult.privateKey,
          format,
        });

      case "delete_wallet":
        // Delete user's wallet
        const deleteResult = await walletManager.deleteWallet(userId);

        if (!deleteResult) {
          return NextResponse.json(
            { error: "Failed to delete wallet" },
            { status: 500 }
          );
        }

        logger.info(`[${requestId}] Deleted wallet for user ${userId}`);

        return NextResponse.json({
          success: true,
          message: "Wallet deleted successfully",
        });

      case "fix_wallet":
        // Fix corrupted wallet
        const fixResult = await walletManager.fixCorruptedWallet(userId);

        if (!fixResult.success) {
          return NextResponse.json(
            { error: fixResult.error || "Failed to fix wallet" },
            { status: 500 }
          );
        }

        logger.info(
          `[${requestId}] Fixed corrupted wallet for user ${userId}`,
          {
            newAddress: fixResult.wallet?.address,
          }
        );

        return NextResponse.json({
          success: true,
          message: "Wallet fixed successfully",
          wallet: {
            address: fixResult.wallet?.address,
            hasPrivateKey: true,
          },
        });

      case "purchase_tokens":
        // Purchase tokens with SOL or FlowAI tokens
        const {
          paymentCurrency, // "SOL" | "FLOWAI_TOKEN"
          paymentAmount,
          pricingTierId,
        } = data;

        if (
          !paymentCurrency ||
          !["SOL", "FLOWAI_TOKEN"].includes(paymentCurrency)
        ) {
          return NextResponse.json(
            { error: "Invalid payment currency" },
            { status: 400 }
          );
        }

        if (!paymentAmount || paymentAmount <= 0) {
          return NextResponse.json(
            { error: "Invalid payment amount" },
            { status: 400 }
          );
        }

        let tierDetails: {
          id: string;
          tokenAmount: number;
          solPrice: number;
          usdEquivalent: number;
          bonusTokens: number;
          totalTokens: number;
        };

        if (pricingTierId && pricingTierId !== "custom") {
          // Get predefined pricing tier details
          const tier =
            await flowaiTokenService.getPricingTierDetails(pricingTierId);
          if (!tier) {
            logger.error(
              `[${requestId}] Invalid pricing tier requested: ${pricingTierId}`
            );
            return NextResponse.json(
              {
                error: `Invalid pricing tier: ${pricingTierId}. Please refresh and try again.`,
              },
              { status: 400 }
            );
          }
          tierDetails = tier;

          // Validate payment amount matches tier price
          let expectedAmount: number;

          if (paymentCurrency === "SOL") {
            expectedAmount = tierDetails.solPrice;
          } else {
            // For FLOWAI_TOKEN, calculate how many FlowAI tokens needed for the credits
            const solPriceData = await jupiterPriceService.getSOLPrice();
            const creditsPerSol = solPriceData.usdPrice / 0.1; // How many credits per SOL
            const flowaiTokensPerCredit = 3000000 / creditsPerSol; // FlowAI tokens needed per credit
            expectedAmount = Math.floor(
              tierDetails.tokenAmount * flowaiTokensPerCredit
            );
          }

          // Use more lenient tolerance for different currencies
          const tolerance = paymentCurrency === "SOL" ? 0.001 : 100; // 100 token tolerance for FLOWAI_TOKEN

          if (Math.abs(paymentAmount - expectedAmount) > tolerance) {
            logger.error(
              `[${requestId}] Payment amount mismatch for user ${userId}`,
              {
                paymentAmount,
                expectedAmount,
                paymentCurrency,
                tierDetails,
                difference: paymentAmount - expectedAmount,
                flowaiTokensNeeded:
                  paymentCurrency === "FLOWAI_TOKEN" ? expectedAmount : "N/A",
              }
            );
            return NextResponse.json(
              {
                error: `Payment amount ${paymentAmount} does not match expected ${expectedAmount} for ${paymentCurrency}`,
              },
              { status: 400 }
            );
          }
        } else {
          // Handle custom purchase (no specific pricing tier)
          if (paymentCurrency === "SOL") {
            // For SOL payments: convert SOL to USD then to credits at $0.10 per credit
            const solPriceData = await jupiterPriceService.getSOLPrice();
            const usdValue = paymentAmount * solPriceData.usdPrice;
            const tokenAmount = Math.floor(usdValue / 0.1); // $0.10 per credit

            tierDetails = {
              id: "custom",
              tokenAmount,
              solPrice: paymentAmount,
              usdEquivalent: usdValue,
              bonusTokens: 0,
              totalTokens: tokenAmount,
            };
          } else {
            // For FlowAI token payment: Convert FlowAI tokens to credits
            // 1 SOL = 3,000,000 FlowAI tokens, and credits cost $0.10 each
            const solPriceData = await jupiterPriceService.getSOLPrice();
            const creditsPerSol = solPriceData.usdPrice / 0.1; // How many credits per SOL
            const flowaiTokensPerCredit = 3000000 / creditsPerSol; // FlowAI tokens needed per credit

            const tokenAmount = Math.floor(
              paymentAmount / flowaiTokensPerCredit
            ); // Credits from FlowAI tokens
            const usdValue = tokenAmount * 0.1; // $0.10 per credit

            tierDetails = {
              id: "custom",
              tokenAmount,
              solPrice: usdValue / solPriceData.usdPrice, // Convert USD to SOL
              usdEquivalent: usdValue,
              bonusTokens: 0,
              totalTokens: tokenAmount,
            };
          }
        }

        // Get user's wallet and private key
        const userWallet = await walletManager.getUserWallet(userId);
        let userPrivateKey = await walletManager.getUserPrivateKey(userId);

        if (!userWallet || !userPrivateKey) {
          return NextResponse.json(
            {
              error: "No wallet found. Please create or import a wallet first.",
            },
            { status: 400 }
          );
        }

        // Process payment with wallet validation and auto-repair
        let paymentResult: {
          success: boolean;
          signature?: string;
          error?: string;
        };

        try {
          paymentResult =
            paymentCurrency === "SOL"
              ? await solanaPaymentService.processSOLPayment({
                  amount: paymentAmount,
                  currency: "SOL",
                  description: `Purchase ${tierDetails.totalTokens} FlowAI tokens`,
                  fromWalletAddress: userWallet.address,
                  fromPrivateKey: userPrivateKey,
                  tokenAmount: tierDetails.totalTokens, // Pass token amount for marketing wallet transfer
                })
              : await solanaPaymentService.processSPLPayment({
                  amount: paymentAmount,
                  currency: "FLOWAI_TOKEN",
                  description: `Purchase ${tierDetails.totalTokens} FlowAI tokens with FlowAI tokens`,
                  fromWalletAddress: userWallet.address,
                  fromPrivateKey: userPrivateKey,
                });
        } catch (paymentError) {
          // If payment fails due to private key issues, try to fix the wallet
          if (
            paymentError instanceof Error &&
            paymentError.message.includes("Invalid private key")
          ) {
            logger.warn(
              `[${requestId}] Payment failed due to private key issue, attempting wallet repair`,
              {
                userId,
                error: paymentError.message,
              }
            );

            const validationResult =
              await walletManager.validateAndRepairWallet(userId);

            if (validationResult.fixed) {
              logger.info(
                `[${requestId}] Wallet repaired successfully, retrying payment`,
                { userId }
              );

              // Get the new private key and retry payment
              const newPrivateKey =
                await walletManager.getUserPrivateKey(userId);
              if (newPrivateKey) {
                paymentResult =
                  paymentCurrency === "SOL"
                    ? await solanaPaymentService.processSOLPayment({
                        amount: paymentAmount,
                        currency: "SOL",
                        description: `Purchase ${tierDetails.totalTokens} FlowAI tokens`,
                        fromWalletAddress: userWallet.address,
                        fromPrivateKey: newPrivateKey,
                        tokenAmount: tierDetails.totalTokens, // Pass token amount for marketing wallet transfer
                      })
                    : await solanaPaymentService.processSPLPayment({
                        amount: paymentAmount,
                        currency: "FLOWAI_TOKEN",
                        description: `Purchase ${tierDetails.totalTokens} FlowAI tokens with FlowAI tokens`,
                        fromWalletAddress: userWallet.address,
                        fromPrivateKey: newPrivateKey,
                      });
              } else {
                paymentResult = {
                  success: false,
                  error: "Wallet repair failed",
                };
              }
            } else {
              paymentResult = {
                success: false,
                error: `Wallet validation failed: ${validationResult.error}`,
              };
            }
          } else {
            throw paymentError; // Re-throw non-wallet-related errors
          }
        }

        if (!paymentResult.success) {
          logger.error(
            `[${requestId}] Payment failed for user ${userId}:`,
            paymentResult.error
          );
          return NextResponse.json(
            { error: `Payment failed: ${paymentResult.error}` },
            { status: 400 }
          );
        }

        // Add tokens to user's balance (total tokens including bonus)
        await flowaiTokenService.addTokens(
          userId,
          tierDetails.totalTokens,
          paymentResult.signature,
          `Purchased with ${paymentAmount} ${paymentCurrency} (${pricingTierId})`
        );

        logger.info(
          `[${requestId}] Token purchase successful for user ${userId}`,
          {
            totalTokens: tierDetails.totalTokens,
            baseTokens: tierDetails.tokenAmount,
            bonusTokens: tierDetails.bonusTokens,
            paymentCurrency,
            paymentAmount,
            signature: paymentResult.signature,
          }
        );

        return NextResponse.json({
          success: true,
          message: `Successfully purchased ${tierDetails.totalTokens} FlowAI tokens`,
          transactionSignature: paymentResult.signature,
        });

      case "add_tokens":
        // Manually add tokens (for testing or administrative purposes)
        const { amount, description, transactionSignature } = data;

        if (!amount || amount <= 0) {
          return NextResponse.json(
            { error: "Invalid token amount" },
            { status: 400 }
          );
        }

        await flowaiTokenService.addTokens(
          userId,
          amount,
          transactionSignature,
          description || "Manual token addition"
        );

        logger.info(`[${requestId}] Added ${amount} tokens to user ${userId}`, {
          amount,
          description,
          transactionSignature,
        });

        return NextResponse.json({
          success: true,
          message: `Added ${amount} FlowAI tokens to your account`,
        });

      case "refund_tokens":
        // Refund tokens (for failed executions, etc.)
        const { refundAmount, reason, originalTransactionId } = data;

        if (!refundAmount || refundAmount <= 0) {
          return NextResponse.json(
            { error: "Invalid refund amount" },
            { status: 400 }
          );
        }

        await flowaiTokenService.refundTokens(
          userId,
          refundAmount,
          reason || "Token refund",
          originalTransactionId
        );

        logger.info(
          `[${requestId}] Refunded ${refundAmount} tokens to user ${userId}`,
          {
            refundAmount,
            reason,
            originalTransactionId,
          }
        );

        return NextResponse.json({
          success: true,
          message: `Refunded ${refundAmount} FlowAI tokens to your account`,
        });

      default:
        logger.warn(`[${requestId}] Unknown action: ${action}`);
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error: any) {
    logger.error(`[${requestId}] Error in FlowAI token operation:`, error);
    return NextResponse.json(
      { error: error.message || "Token operation failed" },
      { status: 500 }
    );
  }
}
