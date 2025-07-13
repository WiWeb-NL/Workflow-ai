// Better Auth type extensions
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

export {};
