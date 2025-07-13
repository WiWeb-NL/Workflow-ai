"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
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
  const { data: session } = client.useSession();

  // Sync Better Auth session with Privy user
  const syncAuth = async (privyUser: any) => {
    try {
      // Check if user exists in Better Auth
      const userCheckResponse = await fetch("/api/auth/privy/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          privyUserId: privyUser.id,
          email: privyUser.email?.address,
          name: privyUser.google?.name || privyUser.github?.name || "User",
          image:
            privyUser.google?.picture || privyUser.github?.profilePictureUrl,
          walletAddress: privyUser.wallet?.address,
        }),
      });

      if (!userCheckResponse.ok) {
        throw new Error("Failed to sync user with Better Auth");
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

      if (privyUser) {
        await syncAuth(privyUser);
        router.push(callbackUrl || "/workspace");
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
    ready,
    login: handleLogin,
    logout: handleLogout,
    syncAuth,
  };
}
