"use client";

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePrivyAuth } from "@/lib/auth/use-privy-auth";
import { createLogger } from "@/lib/logs/console-logger";

const logger = createLogger("PrivyLoginButton");

interface PrivyLoginButtonProps {
  callbackUrl?: string;
  className?: string;
}

export function PrivyLoginButton({
  callbackUrl,
  className,
}: PrivyLoginButtonProps) {
  const { login } = usePrivy();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      await login();
    } catch (error) {
      logger.error("Error during Privy login:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleLogin}
      disabled={isLoading}
      className={className}
      variant="default"
    >
      {isLoading ? "Connecting..." : "Connect with Privy"}
    </Button>
  );
}

export function PrivyLoginCard({ callbackUrl }: { callbackUrl?: string }) {
  const { authenticated, user } = usePrivyAuth();

  if (authenticated && user) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome back!</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Signed in as: {user.email}
            </p>
            {user.walletAddress && (
              <p className="text-sm text-muted-foreground">
                Wallet: {user.walletAddress.slice(0, 6)}...
                {user.walletAddress.slice(-4)}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Sign in to continue</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Connect your account and get access to Web3 features including
            embedded wallets.
          </p>
          <PrivyLoginButton callbackUrl={callbackUrl} className="w-full" />
        </div>
      </CardContent>
    </Card>
  );
}
