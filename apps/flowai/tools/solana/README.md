# Solana Tools

This package provides comprehensive Solana blockchain tools for SPL token transfers, Jupiter swaps, account queries, and price fetching.

## Tools Overview

### 1. Solana Transfer Tool (`solana_transfer`)

Transfer SPL tokens to another Solana wallet address.

**Parameters:**

- `privateKey` (required): Base64 encoded private key of the sender wallet
- `recipientAddress` (required): Solana wallet address of the recipient
- `tokenMint` (required): SPL token mint address to transfer
- `amount` (required): Amount of tokens to transfer (in token units, not raw)
- `decimals` (optional): Token decimals (auto-detected if not provided)
- `memo` (optional): Optional memo for the transaction
- `network` (optional): Solana network (mainnet, devnet, testnet) - defaults to mainnet

**Example:**

```javascript
{
  "privateKey": "base64-encoded-private-key",
  "recipientAddress": "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
  "tokenMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "amount": 100,
  "memo": "Payment for services",
  "network": "mainnet"
}
```

### 2. Solana Swap Tool (`solana_swap`)

Swap tokens on Solana using Jupiter aggregator for best prices.

**Parameters:**

- `privateKey` (required): Base64 encoded private key of the wallet performing the swap
- `inputMint` (required): Input token mint address (token being sold)
- `outputMint` (required): Output token mint address (token being bought)
- `amount` (required): Amount of input tokens to swap (in token units, not raw)
- `slippageBps` (optional): Maximum slippage in basis points (default: 50 = 0.5%)
- `priorityFee` (optional): Priority fee in micro lamports for faster processing
- `computeUnitLimit` (optional): Compute unit limit for the transaction
- `dynamicComputeUnitLimit` (optional): Use dynamic compute unit limit calculation
- `network` (optional): Solana network - defaults to mainnet

**Example:**

```javascript
{
  "privateKey": "base64-encoded-private-key",
  "inputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "outputMint": "So11111111111111111111111111111111111111112",
  "amount": 100,
  "slippageBps": 100,
  "priorityFee": 10000,
  "network": "mainnet"
}
```

### 3. Solana Accounts Tool (`solana_accounts`)

Get SOL balance and all SPL token accounts for a Solana wallet.

**Parameters:**

- `privateKey` (optional): Base64 encoded private key (used to derive wallet address)
- `walletAddress` (optional): Solana wallet address to check
- `network` (optional): Solana network - defaults to mainnet

_Note: Either `privateKey` or `walletAddress` must be provided_

**Example:**

```javascript
{
  "walletAddress": "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
  "network": "mainnet"
}
```

### 4. Solana Price Tool (`solana_price`)

Get current market prices for Solana tokens.

**Parameters:**

- `tokenMints` (required): Array of SPL token mint addresses to get prices for
- `vsCurrency` (optional): Currency to get prices in (default: usd)

**Example:**

```javascript
{
  "tokenMints": [
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "So11111111111111111111111111111111111111112",
    "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"
  ],
  "vsCurrency": "usd"
}
```

## Common Token Mint Addresses

- **SOL (Wrapped)**: `So11111111111111111111111111111111111111112`
- **USDC**: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- **USDT**: `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB`
- **BONK**: `DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263`
- **RAY (Raydium)**: `4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R`

## Networks

- **Mainnet**: Production network with real value
- **Devnet**: Development network for testing
- **Testnet**: Test network for application testing

## Error Handling

All tools include comprehensive error handling for:

- Invalid wallet addresses/private keys
- Insufficient balances
- Network connection issues
- Invalid token mints
- Slippage tolerance exceeded
- Rate limiting

## Security Notes

- Private keys are handled securely and never logged
- All transactions are confirmed before returning results
- Slippage protection prevents unexpected losses
- Fee estimation included in all operations

## API Integration

These tools integrate with:

- **Jupiter Aggregator**: For optimal swap routes and pricing
- **CoinGecko API**: Primary price data source
- **Jupiter Price API**: Fallback price data source
- **Solana RPC**: Direct blockchain interaction
