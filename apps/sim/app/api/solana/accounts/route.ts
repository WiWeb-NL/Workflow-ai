import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getAssociatedTokenAddress, getAccount } from "@solana/spl-token";
import { createLogger } from "@/lib/logs/console-logger";

const logger = createLogger("SolanaAccountsAPI");

// Request schema
const AccountsRequestSchema = z.object({
  walletAddress: z.string().min(1, "Wallet address is required"),
});

// Get mainnet RPC endpoint
function getRpcEndpoint(): string {
  return process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
}

// Get token metadata from Jupiter (simplified)
async function getTokenMetadata(mintAddress: string) {
  try {
    const response = await fetch(`https://tokens.jup.ag/token/${mintAddress}`);
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    logger.warn("Failed to fetch token metadata", { mintAddress, error });
  }
  return null;
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    const body = await req.json();

    // Validate request body
    const validatedData = AccountsRequestSchema.parse(body);
    const { walletAddress } = validatedData;

    logger.info(`[${requestId}] Fetching account information`, {
      walletAddress,
    });

    // Create connection
    const connection = new Connection(getRpcEndpoint(), "confirmed");

    // Create wallet public key
    let walletPublicKey: PublicKey;
    try {
      walletPublicKey = new PublicKey(walletAddress);
    } catch (error) {
      logger.warn(`[${requestId}] Invalid wallet address`, { walletAddress });
      return NextResponse.json(
        { error: "Invalid wallet address" },
        { status: 400 }
      );
    }

    const finalWalletAddress = walletPublicKey.toBase58();

    // Get SOL balance
    logger.info(`[${requestId}] Fetching SOL balance`);
    const solBalance = await connection.getBalance(walletPublicKey);
    const solBalanceInSol = solBalance / LAMPORTS_PER_SOL;

    // Get all token accounts
    logger.info(`[${requestId}] Fetching token accounts`);
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      walletPublicKey,
      {
        programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"), // SPL Token program
      }
    );

    // Process token accounts
    const processedTokenAccounts = [];
    let totalValueUsd = 0;

    for (const accountInfo of tokenAccounts.value) {
      const parsedInfo = accountInfo.account.data.parsed.info;
      const mintAddress = parsedInfo.mint;
      const tokenAmount = parsedInfo.tokenAmount;

      // Skip accounts with zero balance
      if (parseFloat(tokenAmount.amount) === 0) {
        continue;
      }

      const tokenAccount = {
        address: accountInfo.pubkey.toBase58(),
        mint: mintAddress,
        owner: parsedInfo.owner,
        amount: tokenAmount.amount,
        decimals: tokenAmount.decimals,
        uiAmount: tokenAmount.uiAmount,
        uiAmountString: tokenAmount.uiAmountString,
      };

      processedTokenAccounts.push(tokenAccount);

      // Try to get token metadata and price (optional)
      try {
        const metadata = await getTokenMetadata(mintAddress);
        if (metadata?.price) {
          totalValueUsd += (tokenAmount.uiAmount || 0) * metadata.price;
        }
      } catch (error) {
        // Ignore metadata/price errors
      }
    }

    logger.info(`[${requestId}] Successfully fetched account information`, {
      walletAddress: finalWalletAddress,
      solBalance: solBalanceInSol,
      tokenAccountsCount: processedTokenAccounts.length,
    });

    return NextResponse.json({
      walletAddress: finalWalletAddress,
      solBalance: solBalanceInSol,
      tokenAccounts: processedTokenAccounts,
      totalValueUsd: totalValueUsd > 0 ? totalValueUsd : undefined,
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

    logger.error(`[${requestId}] Failed to fetch account information`, error);

    if (error.message?.includes("Invalid private key")) {
      return NextResponse.json(
        { error: "Invalid private key provided" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch account information" },
      { status: 500 }
    );
  }
}
