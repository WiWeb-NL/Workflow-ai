import { env, isTruthy } from "@/lib/env";
import { getOAuthProviderStatus } from "../components/oauth-provider-checker";
import { PrivyLoginCard } from "@/components/auth/privy-login";
import SignupForm from "./signup-form";

// Force dynamic rendering to avoid prerender errors with search params
export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const { githubAvailable, googleAvailable, isProduction } =
    await getOAuthProviderStatus();

  if (isTruthy(env.DISABLE_REGISTRATION)) {
    return <div>Registration is disabled, please contact your admin.</div>;
  }

  return (
    <div className="container relative grid h-screen flex-col items-center justify-center lg:max-w-none lg:grid-cols-2 lg:px-0">
      <div className="relative hidden h-full flex-col bg-muted p-10 text-white dark:border-r lg:flex">
        <div className="absolute inset-0 bg-zinc-900" />
        <div className="relative z-20 flex items-center text-lg font-medium">
          Visual Workflow AI
        </div>
        <div className="relative z-20 mt-auto">
          <blockquote className="space-y-2">
            <p className="text-lg">
              "Get started with AI workflow automation. Create your account and
              start building powerful agents."
            </p>
          </blockquote>
        </div>
      </div>
      <div className="lg:p-8">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
          <div className="flex flex-col space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">
              Create your account
            </h1>
            <p className="text-sm text-muted-foreground">
              Choose your preferred signup method
            </p>
          </div>

          {/* Privy Signup Card */}
          <PrivyLoginCard />

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with traditional signup
              </span>
            </div>
          </div>

          {/* Traditional Signup Form */}
          <SignupForm
            githubAvailable={githubAvailable}
            googleAvailable={googleAvailable}
            isProduction={isProduction}
          />
        </div>
      </div>
    </div>
  );
}
