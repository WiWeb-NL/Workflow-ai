"use client";

import { usePrivyAuth } from "./use-privy-auth";
import { client } from "@/lib/auth-client";

export function useIntegratedAuth() {
  const privyAuth = usePrivyAuth();
  const betterAuthSession = client.useSession();

  // If Privy is enabled and authenticated, use the integrated auth
  if (privyAuth.ready && privyAuth.authenticated) {
    return {
      ...privyAuth,
      isPending: false,
      error: null,
    };
  }

  // Fallback to Better Auth session for traditional login
  return {
    user: betterAuthSession.data?.user
      ? {
          id: betterAuthSession.data.user.id,
          email: betterAuthSession.data.user.email,
          name: betterAuthSession.data.user.name,
          image: betterAuthSession.data.user.image || undefined,
        }
      : null,
    authenticated: !!betterAuthSession.data?.user,
    privyAuthenticated: false,
    betterAuthSession: betterAuthSession.data,
    ready: !betterAuthSession.isPending,
    isPending: betterAuthSession.isPending,
    error: betterAuthSession.error,
    login: async (callbackUrl?: string) => {
      // Redirect to login page for traditional auth
      window.location.href = `/login${callbackUrl ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`;
    },
    logout: async () => {
      await client.signOut();
      window.location.href = "/login";
    },
    syncAuth: async () => {
      // No-op for traditional auth
    },
  };
}
