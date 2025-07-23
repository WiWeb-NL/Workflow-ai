"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Coins, Loader2, Wallet } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { createLogger } from "@/lib/logs/console-logger";

const logger = createLogger("Token-Purchase-Dialog");

interface TokenPurchaseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface PricingTier {
  id: string;
  name: string;
  tokenAmount: number;
  solPrice: number;
  bonusTokens: number;
  popular?: boolean;
}

interface SolanaWallet {
  address: string;
  hasPrivateKey: boolean;
  solBalance?: number;
  flowaiTokenBalance?: number;
}

interface SolPriceInfo {
  currentPrice: number;
  priceChange24h: number;
  lastUpdated: string;
}

const DEFAULT_PRICING: PricingTier[] = [
  {
    id: "starter_100",
    name: "Starter Pack",
    tokenAmount: 100,
    solPrice: 0.054, // ~$10
    bonusTokens: 0,
  },
  {
    id: "basic_500",
    name: "Basic Pack",
    tokenAmount: 500,
    solPrice: 0.27, // ~$50
    bonusTokens: 50,
    popular: true,
  },
  {
    id: "pro_1000",
    name: "Pro Pack",
    tokenAmount: 1000,
    solPrice: 0.54, // ~$100
    bonusTokens: 150,
  },
  {
    id: "enterprise_5000",
    name: "Enterprise Pack",
    tokenAmount: 5000,
    solPrice: 2.16, // ~$400
    bonusTokens: 1000,
  },
];

export function TokenPurchaseDialog({
  isOpen,
  onClose,
  onSuccess,
}: TokenPurchaseDialogProps) {
  const [pricing, setPricing] = useState<PricingTier[]>(DEFAULT_PRICING);
  const [wallet, setWallet] = useState<SolanaWallet | null>(null);
  const [solPriceInfo, setSolPriceInfo] = useState<SolPriceInfo | null>(null);
  const [selectedTier, setSelectedTier] = useState<PricingTier | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<
    "select" | "payment" | "processing" | "success"
  >("select");

  const loadPricingAndWallet = useCallback(async () => {
    if (!isOpen) return;

    try {
      setIsLoading(true);
      setError(null);

      // Load pricing tiers
      const pricingResponse = await fetch("/api/tokens/flowai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_pricing" }),
      });

      if (pricingResponse.ok) {
        const pricingData = await pricingResponse.json();
        if (pricingData.pricing && pricingData.pricing.length > 0) {
          setPricing(pricingData.pricing);
        }
        // Set SOL price info if available
        if (pricingData.solPriceInfo) {
          setSolPriceInfo(pricingData.solPriceInfo);
        }
      }

      // Load wallet info
      const walletResponse = await fetch("/api/tokens/flowai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_wallet" }),
      });

      if (walletResponse.ok) {
        const walletData = await walletResponse.json();
        setWallet(walletData.wallet);
      } else if (walletResponse.status === 404) {
        // No wallet found - user needs to set up Solana wallet
        setError(
          "No Solana wallet found. Please set up a Solana wallet in your account settings."
        );
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load purchase options";
      setError(errorMessage);
      logger.error("Error loading pricing and wallet:", err);
    } finally {
      setIsLoading(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      loadPricingAndWallet();
      setStep("select");
      setSelectedTier(null);
      setError(null);
    }
  }, [isOpen, loadPricingAndWallet]);

  const handleTierSelect = (tier: PricingTier) => {
    setSelectedTier(tier);
    setStep("payment");
  };

  const handlePaymentConfirm = async (
    paymentMethod: "SOL" | "FLOWAI_TOKEN"
  ) => {
    if (!selectedTier || !wallet?.hasPrivateKey) return;

    try {
      setStep("processing");
      setError(null);

      // Calculate FlowAI tokens needed for FLOWAI payment method
      const calculateFlowAITokensNeeded = (credits: number) => {
        if (!solPriceInfo) return credits; // Fallback to 1:1 if no price info
        const creditsPerSol = solPriceInfo.currentPrice / 0.1; // How many credits per SOL
        const flowaiTokensPerCredit = 3000000 / creditsPerSol; // FlowAI tokens needed per credit
        return Math.floor(credits * flowaiTokensPerCredit);
      };

      const paymentAmount =
        paymentMethod === "SOL"
          ? selectedTier.solPrice
          : calculateFlowAITokensNeeded(selectedTier.tokenAmount); // Calculate actual FlowAI tokens needed

      const response = await fetch("/api/tokens/flowai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "purchase_tokens",
          pricingTierId: selectedTier.id,
          paymentCurrency: paymentMethod,
          paymentAmount,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Purchase failed");
      }

      logger.info("Token purchase successful", {
        tier: selectedTier.id,
        paymentMethod,
        signature: data.transactionSignature,
      });

      setStep("success");

      // Auto-close and trigger success callback after delay
      setTimeout(() => {
        onSuccess();
        setStep("select");
      }, 2000);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Payment failed";
      setError(errorMessage);
      setStep("payment");
      logger.error("Payment processing error:", err);
    }
  };

  const renderSelectStep = () => (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Choose a credit package or enter a custom amount:
      </div>

      {/* SOL Price Info */}
      {solPriceInfo && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium text-blue-900">
              Live SOL Price: ${solPriceInfo.currentPrice.toFixed(2)}
            </span>
            <span
              className={`text-xs ${
                solPriceInfo.priceChange24h >= 0
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {solPriceInfo.priceChange24h >= 0 ? "+" : ""}
              {solPriceInfo.priceChange24h.toFixed(2)}% (24h)
            </span>
          </div>
          <div className="text-xs text-blue-700 mt-1">
            Updated: {new Date(solPriceInfo.lastUpdated).toLocaleTimeString()}
          </div>
        </div>
      )}

      {/* Predefined Tiers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {pricing.map((tier) => (
          <Card
            key={tier.id}
            className={`cursor-pointer transition-all hover:shadow-md ${
              tier.popular ? "ring-2 ring-purple-500 relative" : ""
            }`}
            onClick={() => handleTierSelect(tier)}
          >
            {tier.popular && (
              <Badge className="absolute -top-2 left-4 bg-purple-500">
                Popular
              </Badge>
            )}
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{tier.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">
                    {tier.tokenAmount.toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground">credits</span>
                </div>
                {tier.bonusTokens > 0 && (
                  <div className="flex items-center justify-between text-green-600">
                    <span className="text-sm">+{tier.bonusTokens} bonus</span>
                    <Badge variant="secondary" className="text-xs">
                      Free
                    </Badge>
                  </div>
                )}
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="font-medium">{tier.solPrice} SOL</span>
                  <span className="text-xs text-muted-foreground">
                    ≈ {tier.tokenAmount + tier.bonusTokens} total credits
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderPaymentStep = () => (
    <div className="space-y-4">
      {selectedTier && (
        <>
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold">{selectedTier.name}</h3>
            <div className="text-2xl font-bold text-purple-600">
              {selectedTier.tokenAmount.toLocaleString()} tokens
            </div>
            {selectedTier.bonusTokens > 0 && (
              <div className="text-green-600">
                + {selectedTier.bonusTokens} bonus tokens
              </div>
            )}
          </div>

          <Separator />

          {wallet && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Wallet className="h-4 w-4" />
                <span className="font-medium">Payment Wallet</span>
              </div>
              <div className="bg-muted p-3 rounded-lg space-y-2">
                <div className="font-mono text-sm">{wallet.address}</div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>
                    SOL Balance: {wallet.solBalance?.toFixed(4) ?? "0.0000"} SOL
                  </div>
                  <div>
                    FlowAI Balance:{" "}
                    {(wallet.flowaiTokenBalance ?? 0).toLocaleString()} FLOWAI
                  </div>
                </div>
              </div>

              {/* Payment Method Selection */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">
                  Choose Payment Method
                </Label>

                {/* SOL Payment */}
                <Card
                  className="cursor-pointer "
                  onClick={() => handlePaymentConfirm("SOL")}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div>
                          <div className="font-medium">Pay with SOL</div>
                          <div className="text-sm text-muted-foreground">
                            Native Solana token
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">
                          {selectedTier.solPrice} SOL
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {(wallet.solBalance ?? 0) >= selectedTier.solPrice ? (
                            <span className="text-green-600">
                              ✓ Sufficient balance
                            </span>
                          ) : (
                            <span className="text-red-600">
                              ✗ Insufficient balance
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* FlowAI Token Payment */}
                <Card
                  className="cursor-pointer"
                  onClick={() => handlePaymentConfirm("FLOWAI_TOKEN")}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div>
                          <div className="font-medium">
                            Pay with FlowAI Tokens
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Use existing FlowAI tokens
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">
                          {solPriceInfo
                            ? (() => {
                                const creditsPerSol =
                                  solPriceInfo.currentPrice / 0.1;
                                const flowaiTokensPerCredit =
                                  3000000 / creditsPerSol;
                                const tokensNeeded = Math.floor(
                                  selectedTier.tokenAmount *
                                    flowaiTokensPerCredit
                                );
                                return `${tokensNeeded.toLocaleString()} FLOWAI`;
                              })()
                            : `${selectedTier.tokenAmount.toLocaleString()} FLOWAI`}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {(() => {
                            if (!solPriceInfo) return null;
                            const creditsPerSol =
                              solPriceInfo.currentPrice / 0.1;
                            const flowaiTokensPerCredit =
                              3000000 / creditsPerSol;
                            const tokensNeeded = Math.floor(
                              selectedTier.tokenAmount * flowaiTokensPerCredit
                            );
                            return (wallet.flowaiTokenBalance ?? 0) >=
                              tokensNeeded ? (
                              <span className="text-green-600">
                                ✓ Sufficient balance
                              </span>
                            ) : (
                              <span className="text-red-600">
                                ✗ Insufficient balance
                              </span>
                            );
                          })() ||
                            ((wallet.flowaiTokenBalance ?? 0) >=
                            selectedTier.tokenAmount ? (
                              <span className="text-green-600">
                                ✓ Sufficient balance
                              </span>
                            ) : (
                              <span className="text-red-600">
                                ✗ Insufficient balance
                              </span>
                            ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Select a payment method above. The transaction will be signed
                  with your wallet's private key.
                </AlertDescription>
              </Alert>
            </div>
          )}

          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={() => setStep("select")}
              className="flex-1"
            >
              Back
            </Button>
          </div>
        </>
      )}
    </div>
  );

  const renderProcessingStep = () => (
    <div className="text-center space-y-4 py-8">
      <Loader2 className="h-8 w-8 animate-spin mx-auto" />
      <h3 className="text-lg font-semibold">Processing Payment</h3>
      <p className="text-muted-foreground">
        Please wait while we process your Solana payment...
      </p>
    </div>
  );

  const renderSuccessStep = () => (
    <div className="text-center space-y-4 py-8">
      <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
        <Coins className="h-6 w-6 text-green-600" />
      </div>
      <h3 className="text-lg font-semibold text-green-600">
        Purchase Successful!
      </h3>
      <p className="text-muted-foreground">
        {selectedTier &&
          `${(selectedTier.tokenAmount + selectedTier.bonusTokens).toLocaleString()} FlowAI tokens have been added to your account.`}
      </p>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Purchase Credits</DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Loading purchase options...
          </div>
        ) : (
          <div className="space-y-4">
            {step === "select" && renderSelectStep()}
            {step === "payment" && renderPaymentStep()}
            {step === "processing" && renderProcessingStep()}
            {step === "success" && renderSuccessStep()}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
