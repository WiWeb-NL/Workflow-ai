import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Keypair,
  sendAndConfirmTransaction,
  TransactionSignature,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createTransferInstruction,
  getAccount,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { createLogger } from "@/lib/logs/console-logger";

const logger = createLogger("Solana-Payment");

// FlowAI Token Configuration
export const FLOWAI_TOKEN_MINT = new PublicKey(
  "FpVBzhuQhY3uT1ijxwHRob4NjXQzbcpg1FsgNNTwwBLV"
);

// Payment destination from environment variables
export const PAYMENT_DESTINATION_SOL = new PublicKey(
  process.env.SOLANA_PAYMENT_DESTINATION_SOL ||
    "DeFJ3LmEZ44iWWGPy4kS7MiAodU8JSTweEFZ94TfpQaT" // Fallback to token mint
);

export const PAYMENT_DESTINATION_SPL = new PublicKey(
  process.env.SOLANA_PAYMENT_DESTINATION_SPL ||
    "DeFJ3LmEZ44iWWGPy4kS7MiAodU8JSTweEFZ94TfpQaT" // Fallback to token mint
);

// Treasury wallet for FlowAI token transfers (when purchasing with SOL)
export const TREASURY_WALLET_PRIVATE_KEY =
  process.env.SOLANA_TREASURY_PRIVATE_KEY;
export const TREASURY_WALLET_ADDRESS = process.env.SOLANA_TREASURY_ADDRESS;

interface PaymentDetails {
  amount: number;
  currency: "SOL" | "FLOWAI_TOKEN";
  description: string;
  fromWalletAddress: string;
  fromPrivateKey: string;
  tokenAmount?: number; // For SOL payments, the equivalent FlowAI tokens to transfer
}

interface PaymentResult {
  success: boolean;
  signature?: string;
  error?: string;
  marketingTransferSignature?: string; // Optional signature for FlowAI token transfer to marketing wallet
}

export class SolanaPaymentService {
  private connection: Connection;

  constructor(rpcUrl?: string) {
    this.connection = new Connection(
      rpcUrl ||
        process.env.SOLANA_RPC_URL ||
        "https://api.mainnet-beta.solana.com",
      "confirmed"
    );
  }

  /**
   * Safely parse private key from different formats
   */
  private parsePrivateKey(privateKeyString: string): Keypair {
    try {
      let privateKeyBytes: Buffer;

      // Try different formats based on length
      if (privateKeyString.length === 128) {
        // Hex format (64 bytes = 128 hex chars)
        privateKeyBytes = Buffer.from(privateKeyString, "hex");
      } else if (privateKeyString.length === 88) {
        // Base64 format (64 bytes encoded in base64)
        privateKeyBytes = Buffer.from(privateKeyString, "base64");
      } else {
        // Try base64 by default
        privateKeyBytes = Buffer.from(privateKeyString, "base64");
      }

      // Validate key length
      if (privateKeyBytes.length !== 64) {
        throw new Error(
          `Invalid private key length: expected 64 bytes, got ${privateKeyBytes.length}`
        );
      }

      return Keypair.fromSecretKey(privateKeyBytes);
    } catch (error) {
      logger.error("Failed to parse private key", {
        keyLength: privateKeyString.length,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw new Error(
        `Invalid private key format: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Transfer FlowAI tokens from treasury to payment destination (marketing wallet)
   * This is called after a successful SOL purchase to move tokens to the marketing wallet
   */
  async transferFlowAITokensToMarketing(
    tokenAmount: number,
    description: string
  ): Promise<{ success: boolean; signature?: string; error?: string }> {
    try {
      if (!TREASURY_WALLET_PRIVATE_KEY || !TREASURY_WALLET_ADDRESS) {
        logger.warn(
          "Treasury wallet not configured, skipping FlowAI token transfer"
        );
        return { success: true }; // Don't fail the main transaction
      }

      // Create treasury keypair
      const treasuryKeypair = this.parsePrivateKey(TREASURY_WALLET_PRIVATE_KEY);

      // Verify treasury address matches
      if (treasuryKeypair.publicKey.toBase58() !== TREASURY_WALLET_ADDRESS) {
        throw new Error(
          "Treasury private key does not match configured address"
        );
      }

      // Determine which token program to use
      let tokenProgram = TOKEN_PROGRAM_ID;
      let fromTokenAccount: PublicKey;
      let toTokenAccount: PublicKey;

      // Try legacy program first
      try {
        fromTokenAccount = await getAssociatedTokenAddress(
          FLOWAI_TOKEN_MINT,
          treasuryKeypair.publicKey,
          false,
          TOKEN_PROGRAM_ID
        );

        await getAccount(
          this.connection,
          fromTokenAccount,
          "confirmed",
          TOKEN_PROGRAM_ID
        );
        tokenProgram = TOKEN_PROGRAM_ID;
      } catch (error) {
        // Try Token-2022 program
        try {
          fromTokenAccount = await getAssociatedTokenAddress(
            FLOWAI_TOKEN_MINT,
            treasuryKeypair.publicKey,
            false,
            TOKEN_2022_PROGRAM_ID
          );

          await getAccount(
            this.connection,
            fromTokenAccount,
            "confirmed",
            TOKEN_2022_PROGRAM_ID
          );
          tokenProgram = TOKEN_2022_PROGRAM_ID;
        } catch (error2) {
          throw new Error("Treasury FlowAI token account not found");
        }
      }

      // Get destination token account
      toTokenAccount = await getAssociatedTokenAddress(
        FLOWAI_TOKEN_MINT,
        PAYMENT_DESTINATION_SPL,
        false,
        tokenProgram
      );

      // Check if destination account exists, create if not
      let destinationAccountExists = true;
      try {
        await getAccount(
          this.connection,
          toTokenAccount,
          "confirmed",
          tokenProgram
        );
      } catch (error) {
        destinationAccountExists = false;
      }

      // Check treasury token balance
      const fromAccountInfo = await getAccount(
        this.connection,
        fromTokenAccount,
        "confirmed",
        tokenProgram
      );

      if (Number(fromAccountInfo.amount) < tokenAmount) {
        throw new Error(
          `Insufficient treasury FlowAI token balance. Required: ${tokenAmount}, Available: ${fromAccountInfo.amount}`
        );
      }

      // Create transaction
      const transaction = new Transaction();

      // Add create account instruction if needed
      if (!destinationAccountExists) {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            treasuryKeypair.publicKey, // payer
            toTokenAccount, // associatedToken
            PAYMENT_DESTINATION_SPL, // owner
            FLOWAI_TOKEN_MINT, // mint
            tokenProgram
          )
        );
      }

      // Add transfer instruction
      transaction.add(
        createTransferInstruction(
          fromTokenAccount,
          toTokenAccount,
          treasuryKeypair.publicKey,
          tokenAmount,
          [],
          tokenProgram
        )
      );

      // Get recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = treasuryKeypair.publicKey;

      // Sign and send transaction
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [treasuryKeypair],
        { commitment: "confirmed" }
      );

      logger.info("FlowAI tokens transferred to marketing wallet", {
        signature,
        amount: tokenAmount,
        from: TREASURY_WALLET_ADDRESS,
        to: PAYMENT_DESTINATION_SPL.toBase58(),
        description,
      });

      return { success: true, signature };
    } catch (error) {
      logger.error(
        "Failed to transfer FlowAI tokens to marketing wallet",
        error
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : "Token transfer failed",
      };
    }
  }

  /**
   * Process a SOL payment
   */
  async processSOLPayment(
    paymentDetails: PaymentDetails
  ): Promise<PaymentResult> {
    try {
      if (paymentDetails.currency !== "SOL") {
        throw new Error("Invalid currency for SOL payment");
      }

      // Create keypair from private key
      const fromKeypair = this.parsePrivateKey(paymentDetails.fromPrivateKey);

      // Verify the wallet address matches
      if (
        fromKeypair.publicKey.toBase58() !== paymentDetails.fromWalletAddress
      ) {
        throw new Error("Private key does not match wallet address");
      }

      // Check balance
      const balance = await this.connection.getBalance(fromKeypair.publicKey);
      const requiredLamports = paymentDetails.amount * LAMPORTS_PER_SOL;

      if (balance < requiredLamports + 5000) {
        // 5000 lamports for transaction fee
        throw new Error("Insufficient SOL balance for payment and fees");
      }

      // Create transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: fromKeypair.publicKey,
          toPubkey: PAYMENT_DESTINATION_SOL,
          lamports: requiredLamports,
        })
      );

      // Get recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromKeypair.publicKey;

      // Sign and send transaction
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [fromKeypair],
        { commitment: "confirmed" }
      );

      logger.info("SOL payment successful", {
        signature,
        amount: paymentDetails.amount,
        from: paymentDetails.fromWalletAddress,
        to: PAYMENT_DESTINATION_SOL.toBase58(),
      });

      // If tokenAmount is provided, transfer FlowAI tokens to marketing wallet
      let marketingTransferSignature: string | undefined;
      if (paymentDetails.tokenAmount && paymentDetails.tokenAmount > 0) {
        logger.info("Transferring FlowAI tokens to marketing wallet", {
          tokenAmount: paymentDetails.tokenAmount,
          description: paymentDetails.description,
        });

        const marketingTransfer = await this.transferFlowAITokensToMarketing(
          paymentDetails.tokenAmount,
          paymentDetails.description
        );

        if (marketingTransfer.success) {
          marketingTransferSignature = marketingTransfer.signature;
          logger.info(
            "FlowAI tokens successfully transferred to marketing wallet",
            {
              tokenTransferSignature: marketingTransferSignature,
              tokenAmount: paymentDetails.tokenAmount,
            }
          );
        } else {
          logger.warn("Failed to transfer FlowAI tokens to marketing wallet", {
            error: marketingTransfer.error,
            tokenAmount: paymentDetails.tokenAmount,
          });
          // Don't fail the main transaction, just log the warning
        }
      }

      return {
        success: true,
        signature,
        marketingTransferSignature, // Include the marketing transfer signature if successful
      };
    } catch (error) {
      logger.error("SOL payment failed", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Payment failed",
      };
    }
  }

  /**
   * Process a FlowAI SPL token payment
   */
  async processSPLPayment(
    paymentDetails: PaymentDetails
  ): Promise<PaymentResult> {
    try {
      if (paymentDetails.currency !== "FLOWAI_TOKEN") {
        throw new Error("Invalid currency for SPL token payment");
      }

      // Create keypair from private key
      const fromKeypair = this.parsePrivateKey(paymentDetails.fromPrivateKey);

      // Verify the wallet address matches
      if (
        fromKeypair.publicKey.toBase58() !== paymentDetails.fromWalletAddress
      ) {
        throw new Error("Private key does not match wallet address");
      }

      // Determine which token program to use by checking which one has the token account
      let tokenProgram = TOKEN_PROGRAM_ID; // Default to legacy program (more common)
      let fromTokenAccount: PublicKey;
      let toTokenAccount: PublicKey;

      // Try to find the token account with the legacy program first
      try {
        fromTokenAccount = await getAssociatedTokenAddress(
          FLOWAI_TOKEN_MINT,
          fromKeypair.publicKey,
          false,
          TOKEN_PROGRAM_ID
        );

        // Check if this account exists
        await getAccount(
          this.connection,
          fromTokenAccount,
          "confirmed",
          TOKEN_PROGRAM_ID
        );
        tokenProgram = TOKEN_PROGRAM_ID;

        logger.debug("Using Legacy Token Program for SPL payment", {
          fromTokenAccount: fromTokenAccount.toBase58(),
        });
      } catch (error) {
        // Try Token-2022 program if legacy fails
        try {
          fromTokenAccount = await getAssociatedTokenAddress(
            FLOWAI_TOKEN_MINT,
            fromKeypair.publicKey,
            false,
            TOKEN_2022_PROGRAM_ID
          );

          // Check if this account exists
          await getAccount(
            this.connection,
            fromTokenAccount,
            "confirmed",
            TOKEN_2022_PROGRAM_ID
          );
          tokenProgram = TOKEN_2022_PROGRAM_ID;

          logger.debug("Using Token-2022 Program for SPL payment", {
            fromTokenAccount: fromTokenAccount.toBase58(),
          });
        } catch (error2) {
          throw new Error(
            "FlowAI token account not found. You need FlowAI tokens to make this payment."
          );
        }
      }

      // Get destination token account with the same program
      toTokenAccount = await getAssociatedTokenAddress(
        FLOWAI_TOKEN_MINT,
        PAYMENT_DESTINATION_SPL,
        false,
        tokenProgram
      );

      // FlowAI tokens have 9 decimals, so convert human-readable amount to raw amount
      const FLOWAI_TOKEN_DECIMALS = 9;
      const rawAmount =
        paymentDetails.amount * Math.pow(10, FLOWAI_TOKEN_DECIMALS);

      // Check token balance (compare raw amounts)
      const fromAccountInfo = await getAccount(
        this.connection,
        fromTokenAccount,
        "confirmed",
        tokenProgram
      );

      if (Number(fromAccountInfo.amount) < rawAmount) {
        throw new Error("Insufficient FlowAI token balance");
      }

      // Check SOL balance for transaction fees
      const solBalance = await this.connection.getBalance(
        fromKeypair.publicKey
      );
      if (solBalance < 10000) {
        // 10000 lamports for transaction fee
        throw new Error("Insufficient SOL balance for transaction fees");
      }

      // Create transaction with raw amount
      const transaction = new Transaction().add(
        createTransferInstruction(
          fromTokenAccount,
          toTokenAccount,
          fromKeypair.publicKey,
          BigInt(rawAmount), // Use raw amount with decimals
          [],
          tokenProgram
        )
      );

      // Get recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromKeypair.publicKey;

      // Sign and send transaction
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [fromKeypair],
        { commitment: "confirmed" }
      );

      logger.info("FlowAI token payment successful", {
        signature,
        amount: paymentDetails.amount,
        from: paymentDetails.fromWalletAddress,
        to: PAYMENT_DESTINATION_SPL.toBase58(),
      });

      return {
        success: true,
        signature,
      };
    } catch (error) {
      logger.error("SPL token payment failed", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Payment failed",
      };
    }
  }

  /**
   * Get SOL balance for a wallet
   */
  async getSOLBalance(walletAddress: string): Promise<number> {
    try {
      const publicKey = new PublicKey(walletAddress);
      const balance = await this.connection.getBalance(publicKey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      logger.error("Failed to get SOL balance", error);
      return 0;
    }
  }

  /**
   * Get FlowAI token balance for a wallet
   */
  async getFlowAITokenBalance(walletAddress: string): Promise<number> {
    try {
      const publicKey = new PublicKey(walletAddress);

      // Try both token programs (Legacy Token Program first, then Token-2022)
      const tokenPrograms = [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID];

      for (const tokenProgram of tokenPrograms) {
        try {
          const tokenAccount = await getAssociatedTokenAddress(
            FLOWAI_TOKEN_MINT,
            publicKey,
            false,
            tokenProgram
          );

          logger.debug("Checking FlowAI token account", {
            walletAddress,
            tokenAccount: tokenAccount.toBase58(),
            tokenProgram:
              tokenProgram === TOKEN_2022_PROGRAM_ID
                ? "Token-2022"
                : "Token Program",
          });

          const accountInfo = await getAccount(
            this.connection,
            tokenAccount,
            "confirmed",
            tokenProgram
          );

          const rawBalance = Number(accountInfo.amount);
          // FlowAI tokens have 9 decimals, so convert raw amount to human-readable
          const balance = rawBalance / Math.pow(10, 9);

          logger.debug("Found FlowAI token balance", {
            walletAddress,
            rawBalance,
            balance,
            tokenProgram:
              tokenProgram === TOKEN_2022_PROGRAM_ID
                ? "Token-2022"
                : "Token Program",
          });

          return balance;
        } catch (error) {
          // Continue to next token program if account not found
          if (
            error instanceof Error &&
            error.name === "TokenAccountNotFoundError"
          ) {
            logger.debug("FlowAI token account not found with program", {
              walletAddress,
              tokenProgram:
                tokenProgram === TOKEN_2022_PROGRAM_ID
                  ? "Token-2022"
                  : "Token Program",
            });
            continue;
          }
          // Log other errors but continue
          logger.warn("Error checking token account", {
            walletAddress,
            tokenProgram:
              tokenProgram === TOKEN_2022_PROGRAM_ID
                ? "Token-2022"
                : "Token Program",
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      // No token account found with either program
      logger.debug(
        "FlowAI token account not found with any program, returning 0 balance",
        {
          walletAddress,
        }
      );
      return 0;
    } catch (error) {
      logger.error("Failed to get FlowAI token balance", error);
      return 0;
    }
  }

  /**
   * Verify a transaction signature
   */
  async verifyTransaction(signature: string): Promise<boolean> {
    try {
      const status = await this.connection.getSignatureStatus(signature);
      return (
        status?.value?.confirmationStatus === "confirmed" ||
        status?.value?.confirmationStatus === "finalized"
      );
    } catch (error) {
      logger.error("Failed to verify transaction", error);
      return false;
    }
  }
}

// Export singleton instance
export const solanaPaymentService = new SolanaPaymentService();
