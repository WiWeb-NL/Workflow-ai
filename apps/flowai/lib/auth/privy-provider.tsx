"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { useCallback, type PropsWithChildren } from "react";
import { env } from "@/lib/env";
import { client } from "@/lib/auth-client";
import { createLogger } from "@/lib/logs/console-logger";

const logger = createLogger("PrivyAuthProvider");

const PrivyAuthProvider: React.FC<PropsWithChildren> = ({ children }) => {
  // Get auth details from Better Auth
  const { data: session } = client.useSession();

  // Create a callback to get the token from Better Auth
  const getCustomToken = useCallback(async () => {
    try {
      // Only try to get token if user is authenticated
      if (!session?.user) {
        logger.info("No authenticated session, skipping token request");
        return undefined;
      }

      // Get the JWT token from Better Auth
      const response = await fetch("/api/auth/token", {
        method: "GET",
        credentials: "include", // Include cookies for session
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        logger.warn("Failed to get auth token from Better Auth", {
          status: response.status,
          statusText: response.statusText,
        });
        return undefined;
      }

      const data = await response.json();
      logger.info("Successfully retrieved auth token for Privy", {
        hasToken: !!data.token,
        tokenPreview: data.token ? `${data.token.substring(0, 10)}...` : null,
      });
      return data.token;
    } catch (error) {
      logger.error("Error getting auth token:", error);
      return undefined;
    }
  }, [session?.user]);

  // Don't render Privy if no app ID is configured
  if (!env.NEXT_PUBLIC_PRIVY_APP_ID) {
    logger.warn(
      "NEXT_PUBLIC_PRIVY_APP_ID not configured, skipping Privy provider"
    );
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={env.NEXT_PUBLIC_PRIVY_APP_ID}
      config={{
        customAuth: {
          // Indicates if Better Auth is currently updating auth state
          isLoading: !session && session !== null, // Loading if session is undefined
          // Callback to get the user's JWT token from Better Auth
          getCustomAccessToken: getCustomToken,
        },
        // Configure appearance
        appearance: {
          theme: "dark",
          accentColor: "#676FFF",
          logo: "/logo-sim.svg",
        },
        // Configure login methods
        loginMethods: ["email", "google", "github"],
        // Configure embedded wallets
        embeddedWallets: {
          createOnLogin: "users-without-wallets",
          requireUserPasswordOnCreate: false,
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
};

export default PrivyAuthProvider;
