"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Coins,
  CreditCard,
  History,
  Plus,
  RefreshCw,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/lib/auth-client";
import { createLogger } from "@/lib/logs/console-logger";
import { TokenPurchaseDialog, TokenTransactionHistory } from "./components";

const logger = createLogger("FlowAI-Tokens");

interface FlowAITokensProps {
  onOpenChange: (open: boolean) => void;
}

interface TokenData {
  balance: number;
  lastUpdated: string;
  stats?: {
    totalSpent: number;
    totalPurchased: number;
    executions: number;
  };
  transactions?: Array<{
    id: string;
    type: "charge" | "refund" | "purchase" | "admin_grant";
    amount: number;
    description: string;
    createdAt: string;
    transactionSignature?: string;
  }>;
}

export function FlowAITokens({ onOpenChange }: FlowAITokensProps) {
  const { data: session } = useSession();
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPurchaseDialogOpen, setIsPurchaseDialogOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadTokenData = useCallback(async () => {
    if (!session?.user?.id) {
      setTokenData(null);
      setIsLoading(false);
      return;
    }

    try {
      setError(null);

      const response = await fetch(
        "/api/tokens/flowai?transactions=true&limit=10"
      );
      if (!response.ok) {
        throw new Error(`Failed to load token data: ${response.status}`);
      }

      const data = await response.json();
      setTokenData(data);

      logger.debug("Loaded FlowAI token data:", {
        balance: data.balance,
        transactionCount: data.transactions?.length || 0,
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load token data";
      setError(errorMessage);
      logger.error("Error loading FlowAI token data:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [session?.user?.id]);

  const refreshTokenData = useCallback(async () => {
    setIsRefreshing(true);
    await loadTokenData();
  }, [loadTokenData]);

  useEffect(() => {
    loadTokenData();
  }, [loadTokenData]);

  const handlePurchaseSuccess = useCallback(() => {
    // Refresh token data after successful purchase
    refreshTokenData();
    setIsPurchaseDialogOpen(false);
  }, [refreshTokenData]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-[200px]" />
          <Skeleton className="h-8 w-[150px]" />
        </div>
        <Skeleton className="h-[200px] w-full" />
        <Skeleton className="h-[100px] w-full" />
      </div>
    );
  }

  if (!session?.user) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Please sign in to view your FlowAI token balance.
        </AlertDescription>
      </Alert>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {error}
          <Button
            variant="outline"
            size="sm"
            onClick={refreshTokenData}
            className="ml-2"
            disabled={isRefreshing}
          >
            <RefreshCw
              className={`h-3 w-3 mr-1 ${isRefreshing ? "animate-spin" : ""}`}
            />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const balance = tokenData?.balance ?? 0;
  const canExecuteWorkflow = balance > 0;

  return (
    <div className="space-y-6">
      {/* Token Balance Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            FlowAI Token Balance
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshTokenData}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={`h-3 w-3 mr-1 ${isRefreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <Coins className="h-5 w-5 text-purple-500" />
                <span className="text-2xl font-bold">
                  {balance.toLocaleString()}
                </span>
                <span className="text-sm text-muted-foreground">tokens</span>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant={canExecuteWorkflow ? "default" : "destructive"}>
                  {canExecuteWorkflow
                    ? "Ready to execute"
                    : "Insufficient tokens"}
                </Badge>
              </div>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <p>1 token = 1 workflow execution</p>
              {mounted && tokenData?.lastUpdated && (
                <p>
                  Updated {new Date(tokenData.lastUpdated).toLocaleDateString()}{" "}
                  {new Date(tokenData.lastUpdated).toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Card */}
      {tokenData?.stats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Usage Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-lg font-semibold">
                  {(tokenData.stats?.totalSpent ?? 0).toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">Spent</div>
              </div>
              <div>
                <div className="text-lg font-semibold">
                  {(tokenData.stats?.totalPurchased ?? 0).toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">Purchased</div>
              </div>
              <div>
                <div className="text-lg font-semibold">
                  {(tokenData.stats?.executions ?? 0).toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">Executions</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex flex-col space-y-2">
        <Button
          onClick={() => setIsPurchaseDialogOpen(true)}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Purchase Tokens
        </Button>

        <Button
          variant="outline"
          onClick={() => setIsHistoryOpen(true)}
          className="w-full"
        >
          <History className="h-4 w-4 mr-2" />
          Transaction History
        </Button>
      </div>

      {/* Low Balance Warning */}
      {balance < 5 && balance > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Your token balance is running low. Consider purchasing more tokens
            to avoid workflow execution interruptions.
          </AlertDescription>
        </Alert>
      )}

      {/* No Balance Warning */}
      {balance === 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You have no FlowAI tokens. Purchase tokens to execute workflows.
          </AlertDescription>
        </Alert>
      )}

      {/* Recent Transactions Preview */}
      {tokenData?.transactions && tokenData.transactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Recent Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {tokenData.transactions.slice(0, 3).map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center space-x-2">
                    <Badge
                      variant={tx.type === "charge" ? "destructive" : "default"}
                      className="px-1 py-0 text-xs"
                    >
                      {tx.type}
                    </Badge>
                    <span className="text-muted-foreground">
                      {tx.description}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span
                      className={
                        tx.type === "charge" ? "text-red-500" : "text-green-500"
                      }
                    >
                      {tx.type === "charge" ? "-" : "+"}
                      {tx.amount}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
              {tokenData.transactions.length > 3 && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => setIsHistoryOpen(true)}
                  className="p-0 h-auto text-xs"
                >
                  View all {tokenData.transactions.length} transactions →
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Purchase Dialog */}
      <TokenPurchaseDialog
        isOpen={isPurchaseDialogOpen}
        onClose={() => setIsPurchaseDialogOpen(false)}
        onSuccess={handlePurchaseSuccess}
      />

      {/* Transaction History Dialog */}
      <TokenTransactionHistory
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        transactions={tokenData?.transactions || []}
      />
    </div>
  );
}
