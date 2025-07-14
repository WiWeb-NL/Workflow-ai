import type { ToolResponse } from "../types";

// Common Types
export interface SolanaTransaction {
  signature: string;
  slot: number;
  blockTime: number | null;
  confirmationStatus: "processed" | "confirmed" | "finalized";
  err: any | null;
}

export interface TokenAccount {
  address: string;
  mint: string;
  owner: string;
  amount: string;
  decimals: number;
  uiAmount: number | null;
  uiAmountString: string;
}

export interface TokenInfo {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  coingeckoId?: string;
  vsToken?: string;
  vsUsd?: number;
}

// Common parameters for transfer and swap operations that need wallet access
export interface SolanaBaseParams {
  privateKey: string; // Private key in any supported format
  privateKeyFormat?: "base64" | "base58" | "array" | "auto"; // Format of the private key
  network?: "mainnet" | "devnet" | "testnet";
}

// Transfer SPL Token Operation
export interface SolanaTransferParams extends SolanaBaseParams {
  recipientAddress: string;
  tokenMint: string;
  amount: number;
  decimals?: number;
  memo?: string;
}

export interface SolanaTransferResponse extends ToolResponse {
  output: {
    transaction: SolanaTransaction;
    fromAddress: string;
    toAddress: string;
    tokenMint: string;
    amount: string;
    uiAmount: number;
    fee: number;
  };
}

// Jupiter Swap Operation
export interface SolanaSwapParams extends SolanaBaseParams {
  inputMint: string;
  outputMint: string;
  amountSwap: number;
  slippageBps?: number; // Slippage in basis points (default: 50 = 0.5%)
  priorityFee?: number; // Priority fee in micro lamports
  computeUnitLimit?: number;
  dynamicComputeUnitLimit?: boolean;
}

export interface SolanaSwapResponse extends ToolResponse {
  output: {
    transaction: SolanaTransaction;
    inputMint: string;
    outputMint: string;
    inputAmount: string;
    outputAmount: string;
    priceImpactPct: number;
    fee: number;
    route: {
      marketInfos: Array<{
        id: string;
        label: string;
        inputMint: string;
        outputMint: string;
        inAmount: string;
        outAmount: string;
        feeAmount: string;
        feeMint: string;
      }>;
    };
  };
}

// Get Token Accounts Operation (no network parameter - uses mainnet only)
export interface SolanaAccountsParams {
  walletAddress: string; // Solana wallet address to check
}

export interface SolanaAccountsResponse extends ToolResponse {
  output: {
    walletAddress: string;
    solBalance: number;
    tokenAccounts: TokenAccount[];
    totalValueUsd?: number;
  };
}

// Get Token Price Operation (no network or currency parameters - uses mainnet and USD only)
export interface SolanaPriceParams {
  tokenMints: string[];
}

export interface SolanaPriceResponse extends ToolResponse {
  output: {
    prices: Record<
      string,
      {
        price: number;
        currency: string;
        lastUpdated: string;
      }
    >;
  };
}
