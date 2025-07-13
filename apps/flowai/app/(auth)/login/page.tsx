import { getOAuthProviderStatus } from "../components/oauth-provider-checker";
import { PrivyLoginCard } from "@/components/auth/privy-login";
import LoginForm from "./login-form";

// Force dynamic rendering to avoid prerender errors with search params
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const { githubAvailable, googleAvailable, isProduction } =
    await getOAuthProviderStatus();

  return (
    <div className="container relative grid h-screen flex-col items-center justify-center lg:max-w-none lg:grid-cols-2 lg:px-0">
      <div className="lg:p-8">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
          <div className="flex flex-col space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">
              Sign in to your account
            </h1>
            <p className="text-sm text-muted-foreground">
              Choose your preferred sign-in method
            </p>
          </div>

          {/* Privy Login Card */}
          <PrivyLoginCard />

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with traditional login
              </span>
            </div>
          </div>

          {/* Traditional Login Form */}
          <LoginForm
            githubAvailable={githubAvailable}
            googleAvailable={googleAvailable}
            isProduction={isProduction}
          />
        </div>
      </div>
    </div>
  );
}
