import { type NextRequest, NextResponse } from "next/server";
import { flowaiTokenService } from "@/lib/flowai-tokens";
import { headers } from "next/headers";

async function getUserIdFromRequest(): Promise<string | null> {
  try {
    // Try to get user ID from auth headers - this is a simplified approach
    // In a real app, you'd validate the session token properly
    const headersList = await headers();
    const authHeader = headersList.get("authorization");

    if (authHeader) {
      // This is a simplified extraction - in production you'd validate the JWT properly
      // For now, assume it's in the format "Bearer userId"
      const userId = authHeader.split(" ")[1];
      return userId;
    }

    return null;
  } catch (error) {
    console.error("Error extracting user ID:", error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest();

    if (!userId) {
      return NextResponse.json(
        { canExecute: false, reason: "Authentication required" },
        { status: 401 }
      );
    }

    const hasTokens = await flowaiTokenService.canExecuteWorkflow(userId);

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
