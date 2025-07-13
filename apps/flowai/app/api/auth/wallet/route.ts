import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createLogger } from "@/lib/logs/console-logger";
import {
  createUserSolanaWallet,
  getUserWalletAddress,
} from "@/lib/solana/wallet-storage";

export const dynamic = "force-dynamic";

const logger = createLogger("CreateWalletAPI");

/**
 * Create a Solana wallet for the current user
 */
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8);
  let userId: string | undefined;

  try {
    // Get the session
    const session = await getSession();

    // Check if the user is authenticated
    if (!session?.user?.id) {
      logger.warn(`[${requestId}] Unauthenticated request rejected`);
      return NextResponse.json(
        { error: "User not authenticated" },
        { status: 401 }
      );
    }

    userId = session.user.id;

    // Check if user already has a wallet
    const existingWallet = await getUserWalletAddress(session.user.id);
    if (existingWallet) {
      logger.info(`[${requestId}] User already has a wallet`, {
        userId: session.user.id,
        walletAddress: existingWallet,
      });
      return NextResponse.json(
        {
          walletAddress: existingWallet,
          message: "User already has a wallet",
        },
        { status: 200 }
      );
    }

    // Create a new wallet
    const walletData = await createUserSolanaWallet(session.user.id);

    logger.info(`[${requestId}] Created new wallet for user`, {
      userId: session.user.id,
      walletAddress: walletData.walletAddress,
    });

    return NextResponse.json(
      {
        walletAddress: walletData.walletAddress,
        message: "Wallet created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error(`[${requestId}] Error creating wallet`, {
      error,
      userId,
    });
    return NextResponse.json(
      {
        error: "Failed to create wallet",
      },
      { status: 500 }
    );
  }
}

/**
 * Get the current user's wallet information
 */
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8);
  let userId: string | undefined;

  try {
    // Get the session
    const session = await getSession();

    // Check if the user is authenticated
    if (!session?.user?.id) {
      logger.warn(`[${requestId}] Unauthenticated request rejected`);
      return NextResponse.json(
        { error: "User not authenticated" },
        { status: 401 }
      );
    }

    userId = session.user.id;

    // Get user's wallet address
    const walletAddress = await getUserWalletAddress(session.user.id);

    return NextResponse.json(
      {
        walletAddress,
        hasWallet: !!walletAddress,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error(`[${requestId}] Error fetching wallet`, {
      error,
      userId,
    });
    return NextResponse.json(
      {
        error: "Failed to fetch wallet information",
      },
      { status: 500 }
    );
  }
}
