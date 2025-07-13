"use client";

import { WalletCard } from "@/components/wallet/wallet-card";
import { useExtendedSession, hasUser } from "@/hooks/use-extended-session";

export default function WalletDemoPage() {
  const { data: session } = useExtendedSession();

  if (!hasUser(session)) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Solana Wallet Demo</h1>
          <p className="text-muted-foreground">
            Please sign in to view your Solana wallet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">Solana Wallet Integration</h1>
          <p className="text-muted-foreground">
            Your automatically generated Solana wallet is ready to use.
          </p>
        </div>

        <div className="flex justify-center">
          <WalletCard />
        </div>

        <div className="bg-muted p-6 rounded-lg">
          <h2 className="text-lg font-semibold mb-3">How it works:</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              • When you create an account, a Solana wallet is automatically
              generated
            </li>
            <li>• Your wallet address is stored securely in our database</li>
            <li>• You can view and copy your wallet address anytime</li>
            <li>
              • Private keys are generated client-side for maximum security
            </li>
            <li>• Compatible with all Solana DApps and services</li>
          </ul>
        </div>

        <div className="bg-blue-50 dark:bg-blue-950 p-6 rounded-lg">
          <h2 className="text-lg font-semibold mb-3">Development Notes:</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              • Wallet creation happens automatically in the user creation hook
            </li>
            <li>
              • Fallback API endpoint available for manual wallet creation
            </li>
            <li>• React hook provides easy wallet management functionality</li>
            <li>• Full test coverage for wallet generation and validation</li>
            <li>• Ready for integration with Solana DApp features</li>
          </ul>
        </div>

        {session.user.walletAddress && (
          <div className="bg-green-50 dark:bg-green-950 p-6 rounded-lg">
            <h2 className="text-lg font-semibold mb-3">✅ Wallet Status:</h2>
            <p className="text-sm text-muted-foreground">
              Your account already has a Solana wallet configured:{" "}
              {session.user.walletAddress}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
