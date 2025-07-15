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
      placeholder: "Base64, Base58, or number array format",
      description: "Your wallet's private key (keep this secure)",
      condition: {
        field: "operation",
        value: ["solana_transfer", "solana_swap"],
      },
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
      condition: {
        field: "operation",
        value: ["solana_transfer", "solana_swap"],
      },
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
      title: "Amount",
      type: "short-input",
      layout: "half",
      placeholder: "100",
      description: "Amount of tokens to transfer/swap",
      condition: {
        field: "operation",
        value: ["solana_transfer", "solana_swap"],
      },
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
  inputs: {
    operation: { type: "string", required: true },
    // Common fields
    privateKey: { type: "string", required: false },
    privateKeyFormat: { type: "string", required: false },
    network: { type: "string", required: false },
    amount: { type: "string", required: false },
    // Transfer operation
    recipientAddress: { type: "string", required: false },
    tokenMint: { type: "string", required: false },
    memo: { type: "string", required: false },
    // Swap operation
    inputMint: { type: "string", required: false },
    outputMint: { type: "string", required: false },
    slippageBps: { type: "string", required: false },
    priorityFee: { type: "string", required: false },
    // Accounts operation
    walletAddress: { type: "string", required: false },
    // Price operation
    tokenMints: { type: "json", required: false },
  },
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
  tools: {
    access: [
      "solana_transfer",
      "solana_swap",
      "solana_accounts",
      "solana_price",
    ],
    config: {
      tool: (params: any) => {
        return params.operation || "solana_transfer";
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
            const amount = parseFloat(params.amount || "0");
            if (!amount || amount <= 0) {
              throw new Error(
                "Amount must be a positive number for swap operations"
              );
            }

            return {
              network: params.network || "mainnet",
              privateKey: params.privateKey,
              privateKeyFormat: params.privateKeyFormat || "auto",
              inputMint: params.inputMint,
              outputMint: params.outputMint,
              amountSwap: amount, // Backend expects amountSwap
              slippageBps: parseInt(params.slippageBps || "50"),
              ...(params.priorityFee && {
                priorityFee: parseInt(params.priorityFee),
              }),
            };

          case "solana_accounts":
            return {
              walletAddress: params.walletAddress,
            };

          case "solana_price":
            const tokenMintsTable = params.tokenMints;
            let tokenMints: string[] = [];

            if (Array.isArray(tokenMintsTable)) {
              tokenMints = tokenMintsTable
                .map((row: any) => {
                  if (typeof row === "string") return row.trim();
                  if (typeof row === "object" && row !== null) {
                    if (row.cells && typeof row.cells === "object") {
                      return (
                        row.cells["Token Mint Address"] ||
                        row.cells.tokenMintAddress ||
                        row.cells.mint ||
                        Object.values(row.cells)[0]
                      );
                    }
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
                .filter((mint: string) => mint && mint.length > 20)
                .slice(0, 50);
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
