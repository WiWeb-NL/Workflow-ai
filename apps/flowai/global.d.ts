// Global type declarations for Better Auth extensions

import type { DefaultSession } from "better-auth/types";

declare module "better-auth/types" {
  interface User {
    walletAddress?: string | null;
  }
}

declare module "better-auth" {
  interface User {
    walletAddress?: string | null;
  }
}

declare module "better-auth/react" {
  interface User {
    walletAddress?: string | null;
  }
}

// Extend the session type as well
declare module "better-auth/types" {
  interface Session extends DefaultSession {
    user: User & {
      walletAddress?: string | null;
    };
  }
}

export {};
