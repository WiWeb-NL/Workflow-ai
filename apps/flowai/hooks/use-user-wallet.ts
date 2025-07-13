import { useState, useEffect } from "react";
import { useSession } from "@/lib/auth-client";

interface WalletInfo {
  walletAddress: string | null;
  hasWallet: boolean;
}

interface UseWalletReturn {
  walletInfo: WalletInfo | null;
  loading: boolean;
  error: string | null;
  createWallet: () => Promise<void>;
  refreshWallet: () => Promise<void>;
}

/**
 * Hook for managing user's Solana wallet
 */
export function useUserWallet(): UseWalletReturn {
  const { data: session } = useSession();
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch wallet information
  const fetchWallet = async () => {
    if (!session?.user?.id) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/wallet", {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch wallet information");
      }

      const data = await response.json();
      setWalletInfo(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Create a new wallet
  const createWallet = async () => {
    if (!session?.user?.id) {
      setError("User not authenticated");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/wallet", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create wallet");
      }

      const data = await response.json();
      setWalletInfo({
        walletAddress: data.walletAddress,
        hasWallet: true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Refresh wallet information
  const refreshWallet = async () => {
    await fetchWallet();
  };

  // Fetch wallet info when user session changes
  useEffect(() => {
    if (session?.user?.id) {
      fetchWallet();
    } else {
      setWalletInfo(null);
    }
  }, [session?.user?.id]);

  return {
    walletInfo,
    loading,
    error,
    createWallet,
    refreshWallet,
  };
}
