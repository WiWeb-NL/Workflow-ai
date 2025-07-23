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
    "FpVBzhuQhY3uT1ijxwHRob4NjXQzbcpg1FsgNNTwwBLV" // Fallback to token mint
);

export const PAYMENT_DESTINATION_SPL = new PublicKey(
  process.env.SOLANA_PAYMENT_DESTINATION_SPL ||
    "FpVBzhuQhY3uT1ijxwHRob4NjXQzbcpg1FsgNNTwwBLV" // Fallback to token mint
);

interface PaymentDetails {
  amount: number;
  currency: "SOL" | "FLOWAI_TOKEN";
  description: string;
  fromWalletAddress: string;
  fromPrivateKey: string;
}

interface PaymentResult {
  success: boolean;
  signature?: string;
  error?: string;
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

      return {
        success: true,
        signature,
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

      // Check token balance
      const fromAccountInfo = await getAccount(
        this.connection,
        fromTokenAccount,
        "confirmed",
        tokenProgram
      );

      if (Number(fromAccountInfo.amount) < paymentDetails.amount) {
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

      // Create transaction
      const transaction = new Transaction().add(
        createTransferInstruction(
          fromTokenAccount,
          toTokenAccount,
          fromKeypair.publicKey,
          paymentDetails.amount,
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

          const balance = Number(accountInfo.amount);
          logger.debug("Found FlowAI token balance", {
            walletAddress,
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
