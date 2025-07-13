import { useSession as useBetterAuthSession } from "@/lib/auth-client";

// Extended user type that includes walletAddress
export interface ExtendedUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  createdAt: Date;
  updatedAt: Date;
  stripeCustomerId?: string | null;
  walletAddress?: string | null;
}

export interface ExtendedSession {
  user: ExtendedUser;
  session: any;
}

/**
 * Hook that returns session data with properly typed user including walletAddress
 */
export function useExtendedSession() {
  const { data: session, ...rest } = useBetterAuthSession();

  return {
    data: session as ExtendedSession | null,
    ...rest,
  };
}

/**
 * Type guard to check if session has user data
 */
export function hasUser(
  session: ExtendedSession | null
): session is ExtendedSession {
  return session?.user != null;
}
