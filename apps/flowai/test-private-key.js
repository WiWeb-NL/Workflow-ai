// Quick test script to verify private key handling
const {
  createKeypairFromPrivateKey,
} = require("./lib/solana/wallet-generator.ts");

// Test with the array you provided
const testPrivateKey = [
  240, 25, 162, 32, 239, 42, 249, 215, 27, 100, 226, 58, 201, 234, 5, 125, 252,
  79, 70, 198, 165, 207, 88, 25, 87, 51, 178, 139, 65, 239, 224, 243, 30, 209,
  130, 8, 88, 197, 225, 163, 54, 121, 155, 49, 189, 175, 239, 152, 107, 37, 59,
  61, 217, 194, 12, 4, 64, 9, 45, 34, 70, 85, 3, 47,
];

try {
  console.log("Testing private key array:", testPrivateKey);
  console.log("Array length:", testPrivateKey.length);

  const keypair = createKeypairFromPrivateKey(testPrivateKey, "auto");
  console.log("Success! Public key:", keypair.publicKey.toBase58());
} catch (error) {
  console.error("Error:", error.message);
}
