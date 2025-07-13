"use client";

import { type ReactNode } from "react";
import PrivyAuthProvider from "@/lib/auth/privy-provider";

interface AuthProvidersProps {
  children: ReactNode;
}

export function AuthProviders({ children }: AuthProvidersProps) {
  return <PrivyAuthProvider>{children}</PrivyAuthProvider>;
}
