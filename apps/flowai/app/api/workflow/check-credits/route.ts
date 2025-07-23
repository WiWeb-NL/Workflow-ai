import { type NextRequest, NextResponse } from "next/server";
import { flowaiTokenService } from "@/lib/flowai-tokens";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    // Use proper auth system instead of manual header parsing
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user?.id) {
      return NextResponse.json(
        { canExecute: false, reason: "Authentication required" },
        { status: 401 }
      );
    }

    const hasTokens = await flowaiTokenService.canExecuteWorkflow(
      session.user.id
    );

    if (!hasTokens) {
      return NextResponse.json(
        {
          canExecute: false,
          reason:
            "Insufficient FlowAI tokens: Please purchase tokens to execute workflows",
        },
        { status: 402 }
      );
    }

    return NextResponse.json({ canExecute: true });
  } catch (error) {
    console.error("Error checking credits:", error);
    return NextResponse.json(
      { canExecute: false, reason: "Failed to check credits" },
      { status: 500 }
    );
  }
}
