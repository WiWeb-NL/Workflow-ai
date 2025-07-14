import { DatabaseIcon } from "@/components/icons";
import type {
  SolanaTransferResponse,
  SolanaSwapResponse,
  SolanaAccountsResponse,
  SolanaPriceResponse,
} from "@/tools/solana/types";
import type { BlockConfig } from "../types";

type SolanaResponse =
  | SolanaTransferResponse
  | SolanaSwapResponse
  | SolanaAccountsResponse
  | SolanaPriceResponse;

export const SolanaBlock: BlockConfig<SolanaResponse> = {
  type: "solana",
  name: "Solana",
  description: "Solana blockchain operations",
  longDescription:
    "Interact with the Solana blockchain to transfer SPL tokens, swap tokens via Jupiter aggregator, check wallet balances, and get token prices. Comprehensive Solana DeFi integration for your workflows.",
  docsLink: "https://docs.visualworkflow.app/tools/solana",
  category: "tools",
  bgColor: "#14F195", // Solana's brand color
  icon: DatabaseIcon,
  subBlocks: [
    // Operation selector
    {
      id: "operation",
      title: "Operation",
      type: "dropdown",
      layout: "full",
      options: [
        { label: "Transfer SPL Tokens", id: "solana_transfer" },
        { label: "Swap Tokens (Jupiter)", id: "solana_swap" },
        { label: "Get Token Accounts", id: "solana_accounts" },
        { label: "Get Token Prices", id: "solana_price" },
      ],
      value: () => "solana_transfer",
    },
    // Private Key Input (for transfer and swap operations)
    {
      id: "privateKey",
      title: "Private Key",
      type: "long-input",
      layout: "full",
      placeholder:
        "Base64 encoded private key, Base58 encoded, number array [1,2,3...], or Uint8Array",
      description: "Your wallet's private key (keep this secure)",
      condition: { field: "operation", value: "solana_transfer" },
    },
    {
      id: "privateKeyFormat",
      title: "Private Key Format",
      type: "dropdown",
      layout: "half",
      options: [
        { label: "Auto-detect", id: "auto" },
        { label: "Base64", id: "base64" },
        { label: "Base58", id: "base58" },
        { label: "Number Array", id: "array" },
      ],
      value: () => "auto",
      description: "Format of the private key input",
      condition: { field: "operation", value: "solana_transfer" },
    },
    {
      id: "privateKeySwap",
      title: "Private Key",
      type: "long-input",
      layout: "full",
      placeholder:
        "Base64 encoded private key, Base58 encoded, number array [1,2,3...], or Uint8Array",
      description: "Your wallet's private key (keep this secure)",
      condition: { field: "operation", value: "solana_swap" },
    },
    {
      id: "privateKeyFormatSwap",
      title: "Private Key Format",
      type: "dropdown",
      layout: "half",
      options: [
        { label: "Auto-detect", id: "auto" },
        { label: "Base64", id: "base64" },
        { label: "Base58", id: "base58" },
        { label: "Number Array", id: "array" },
      ],
      value: () => "auto",
      description: "Format of the private key input",
      condition: { field: "operation", value: "solana_swap" },
    },
    // Wallet Address Input (for accounts operation)
    {
      id: "walletAddress",
      title: "Wallet Address",
      type: "short-input",
      layout: "full",
      placeholder: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
      description: "Solana wallet address to query",
      condition: { field: "operation", value: "solana_accounts" },
    },
    // Network selector (only for transfer and swap operations)
    {
      id: "network",
      title: "Network",
      type: "dropdown",
      layout: "half",
      options: [
        { label: "Mainnet", id: "mainnet" },
        { label: "Devnet", id: "devnet" },
        { label: "Testnet", id: "testnet" },
      ],
      value: () => "mainnet",
      condition: {
        field: "operation",
        value: ["solana_transfer", "solana_swap"],
      },
    },
    // Transfer-specific fields
    {
      id: "recipientAddress",
      title: "Recipient Address",
      type: "short-input",
      layout: "full",
      placeholder: "Recipient's Solana wallet address",
      description: "The wallet address to send tokens to",
      condition: { field: "operation", value: "solana_transfer" },
    },
    {
      id: "tokenMint",
      title: "Token Mint Address",
      type: "short-input",
      layout: "full",
      placeholder: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      description: "SPL token mint address to transfer",
      condition: { field: "operation", value: "solana_transfer" },
    },
    {
      id: "amount",
      title: "Transfer Amount",
      type: "short-input",
      layout: "half",
      placeholder: "100",
      description: "Amount of tokens to transfer",
      condition: { field: "operation", value: "solana_transfer" },
    },
    {
      id: "amountSwap",
      title: "Swap Amount",
      type: "short-input",
      layout: "half",
      placeholder: "0.001",
      description: "Amount of tokens to swap (e.g., 0.001 for SOL)",
      condition: { field: "operation", value: "solana_swap" },
    },
    {
      id: "memo",
      title: "Memo (Optional)",
      type: "short-input",
      layout: "half",
      placeholder: "Payment for services",
      description: "Optional transaction memo",
      condition: { field: "operation", value: "solana_transfer" },
    },
    // Swap-specific fields
    {
      id: "inputMint",
      title: "Input Token Mint",
      type: "short-input",
      layout: "half",
      placeholder: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      description: "Token you want to sell",
      condition: { field: "operation", value: "solana_swap" },
    },
    {
      id: "outputMint",
      title: "Output Token Mint",
      type: "short-input",
      layout: "half",
      placeholder: "So11111111111111111111111111111111111111112",
      description: "Token you want to buy",
      condition: { field: "operation", value: "solana_swap" },
    },
    {
      id: "slippageBps",
      title: "Slippage (Basis Points)",
      type: "short-input",
      layout: "half",
      placeholder: "50",
      description: "Maximum slippage (50 = 0.5%)",
      condition: { field: "operation", value: "solana_swap" },
    },
    {
      id: "priorityFee",
      title: "Priority Fee (Optional)",
      type: "short-input",
      layout: "half",
      placeholder: "10000",
      description: "Priority fee in micro lamports",
      condition: { field: "operation", value: "solana_swap" },
    },
    // Price-specific fields
    {
      id: "tokenMints",
      title: "Token Mint Addresses",
      type: "table",
      layout: "full",
      description: "List of SPL token mint addresses to get prices for",
      condition: { field: "operation", value: "solana_price" },
      columns: ["Token Mint Address"],
    },
  ],
  outputs: {
    transaction: "json",
    fee: "number",
    walletAddress: "string",
    prices: "json",
    tokenAccounts: "json",
    solBalance: "number",
    amount: "string",
    inputAmount: "string",
    outputAmount: "string",
  },
  inputs: {
    operation: { type: "string", required: true },
    // Transfer operation
    privateKey: { type: "string", required: false },
    recipientAddress: { type: "string", required: false },
    tokenMint: { type: "string", required: false },
    amount: { type: "string", required: false },
    memo: { type: "string", required: false },
    // Swap operation
    privateKeySwap: { type: "string", required: false },
    inputMint: { type: "string", required: false },
    outputMint: { type: "string", required: false },
    amountSwap: { type: "string", required: false },
    slippageBps: { type: "string", required: false },
    priorityFee: { type: "string", required: false },
    // Accounts operation
    walletAddress: { type: "string", required: false },
    // Price operation
    tokenMints: { type: "json", required: false },
    // Common
    network: { type: "string", required: false },
  },
  tools: {
    access: [
      "solana_transfer",
      "solana_swap",
      "solana_accounts",
      "solana_price",
    ],
    config: {
      tool: (params: any) => {
        const operation = params.operation;
        return operation || "solana_transfer";
      },
      params: (params: any) => {
        const operation = params.operation;

        switch (operation) {
          case "solana_transfer":
            return {
              network: params.network || "mainnet",
              privateKey: params.privateKey,
              privateKeyFormat: params.privateKeyFormat || "auto",
              recipientAddress: params.recipientAddress,
              tokenMint: params.tokenMint,
              amount: parseFloat(params.amount || "0"),
              ...(params.memo && { memo: params.memo }),
            };

          case "solana_swap":
            console.log("DEBUG: Swap params received:", {
              privateKeySwap: params.privateKeySwap,
              privateKeyFormatSwap: params.privateKeyFormatSwap,
              amountSwap: params.amountSwap,
              amount: params.amount, // Check if it's using the wrong field name
              inputMint: params.inputMint,
              outputMint: params.outputMint,
              allParams: params,
            });

            // For swap operations, ONLY use amountSwap field - ignore amount field completely
            let swapAmount = params.amountSwap;
            console.log(
              "DEBUG: Using ONLY amountSwap field for swap:",
              swapAmount,
              typeof swapAmount
            );

            // CRITICAL: Swap operations should NEVER use the transfer amount field
            if (!params.amountSwap) {
              console.error(
                "CRITICAL ERROR: amountSwap field is missing for swap operation!",
                {
                  amountSwap: params.amountSwap,
                  transferAmount: params.amount,
                  operation: "solana_swap",
                }
              );
              throw new Error(
                "amountSwap field is required for swap operations"
              );
            }

            if (typeof swapAmount === "string" && swapAmount.trim() !== "") {
              swapAmount = parseFloat(swapAmount);
              console.log("DEBUG: Parsed amountSwap string to:", swapAmount);
            }

            // Validate the parsed amount
            if (!swapAmount || swapAmount === 0 || isNaN(swapAmount)) {
              console.error("ERROR: Invalid amountSwap value:", {
                original: params.amountSwap,
                parsed: swapAmount,
              });
              throw new Error(`Invalid amountSwap value: ${params.amountSwap}`);
            }

            const result = {
              network: params.network || "mainnet",
              privateKey: params.privateKeySwap,
              privateKeyFormat: params.privateKeyFormatSwap || "auto",
              inputMint: params.inputMint,
              outputMint: params.outputMint,
              amount: swapAmount, // This will be 0.0001
              slippageBps: parseInt(params.slippageBps || "50"),
              ...(params.priorityFee && {
                priorityFee: parseInt(params.priorityFee),
              }),
            };

            console.log("DEBUG: Final swap params to send:", result);
            return result;

          case "solana_accounts":
            return {
              walletAddress: params.walletAddress,
            };

          case "solana_price":
            const tokenMintsTable = params.tokenMints;
            let tokenMints: string[] = [];

            // Handle different possible table data formats
            if (Array.isArray(tokenMintsTable)) {
              tokenMints = tokenMintsTable
                .map((row: any) => {
                  // Handle different table formats
                  if (typeof row === "string") return row.trim();
                  if (typeof row === "object" && row !== null) {
                    // Handle table structure with cells property
                    if (row.cells && typeof row.cells === "object") {
                      return (
                        row.cells["Token Mint Address"] ||
                        row.cells.tokenMintAddress ||
                        row.cells.mint ||
                        Object.values(row.cells)[0]
                      );
                    }
                    // Handle direct object structure
                    return (
                      row["Token Mint Address"] ||
                      row.tokenMintAddress ||
                      row.mint ||
                      row[0] ||
                      Object.values(row)[0]
                    );
                  }
                  return String(row).trim();
                })
                .filter(Boolean)
                .filter((mint: string) => mint && mint.length > 20) // Basic validation for Solana addresses
                .slice(0, 50); // Limit to prevent abuse (Jupiter allows max 50)
            }

            return {
              tokenMints,
            };

          default:
            return {};
        }
      },
    },
  },
};
