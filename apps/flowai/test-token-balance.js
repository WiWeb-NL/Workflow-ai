// Test script to check FlowAI token balance directly on Solana
const { Connection, PublicKey } = require("@solana/web3.js");
const {
  getAssociatedTokenAddress,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} = require("@solana/spl-token");

const FLOWAI_TOKEN_MINT = new PublicKey(
  "FpVBzhuQhY3uT1ijxwHRob4NjXQzbcpg1FsgNNTwwBLV"
);
const WALLET_ADDRESS = "A9yjC2GFbPvxswz6euTnStkbSffa8TtydaorDZbB6W3b"; // Your wallet address

async function checkTokenBalance() {
  const connection = new Connection(
    "https://api.mainnet-beta.solana.com",
    "confirmed"
  );
  const walletPubkey = new PublicKey(WALLET_ADDRESS);

  console.log("Checking FlowAI token balance for wallet:", WALLET_ADDRESS);
  console.log("Token mint:", FLOWAI_TOKEN_MINT.toBase58());
  console.log("");

  // Try both token programs
  const tokenPrograms = [
    { id: TOKEN_2022_PROGRAM_ID, name: "Token-2022 Program" },
    { id: TOKEN_PROGRAM_ID, name: "Legacy Token Program" },
  ];

  for (const { id: tokenProgram, name: programName } of tokenPrograms) {
    try {
      console.log(`Checking with ${programName}...`);

      const tokenAccount = await getAssociatedTokenAddress(
        FLOWAI_TOKEN_MINT,
        walletPubkey,
        false,
        tokenProgram
      );

      console.log(`  Token account address: ${tokenAccount.toBase58()}`);

      // Check if account exists
      const accountInfo = await connection.getAccountInfo(tokenAccount);

      if (accountInfo) {
        console.log(`  ✅ Token account exists!`);
        console.log(`  Account owner: ${accountInfo.owner.toBase58()}`);
        console.log(`  Account data length: ${accountInfo.data.length} bytes`);

        // Try to get token balance
        try {
          const tokenBalance =
            await connection.getTokenAccountBalance(tokenAccount);
          if (tokenBalance.value) {
            console.log(
              `  💰 Token balance: ${tokenBalance.value.amount} (${tokenBalance.value.uiAmount})`
            );
            console.log(`  Decimals: ${tokenBalance.value.decimals}`);
          } else {
            console.log(`  ❌ Could not get token balance`);
          }
        } catch (balanceError) {
          console.log(`  ❌ Error getting balance: ${balanceError.message}`);
        }
      } else {
        console.log(`  ❌ Token account does not exist`);
      }

      console.log("");
    } catch (error) {
      console.log(`  ❌ Error with ${programName}: ${error.message}`);
      console.log("");
    }
  }

  // Also check the token mint info
  try {
    console.log("Checking token mint info...");
    const mintInfo = await connection.getAccountInfo(FLOWAI_TOKEN_MINT);
    if (mintInfo) {
      console.log(`✅ Token mint exists!`);
      console.log(`Mint owner: ${mintInfo.owner.toBase58()}`);
      console.log(`Data length: ${mintInfo.data.length} bytes`);

      // Try to get mint account balance to see total supply
      try {
        const supply = await connection.getTokenSupply(FLOWAI_TOKEN_MINT);
        console.log(
          `Total supply: ${supply.value.amount} (${supply.value.uiAmount})`
        );
        console.log(`Decimals: ${supply.value.decimals}`);
      } catch (supplyError) {
        console.log(`Could not get supply: ${supplyError.message}`);
      }
    } else {
      console.log(`❌ Token mint does not exist!`);
    }
  } catch (error) {
    console.log(`Error checking mint: ${error.message}`);
  }
}

checkTokenBalance().catch(console.error);
