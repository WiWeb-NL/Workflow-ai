// Quick test for table handling
const tableData = [
  {
    id: "a122903b-3641-4b42-9ef8-e6038f1a0ee6",
    cells: {
      "Token Mint Address": "FpVBzhuQhY3uT1ijxwHRob4NjXQzbcpg1FsgNNTwwBLV",
    },
  },
  {
    id: "6b77b6f0-40fc-4638-b6ed-4857bc1f57bd",
    cells: {
      "Token Mint Address": "",
    },
  },
  {
    id: "valid-mint",
    cells: {
      "Token Mint Address": "So11111111111111111111111111111111111111112",
    },
  },
];

// Simulate the table handling logic from the block
let tokenMints = [];

if (Array.isArray(tableData)) {
  tokenMints = tableData
    .map((row) => {
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
    .filter((mint) => mint && mint.length > 20) // Basic validation for Solana addresses
    .slice(0, 50); // Limit to prevent abuse
}

console.log("Input table data:");
console.log(JSON.stringify(tableData, null, 2));
console.log("\nExtracted token mints:");
console.log(tokenMints);
console.log("\nExpected result:");
console.log([
  "FpVBzhuQhY3uT1ijxwHRob4NjXQzbcpg1FsgNNTwwBLV",
  "So11111111111111111111111111111111111111112",
]);
console.log(
  "\nTest passed:",
  JSON.stringify(tokenMints) ===
    JSON.stringify([
      "FpVBzhuQhY3uT1ijxwHRob4NjXQzbcpg1FsgNNTwwBLV",
      "So11111111111111111111111111111111111111112",
    ])
);
