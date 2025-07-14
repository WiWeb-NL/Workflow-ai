import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount,
  getMint,
} from "@solana/spl-token";
import { createKeypairFromPrivateKey } from "@/lib/solana/wallet-generator";
import { createLogger } from "@/lib/logs/console-logger";

const logger = createLogger("SolanaTransferAPI");

// Request schema
const TransferRequestSchema = z.object({
  privateKey: z.union([
    z.string().min(1, "Private key is required"),
    z.array(z.number()).length(64, "Private key array must be 64 bytes"),
  ]),
  privateKeyFormat: z
    .enum(["base64", "base58", "array", "auto"])
    .default("auto"),
  recipientAddress: z.string().min(1, "Recipient address is required"),
  tokenMint: z.string().min(1, "Token mint is required"),
  amount: z.union([
    z.number().positive("Amount must be positive"),
    z.string().min(1, "Amount is required"),
  ]),
  decimals: z.number().optional(),
  memo: z.string().optional(),
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

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    const body = await req.json();

    // Debug: Log the raw request body
    logger.info(`[${requestId}] Raw request body:`, {
      privateKey: typeof body.privateKey,
      privateKeyValue: body.privateKey,
      privateKeyFormat: body.privateKeyFormat,
      amount: typeof body.amount,
      amountValue: body.amount,
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
        logger.warn(
          `[${requestId}] Failed to parse privateKey array string: ${error}`
        );
      }
    }

    // Pre-process amount if it's a string
    if (typeof body.amount === "string" && body.amount.trim() !== "") {
      const parsedAmount = parseFloat(body.amount);
      if (!isNaN(parsedAmount)) {
        body.amount = parsedAmount;
        logger.info(
          `[${requestId}] Converted amount string "${body.amount}" to number: ${parsedAmount}`
        );
      }
    }

    // Validate request body
    const validatedData = TransferRequestSchema.parse(body);
    const {
      privateKey,
      privateKeyFormat,
      recipientAddress,
      tokenMint,
      amount: amountInput,
      decimals,
      memo,
      network,
    } = validatedData;

    // Parse amount to number
    const amount =
      typeof amountInput === "string" ? parseFloat(amountInput) : amountInput;

    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid amount. Must be a positive number." },
        { status: 400 }
      );
    }

    logger.info(`[${requestId}] Processing token transfer`, {
      recipientAddress,
      tokenMint,
      amount,
      network,
      hasMemo: !!memo,
      privateKeyFormat: privateKeyFormat || "auto-detect",
    });

    // Create connection
    const connection = new Connection(getRpcEndpoint(network), "confirmed");

    // Create keypair from private key
    const senderKeypair = createKeypairFromPrivateKey(
      privateKey,
      privateKeyFormat
    );
    const senderPublicKey = senderKeypair.publicKey;

    // Validate recipient address
    let recipientPublicKey: PublicKey;
    try {
      recipientPublicKey = new PublicKey(recipientAddress);
    } catch (error) {
      logger.warn(`[${requestId}] Invalid recipient address`, {
        recipientAddress,
      });
      return NextResponse.json(
        { error: "Invalid recipient address" },
        { status: 400 }
      );
    }

    // Validate token mint
    let tokenMintPublicKey: PublicKey;
    try {
      tokenMintPublicKey = new PublicKey(tokenMint);
    } catch (error) {
      logger.warn(`[${requestId}] Invalid token mint`, { tokenMint });
      return NextResponse.json(
        { error: "Invalid token mint address" },
        { status: 400 }
      );
    }

    // Get mint info to determine decimals if not provided
    let mintInfo;
    try {
      mintInfo = await getMint(connection, tokenMintPublicKey);
    } catch (error) {
      logger.error(`[${requestId}] Failed to get mint info`, {
        tokenMint,
        error,
      });
      return NextResponse.json(
        { error: "Invalid or non-existent token mint" },
        { status: 400 }
      );
    }

    const tokenDecimals = decimals ?? mintInfo.decimals;
    const rawAmount = BigInt(Math.floor(amount * Math.pow(10, tokenDecimals)));

    // Get associated token accounts
    const senderTokenAccount = await getAssociatedTokenAddress(
      tokenMintPublicKey,
      senderPublicKey
    );
    const recipientTokenAccount = await getAssociatedTokenAddress(
      tokenMintPublicKey,
      recipientPublicKey
    );

    // Check sender's token balance
    let senderAccountInfo;
    try {
      senderAccountInfo = await getAccount(connection, senderTokenAccount);
    } catch (error) {
      logger.warn(`[${requestId}] Sender does not have token account`, {
        tokenMint,
      });
      return NextResponse.json(
        { error: "Sender does not have this token" },
        { status: 400 }
      );
    }

    if (senderAccountInfo.amount < rawAmount) {
      logger.warn(`[${requestId}] Insufficient token balance`, {
        required: rawAmount.toString(),
        available: senderAccountInfo.amount.toString(),
      });
      return NextResponse.json(
        { error: "Insufficient token balance" },
        { status: 400 }
      );
    }

    // Create transaction
    const transaction = new Transaction();

    // Check if recipient token account exists, create if it doesn't
    try {
      await getAccount(connection, recipientTokenAccount);
    } catch (error) {
      // Account doesn't exist, create it
      logger.info(`[${requestId}] Creating recipient token account`);
      transaction.add(
        createAssociatedTokenAccountInstruction(
          senderPublicKey, // payer
          recipientTokenAccount, // associated token account
          recipientPublicKey, // owner
          tokenMintPublicKey // mint
        )
      );
    }

    // Add transfer instruction
    transaction.add(
      createTransferInstruction(
        senderTokenAccount, // source
        recipientTokenAccount, // destination
        senderPublicKey, // owner of source account
        rawAmount // amount
      )
    );

    // Add memo if provided
    if (memo) {
      transaction.add(
        new Transaction().add({
          keys: [
            { pubkey: senderPublicKey, isSigner: true, isWritable: false },
          ],
          programId: new PublicKey(
            "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
          ),
          data: Buffer.from(memo, "utf8"),
        }).instructions[0]
      );
    }

    // Send and confirm transaction
    logger.info(`[${requestId}] Sending transaction`);
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [senderKeypair],
      {
        commitment: "confirmed",
      }
    );

    // Get transaction details
    const transactionInfo = await connection.getTransaction(signature, {
      commitment: "confirmed",
    });

    const fee = transactionInfo?.meta?.fee || 0;

    logger.info(`[${requestId}] Token transfer successful`, {
      signature,
      fee,
      amount: amount,
    });

    return NextResponse.json({
      transaction: {
        signature,
        slot: transactionInfo?.slot || 0,
        blockTime: transactionInfo?.blockTime,
        confirmationStatus: "confirmed",
        err: transactionInfo?.meta?.err,
      },
      fromAddress: senderPublicKey.toBase58(),
      toAddress: recipientAddress,
      tokenMint: tokenMint,
      amount: rawAmount.toString(),
      uiAmount: amount,
      fee: fee / LAMPORTS_PER_SOL,
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

    logger.error(`[${requestId}] Token transfer failed`, error);

    if (error.message?.includes("insufficient funds")) {
      return NextResponse.json(
        { error: "Insufficient SOL for transaction fees" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Token transfer failed" },
      { status: 500 }
    );
  }
}
