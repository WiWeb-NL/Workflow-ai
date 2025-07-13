"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { client } from "@/lib/auth-client";
import { createLogger } from "@/lib/logs/console-logger";

const logger = createLogger("usePrivyAuth");

export interface PrivyAuthUser {
  id: string;
  email?: string;
  name?: string;
  image?: string;
  walletAddress?: string;
}

export function usePrivyAuth() {
  const router = useRouter();
  const {
    user: privyUser,
    authenticated: privyAuthenticated,
    ready,
    login,
    logout,
  } = usePrivy();
  const { data: session, refetch: refetchSession } = client.useSession();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false); // Prevent duplicate sync calls

  // Auto-sync when Privy user becomes authenticated
  useEffect(() => {
    async function handlePrivyAuth() {
      if (
        privyAuthenticated &&
        privyUser &&
        !session?.user &&
        !isAuthenticating &&
        !isSyncing // Prevent duplicate sync calls
      ) {
        logger.info("Privy user authenticated, syncing with Better Auth", {
          privyUserId: privyUser.id,
          email: privyUser.email?.address,
        });

        setIsAuthenticating(true);
        setIsSyncing(true);
        try {
          await syncAuth(privyUser);

          logger.info("Refreshing session after Privy sync");

          let retries = 5;
          let delay = 1000; // Start with 1 second delay
          while (retries > 0) {
            await refetchSession();
            if (session?.user) {
              logger.info("Session successfully refreshed after sync", {
                userId: session.user.id,
                email: session.user.email,
              });
              break;
            }
            logger.warn("Session not found, retrying...", {
              remainingRetries: retries,
              delay,
            });
            await new Promise((resolve) => setTimeout(resolve, delay));
            delay *= 2; // Double the delay for exponential backoff
            retries--;
          }

          if (!session?.user) {
            logger.error("Session refresh failed after multiple attempts", {
              retriesAttempted: 5,
              finalDelay: delay,
            });

            // Fallback: Force a full page reload to reinitialize the session
            logger.warn("Attempting full page reload as a fallback");
            window.location.reload();
            return;
          }

          let callbackUrl =
            sessionStorage.getItem("privy-callback-url") || "/workspace";
          sessionStorage.removeItem("privy-callback-url");

          if (!callbackUrl.startsWith("/")) {
            logger.warn("Invalid callback URL, defaulting to /workspace", {
              callbackUrl,
            });
            callbackUrl = "/workspace";
          }

          logger.info("Redirecting after successful Privy sync", {
            callbackUrl,
            hasSession: !!session?.user,
          });

          window.location.href = callbackUrl;
        } catch (error) {
          logger.error("Failed to sync Privy user with Better Auth:", error);
          setIsAuthenticating(false);
          setIsSyncing(false);
        }
      }
    }

    handlePrivyAuth();
  }, [
    privyAuthenticated,
    privyUser,
    session?.user,
    isAuthenticating,
    isSyncing,
  ]);

  // Sync Better Auth session with Privy user
  const syncAuth = async (privyUser: any) => {
    try {
      // Log the Privy user data to understand its structure
      logger.info("Syncing Privy user - user data:", {
        id: privyUser.id,
        email: privyUser.email,
        emailAddress: privyUser.email?.address,
        google: privyUser.google,
        github: privyUser.github,
        wallet: privyUser.wallet,
        fullUserObject: privyUser,
      });

      // Extract email from various possible sources in Privy user object
      const extractEmail = (privyUser: any): string | null => {
        // Try Google OAuth email first
        if (privyUser.google?.email) return privyUser.google.email;

        // Try GitHub OAuth email
        if (privyUser.github?.email) return privyUser.github.email;

        // Try direct email property
        if (privyUser.email?.address) return privyUser.email.address;
        if (privyUser.email) return privyUser.email;

        // Try linked accounts array
        const emailAccount = privyUser.linkedAccounts?.find(
          (account: any) =>
            account.type === "google_oauth" ||
            account.type === "github_oauth" ||
            account.type === "email"
        );
        if (emailAccount?.email) return emailAccount.email;

        return null;
      };

      const syncData = {
        privyUserId: privyUser.id,
        email: extractEmail(privyUser),
        name:
          privyUser.google?.name ||
          privyUser.github?.name ||
          privyUser.displayName ||
          "User",
        image: privyUser.google?.picture || privyUser.github?.profilePictureUrl,
        walletAddress: privyUser.wallet?.address,
      };

      logger.info("Sending sync data:", syncData);

      // Validate required fields before sending
      if (!syncData.privyUserId) {
        throw new Error("Missing Privy user ID");
      }
      if (!syncData.email) {
        throw new Error("Missing email address");
      }

      // Check if user exists in Better Auth
      const userCheckResponse = await fetch("/api/auth/privy/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(syncData),
      });

      if (!userCheckResponse.ok) {
        const errorText = await userCheckResponse.text();
        logger.error("Sync request failed:", {
          status: userCheckResponse.status,
          statusText: userCheckResponse.statusText,
          error: errorText,
        });
        throw new Error(
          `Failed to sync user with Better Auth: ${userCheckResponse.status} - ${errorText}`
        );
      }

      const result = await userCheckResponse.json();
      logger.info("User synced with Better Auth", result);

      return result;
    } catch (error) {
      logger.error("Error syncing user with Better Auth:", error);
      throw error;
    }
  };

  const handleLogin = async (callbackUrl?: string) => {
    try {
      await login();
      // The useEffect will handle syncing automatically
      // Just set the callback URL for after sync completes
      if (callbackUrl) {
        sessionStorage.setItem("privy-callback-url", callbackUrl);
      }
    } catch (error) {
      logger.error("Error during Privy login:", error);
      throw error;
    }
  };

  const handleLogout = async () => {
    try {
      // Sign out from Better Auth first
      await client.signOut();

      // Then sign out from Privy
      await logout();

      router.push("/login");
    } catch (error) {
      logger.error("Error during logout:", error);
      throw error;
    }
  };

  // Determine the final authenticated state
  // User is considered authenticated if they have both Privy and Better Auth sessions
  const isAuthenticated = privyAuthenticated && !!session;

  // Combine user data from both sources
  const combinedUser: PrivyAuthUser | null = session?.user
    ? {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        image: session.user.image || undefined,
        walletAddress: privyUser?.wallet?.address,
      }
    : null;

  return {
    user: combinedUser,
    authenticated: isAuthenticated,
    privyAuthenticated,
    betterAuthSession: session,
    ready: ready && !isAuthenticating,
    isAuthenticating,
    login: handleLogin,
    logout: handleLogout,
    syncAuth,
  };
}
