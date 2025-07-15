import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Connection, VersionedTransaction } from "@solana/web3.js";
import { createKeypairFromPrivateKey } from "@/lib/solana/wallet-generator";
import { createLogger } from "@/lib/logs/console-logger";

const logger = createLogger("SolanaSwapAPI");

// Request schema - ONLY uses amountSwap for swap operations
const SwapRequestSchema = z.object({
  privateKey: z.union([
    z.string().min(1, "Private key is required"),
    z.array(z.number()).length(64, "Private key array must be 64 bytes"),
  ]),
  privateKeyFormat: z
    .enum(["base64", "base58", "array", "auto"])
    .default("auto"),
  inputMint: z.string().min(1, "Input mint is required"),
  outputMint: z.string().min(1, "Output mint is required"),
  amountSwap: z.union([
    z.number().positive("AmountSwap must be positive"),
    z.string().min(1, "AmountSwap is required"),
  ]),
  slippageBps: z.number().min(1).max(10000).default(50),
  priorityFee: z.number().optional(),
  computeUnitLimit: z.number().optional(),
  dynamicComputeUnitLimit: z.boolean().default(false),
  network: z.enum(["mainnet", "devnet", "testnet"]).default("mainnet"),
});

// Get RPC endpoint based on network
function getRpcEndpoint(network: string): string {
  switch (network) {
    case "mainnet":
      return (
        process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com"
      );
    case "devnet":
      return "https://api.devnet.solana.com";
    case "testnet":
      return "https://api.testnet.solana.com";
    default:
      return "https://api.mainnet-beta.solana.com";
  }
}

// Get Jupiter Ultra API URL based on network
function getJupiterApiUrl(network: string): string {
  // Jupiter Ultra API mainly operates on mainnet
  return network === "mainnet"
    ? "https://lite-api.jup.ag/ultra/v1"
    : "https://lite-api.jup.ag/ultra/v1";
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    const body = await req.json();

    // Debug: Log the raw request body with enhanced details
    logger.info(`[${requestId}] Raw request body:`, {
      privateKey: typeof body.privateKey,
      privateKeyLength: Array.isArray(body.privateKey)
        ? body.privateKey.length
        : "N/A",
      privateKeyFormat: body.privateKeyFormat,
      amountSwap: body.amountSwap,
      amountSwapType: typeof body.amountSwap,
      inputMint: body.inputMint,
      outputMint: body.outputMint,
      slippageBps: body.slippageBps,
      network: body.network,
      allFields: Object.keys(body),
      fullBody: body, // Log the entire body to see all fields
    });

    // Special handling for SOL (native token) amounts
    const isInputSol =
      body.inputMint === "So11111111111111111111111111111111111111112";
    const isOutputSol =
      body.outputMint === "So11111111111111111111111111111111111111112";

    logger.info(`[${requestId}] Token analysis:`, {
      inputMint: body.inputMint,
      outputMint: body.outputMint,
      isInputSol,
      isOutputSol,
      swapDirection: isInputSol
        ? "SOL -> SPL"
        : isOutputSol
          ? "SPL -> SOL"
          : "SPL -> SPL",
    });

    // Pre-process private key if it's a string representation of an array
    if (
      typeof body.privateKey === "string" &&
      body.privateKey.startsWith("[")
    ) {
      try {
        body.privateKey = JSON.parse(body.privateKey);
        logger.info(
          `[${requestId}] Converted string array to actual array, length: ${body.privateKey.length}`
        );
      } catch (error) {
        logger.error(
          `[${requestId}] Failed to parse privateKey array string: ${error}`
        );
        return NextResponse.json(
          {
            error: "Invalid private key format. Could not parse array string.",
          },
          { status: 400 }
        );
      }
    }

    // CRITICAL: For swap operations, use ONLY amountSwap field
    const swapAmount = body.amountSwap;
    if (!swapAmount) {
      logger.error(
        `[${requestId}] No amountSwap field provided for swap operation`,
        {
          amountSwap: body.amountSwap,
          operation: "swap",
        }
      );
      return NextResponse.json(
        {
          error:
            "amountSwap is required for swap operations. Please specify the amountSwap to swap.",
        },
        { status: 400 }
      );
    }

    logger.info(`[${requestId}] Using amountSwap for swap operation:`, {
      amountSwap: swapAmount,
      amountSwapType: typeof swapAmount,
    });

    // Validate request body
    const validatedData = SwapRequestSchema.parse(body);
    const {
      privateKey,
      privateKeyFormat,
      inputMint,
      outputMint,
      amountSwap: amountSwapInput,
      slippageBps,
      priorityFee,
      computeUnitLimit,
      dynamicComputeUnitLimit,
      network,
    } = validatedData;

    // Parse amountSwap to number with enhanced validation
    const amount =
      typeof amountSwapInput === "string"
        ? parseFloat(amountSwapInput)
        : amountSwapInput;

    if (isNaN(amount) || amount <= 0) {
      logger.error(`[${requestId}] Invalid amountSwap after parsing:`, {
        originalAmountSwapInput: amountSwapInput,
        parsedAmount: amount,
        isNaN: isNaN(amount),
        isLessThanOrEqualZero: amount <= 0,
      });
      return NextResponse.json(
        {
          error: "Invalid amountSwap. Must be a positive number.",
          details: `Received: ${amountSwapInput}, parsed as: ${amount}`,
        },
        { status: 400 }
      );
    }

    logger.info(`[${requestId}] Processing token swap`, {
      inputMint,
      outputMint,
      amount,
      amountSwapInput,
      slippageBps,
      network,
      privateKeyFormat: privateKeyFormat || "auto-detect",
      walletPubkeyPreview: "Will be generated...",
    });

    // Create connection and keypair with enhanced error handling
    let connection: Connection;
    let walletKeypair: any;
    let walletPublicKey: string;

    try {
      connection = new Connection(getRpcEndpoint(network), "confirmed");
      walletKeypair = createKeypairFromPrivateKey(privateKey, privateKeyFormat);
      walletPublicKey = walletKeypair.publicKey.toBase58();

      logger.info(`[${requestId}] Wallet created successfully`, {
        publicKey: walletPublicKey,
        privateKeyFormat,
        privateKeyType: typeof privateKey,
        privateKeyLength: Array.isArray(privateKey) ? privateKey.length : "N/A",
      });
    } catch (error: any) {
      logger.error(`[${requestId}] Failed to create wallet or connection`, {
        error: error.message,
        privateKeyFormat,
        privateKeyType: typeof privateKey,
        network,
      });
      return NextResponse.json(
        {
          error:
            "Failed to create wallet. Please check your private key format.",
          details: error.message,
        },
        { status: 400 }
      );
    }

    const jupiterApiUrl = getJupiterApiUrl(network);

    // Get input token decimals to calculate raw amount
    let inputTokenDecimals = 9; // Default for SOL

    // Handle SOL (native token) vs SPL tokens
    if (inputMint === "So11111111111111111111111111111111111111112") {
      inputTokenDecimals = 9; // SOL has 9 decimals
      logger.info(
        `[${requestId}] Input token is SOL (native), using 9 decimals`
      );
    } else {
      // For SPL tokens, get decimals from mint info
      inputTokenDecimals = 6; // Default for most SPL tokens
      try {
        const { getMint } = await import("@solana/spl-token");
        const { PublicKey } = await import("@solana/web3.js");
        const mintInfo = await getMint(connection, new PublicKey(inputMint));
        inputTokenDecimals = mintInfo.decimals;
        logger.info(`[${requestId}] Retrieved SPL token mint info`, {
          inputMint,
          decimals: inputTokenDecimals,
        });
      } catch (error: any) {
        logger.warn(
          `[${requestId}] Could not get SPL token mint info, using default decimals`,
          {
            inputMint,
            defaultDecimals: inputTokenDecimals,
            error: error.message,
          }
        );
      }
    }

    const rawAmount = Math.floor(amount * Math.pow(10, inputTokenDecimals));

    logger.info(`[${requestId}] Amount calculations`, {
      userAmount: amount,
      decimals: inputTokenDecimals,
      rawAmount: rawAmount,
      rawAmountString: rawAmount.toString(),
    });

    // Step 1: Get order (quote + transaction) from Jupiter Ultra API
    logger.info(`[${requestId}] Getting order from Jupiter Ultra API`);
    const orderParams = new URLSearchParams({
      inputMint,
      outputMint,
      amount: rawAmount.toString(),
      taker: walletPublicKey,
    });

    // Add optional parameters
    if (slippageBps !== 50) {
      // Only add if different from default
      orderParams.append("slippageBps", slippageBps.toString());
    }

    const jupiterOrderUrl = `${jupiterApiUrl}/order?${orderParams}`;
    logger.info(`[${requestId}] Jupiter order request`, {
      url: jupiterOrderUrl,
      params: Object.fromEntries(orderParams.entries()),
    });

    const orderResponse = await fetch(jupiterOrderUrl);
    if (!orderResponse.ok) {
      const errorData = await orderResponse.text();
      logger.error(`[${requestId}] Jupiter Ultra order failed`, {
        status: orderResponse.status,
        statusText: orderResponse.statusText,
        error: errorData,
        url: jupiterOrderUrl,
      });
      return NextResponse.json(
        {
          error: "Failed to get swap order from Jupiter",
          details: `Status: ${orderResponse.status}, ${errorData}`,
          jupiterUrl: jupiterOrderUrl,
        },
        { status: 400 }
      );
    }

    const orderData = await orderResponse.json();

    logger.info(`[${requestId}] Jupiter order response received`, {
      hasTransaction: !!orderData.transaction,
      hasRequestId: !!orderData.requestId,
      swapType: orderData.swapType,
      inAmount: orderData.inAmount,
      outAmount: orderData.outAmount,
      slippageBps: orderData.slippageBps,
      priceImpactPct: orderData.priceImpactPct,
    });

    // Check if order has an error
    if (orderData.errorMessage) {
      logger.error(`[${requestId}] Jupiter Ultra order error`, {
        error: orderData.errorMessage,
        orderData: orderData,
      });
      return NextResponse.json(
        {
          error: "Jupiter order failed",
          details: orderData.errorMessage,
          jupiterResponse: orderData,
        },
        { status: 400 }
      );
    }

    // Check if transaction is available
    if (!orderData.transaction) {
      logger.error(`[${requestId}] No transaction in order response`, {
        orderData: orderData,
        swapType: orderData.swapType,
        gasless: orderData.gasless,
      });
      return NextResponse.json(
        {
          error: "No transaction available for this swap",
          details: "Jupiter did not provide a transaction to sign",
          swapType: orderData.swapType,
          gasless: orderData.gasless,
        },
        { status: 400 }
      );
    }

    // Step 2: Deserialize and sign the transaction
    let transaction: VersionedTransaction;
    let signedTransactionBase64: string;

    try {
      const swapTransactionBuf = Buffer.from(orderData.transaction, "base64");
      transaction = VersionedTransaction.deserialize(swapTransactionBuf);

      // Sign the transaction
      transaction.sign([walletKeypair]);

      // Serialize the transaction to base64 format
      signedTransactionBase64 = Buffer.from(transaction.serialize()).toString(
        "base64"
      );

      logger.info(`[${requestId}] Transaction signed successfully`, {
        transactionLength: swapTransactionBuf.length,
        signedLength: signedTransactionBase64.length,
      });
    } catch (error: any) {
      logger.error(`[${requestId}] Failed to sign transaction`, {
        error: error.message,
        transactionExists: !!orderData.transaction,
        transactionLength: orderData.transaction?.length,
      });
      return NextResponse.json(
        {
          error: "Failed to sign transaction",
          details: error.message,
        },
        { status: 500 }
      );
    }

    // Step 3: Execute the signed transaction using Ultra API
    logger.info(`[${requestId}] Executing swap transaction via Ultra API`);

    const executeResponse = await fetch(`${jupiterApiUrl}/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        signedTransaction: signedTransactionBase64,
        requestId: orderData.requestId,
      }),
    });

    if (!executeResponse.ok) {
      const errorData = await executeResponse.text();
      logger.error(`[${requestId}] Jupiter Ultra execute failed`, {
        status: executeResponse.status,
        statusText: executeResponse.statusText,
        error: errorData,
        requestId: orderData.requestId,
      });
      return NextResponse.json(
        {
          error: "Failed to execute swap transaction",
          details: `Status: ${executeResponse.status}, ${errorData}`,
          requestId: orderData.requestId,
        },
        { status: 400 }
      );
    }

    const executeData = await executeResponse.json();

    logger.info(`[${requestId}] Jupiter execute response`, {
      status: executeData.status,
      hasSignature: !!executeData.signature,
      code: executeData.code,
      error: executeData.error,
    });

    // Check execution status
    if (executeData.status !== "Success") {
      logger.error(`[${requestId}] Swap execution failed`, {
        status: executeData.status,
        error: executeData.error,
        code: executeData.code,
        signature: executeData.signature,
        slot: executeData.slot,
      });
      return NextResponse.json(
        {
          error: executeData.error || "Swap execution failed",
          status: executeData.status,
          code: executeData.code,
          signature: executeData.signature,
        },
        { status: 400 }
      );
    }

    const signature = executeData.signature;

    // Step 5: Confirm the transaction with retry logic
    let confirmation;
    try {
      logger.info(`[${requestId}] Confirming transaction`, { signature });
      confirmation = await connection.confirmTransaction(
        signature,
        "confirmed"
      );

      if (confirmation.value.err) {
        logger.error(`[${requestId}] Swap transaction failed on chain`, {
          signature,
          error: confirmation.value.err,
          slot: confirmation.context.slot,
        });
        return NextResponse.json(
          {
            error: "Swap transaction failed on blockchain",
            signature,
            blockchainError: confirmation.value.err,
          },
          { status: 400 }
        );
      }

      logger.info(`[${requestId}] Transaction confirmed successfully`, {
        signature,
        slot: confirmation.context.slot,
      });
    } catch (error: any) {
      logger.error(`[${requestId}] Failed to confirm transaction`, {
        signature,
        error: error.message,
      });
      return NextResponse.json(
        {
          error: "Failed to confirm transaction",
          signature,
          details: error.message,
        },
        { status: 500 }
      );
    }

    // Get transaction details with error handling
    let transactionInfo;
    try {
      transactionInfo = await connection.getTransaction(signature, {
        commitment: "confirmed",
      });

      if (!transactionInfo) {
        logger.warn(`[${requestId}] Could not retrieve transaction details`, {
          signature,
        });
      }
    } catch (error: any) {
      logger.warn(`[${requestId}] Failed to get transaction details`, {
        signature,
        error: error.message,
      });
    }

    const fee = transactionInfo?.meta?.fee || 0;

    // Calculate output amount and price impact from order and execute data
    const inputAmount = orderData.inAmount;
    const outputAmount = orderData.outAmount;
    const priceImpactPct = parseFloat(orderData.priceImpactPct || "0");

    // Use execute data if available for more accurate amounts
    const actualInputAmount = executeData.inputAmountResult || inputAmount;
    const actualOutputAmount = executeData.outputAmountResult || outputAmount;

    logger.info(`[${requestId}] Token swap completed successfully`, {
      signature,
      inputAmount,
      outputAmount,
      actualInputAmount,
      actualOutputAmount,
      priceImpactPct,
      fee,
      swapType: orderData.swapType,
      slot: transactionInfo?.slot,
    });

    return NextResponse.json({
      transaction: {
        signature,
        slot: transactionInfo?.slot || 0,
        blockTime: transactionInfo?.blockTime,
        confirmationStatus: "confirmed",
        err: transactionInfo?.meta?.err,
      },
      inputMint,
      outputMint,
      inputAmount,
      outputAmount,
      actualInputAmount,
      actualOutputAmount,
      priceImpactPct,
      fee: fee / 1_000_000_000, // Convert lamports to SOL
      route: orderData.routePlan || { marketInfos: [] },
      executeStatus: executeData.status,
      swapType: orderData.swapType,
      swapEvents: executeData.swapEvents || [],
      totalInputAmount: executeData.totalInputAmount,
      totalOutputAmount: executeData.totalOutputAmount,
      explorerUrl: `https://solscan.io/tx/${signature}`,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      logger.warn(`[${requestId}] Invalid request data`, {
        errors: error.errors,
      });
      return NextResponse.json(
        {
          error: "Invalid request data",
          details: error.errors,
          message: "Please check your input parameters",
        },
        { status: 400 }
      );
    }

    logger.error(`[${requestId}] Token swap failed`, {
      error: error.message,
      stack: error.stack,
      name: error.name,
    });

    // Enhanced error categorization
    if (
      error.message?.includes("insufficient funds") ||
      error.message?.includes("Insufficient")
    ) {
      return NextResponse.json(
        {
          error: "Insufficient token balance or SOL for fees",
          details: error.message,
          suggestion:
            "Check your wallet balance and ensure you have enough SOL for transaction fees",
        },
        { status: 400 }
      );
    }

    if (
      error.message?.includes("slippage") ||
      error.message?.includes("Slippage")
    ) {
      return NextResponse.json(
        {
          error:
            "Swap failed due to slippage. Try increasing slippage tolerance.",
          details: error.message,
          suggestion: "Increase slippage tolerance or try a smaller amount",
        },
        { status: 400 }
      );
    }

    if (
      error.message?.includes("timeout") ||
      error.message?.includes("Timeout")
    ) {
      return NextResponse.json(
        {
          error: "Transaction timeout. Please try again.",
          details: error.message,
          suggestion:
            "Network congestion may be high. Try again in a few moments.",
        },
        { status: 408 }
      );
    }

    if (
      error.message?.includes("Invalid private key") ||
      error.message?.includes("keypair")
    ) {
      return NextResponse.json(
        {
          error: "Invalid private key format",
          details: error.message,
          suggestion:
            "Check your private key format. Supported formats: Base64, Base58, number array",
        },
        { status: 400 }
      );
    }

    // Generic server error
    return NextResponse.json(
      {
        error: "Token swap failed",
        details: error.message,
        requestId: requestId,
      },
      { status: 500 }
    );
  }
}
