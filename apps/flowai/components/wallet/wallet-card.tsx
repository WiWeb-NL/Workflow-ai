"use client";

import { useState } from "react";
import { Copy, Wallet, RefreshCw, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useUserWallet } from "@/hooks/use-user-wallet";

export function WalletCard() {
  const { walletInfo, loading, error, createWallet, refreshWallet } =
    useUserWallet();
  const [copied, setCopied] = useState(false);

  const handleCopyAddress = async () => {
    if (!walletInfo?.walletAddress) return;

    try {
      await navigator.clipboard.writeText(walletInfo.walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy address:", err);
    }
  };

  const formatAddress = (address: string) => {
    if (address.length <= 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Solana Wallet
        </CardTitle>
        <CardDescription>
          Your automatically generated Solana wallet address
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-4">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="ml-2">Loading...</span>
          </div>
        ) : walletInfo?.hasWallet ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {formatAddress(walletInfo.walletAddress!)}
                </p>
                <p className="text-xs text-muted-foreground">Wallet Address</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopyAddress}
                className="ml-2 shrink-0"
              >
                <Copy className="h-3 w-3" />
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={refreshWallet}
              className="w-full"
            >
              <RefreshCw className="h-3 w-3 mr-2" />
              Refresh
            </Button>
          </div>
        ) : (
          <div className="text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              No wallet found. This usually happens automatically when you
              create an account.
            </p>
            <Button
              onClick={createWallet}
              disabled={loading}
              className="w-full"
            >
              <Plus className="h-3 w-3 mr-2" />
              Create Wallet
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
