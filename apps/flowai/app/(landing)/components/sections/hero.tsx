"use client";

import { useEffect, useState } from "react";
import { Command, CornerDownLeft, Copy, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth-client";
import { GridPattern } from "../grid-pattern";
import HeroWorkflowProvider from "../hero-workflow";

function Hero() {
  const router = useRouter();
  const [isTransitioning, setIsTransitioning] = useState(true);
  const [copied, setCopied] = useState(false);
  const { data: session, isPending } = useSession();
  const isAuthenticated = !isPending && !!session?.user;

  const CA_VALUE = "FpVBzhuQhY3uT1ijxwHRob4NjXQzbcpg1FsgNNTwwBLV";

  const handleNavigate = () => {
    if (typeof window !== "undefined") {
      // Check if user has an active session
      if (isAuthenticated) {
        router.push("/workspace");
      } else {
        // Check if user has logged in before
        const hasLoggedInBefore =
          localStorage.getItem("has_logged_in_before") === "true" ||
          document.cookie.includes("has_logged_in_before=true");

        if (hasLoggedInBefore) {
          // User has logged in before but doesn't have an active session
          router.push("/login");
        } else {
          // User has never logged in before
          router.push("/signup");
        }
      }
    }
  };

  const handleCopyCA = async () => {
    try {
      await navigator.clipboard.writeText(CA_VALUE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy CA value:", err);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        handleNavigate();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAuthenticated]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsTransitioning(false);
    }, 300); // Reduced delay for faster button appearance
    return () => clearTimeout(timer);
  }, []);

  const renderActionUI = () => {
    if (isTransitioning || isPending) {
      return <div className="h-[56px] md:h-[64px]" />;
    }
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg bg-neutral-800/50 border border-neutral-700/50 p-3">
            <code className="text-sm text-neutral-200 font-mono break-all">
              CA:
            </code>
            <code className="text-sm text-neutral-200 font-mono break-all">
              {CA_VALUE}
            </code>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyCA}
              className="h-8 w-8 p-0 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700/50"
              aria-label="Copy CA value to clipboard"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-400" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          {copied && (
            <span className="text-xs text-green-400 animate-fade-in">
              Copied to clipboard!
            </span>
          )}
        </div>{" "}
        <Button
          variant={"secondary"}
          onClick={handleNavigate}
          className="animate-fade-in items-center bg-[#701ffc] px-7 py-6 font-[420] font-geist-sans text-lg text-neutral-100 tracking-normal shadow-[#701ffc]/30 shadow-lg hover:bg-[#802FFF]"
          aria-label="Start using the platform"
        >
          <div className="text-[1.15rem]">Login / Register</div>
        </Button>
      </div>
    );
  };

  return (
    <section
      className="animation-container relative min-h-screen overflow-hidden border-[#181818] border-b pt-28 text-white will-change-[opacity,transform] sm:pt-32 md:pt-40"
      aria-label="Main hero section"
    >
      <GridPattern
        x={-5}
        y={-5}
        className="absolute inset-0 z-0 stroke-[#ababab]/5"
        width={90}
        height={90}
        aria-hidden="true"
      />

      {/* Centered black background behind text and button */}
      <div
        className="-translate-x-1/2 -translate-y-1/2 absolute top-[28%] left-1/2 w-[95%] md:top-[38%] md:w-[60%] lg:w-[50%]"
        aria-hidden="true"
      >
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 600 480"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
          className="aspect-[5/3] h-auto md:aspect-auto"
        >
          <g filter="url(#filter0_b_0_1)">
            <ellipse cx="300" cy="240" rx="290" ry="220" fill="#0C0C0C" />
          </g>
          <defs>
            <filter
              id="filter0_b_0_1"
              x="0"
              y="10"
              width="600"
              height="460"
              filterUnits="userSpaceOnUse"
              colorInterpolationFilters="sRGB"
            >
              <feGaussianBlur stdDeviation="5" />
            </filter>
          </defs>
        </svg>
      </div>

      <div
        className="absolute inset-0 z-10 flex h-full items-center justify-center"
        aria-hidden="true"
      >
        <HeroWorkflowProvider />
      </div>

      <div className="animation-container relative z-20 space-y-4 px-4 text-center">
        <h1 className="animation-container animate-fade-up font-semibold text-[42px] leading-[1.10] opacity-0 will-change-[opacity,transform] [animation-delay:200ms] md:text-[68px]">
          Build powerful no-code AI workflows
          <br />
          with $FlowAI
        </h1>

        <p className="animation-container mx-auto max-w-3xl animate-fade-up font-normal text-base text-neutral-400/80 leading-[1.5] tracking-normal opacity-0 will-change-[opacity,transform] [animation-delay:400ms] md:text-xl">
          Connect nodes, tools and AI agents to scale fast.
        </p>

        <div className="animation-container translate-y-[-10px] animate-fade-up pt-4 pb-10 opacity-0 will-change-[opacity,transform] [animation-delay:600ms]">
          {renderActionUI()}
        </div>
      </div>
    </section>
  );
}

export default Hero;
