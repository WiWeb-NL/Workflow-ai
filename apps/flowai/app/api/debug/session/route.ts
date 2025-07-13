import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { createLogger } from "@/lib/logs/console-logger";

const logger = createLogger("SessionDebug");

export async function GET(request: NextRequest) {
  try {
    logger.info("Debug: Checking session", {
      cookies: Object.fromEntries(
        request.cookies.getAll().map((cookie) => [cookie.name, cookie.value])
      ),
    });

    // Try to get session using Better Auth
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    logger.info("Debug: Better Auth session result", {
      hasSession: !!session,
      session: session
        ? {
            user: session.user
              ? {
                  id: session.user.id,
                  email: session.user.email,
                  name: session.user.name,
                }
              : null,
            sessionId: session.session?.id,
          }
        : null,
    });

    return NextResponse.json({
      success: true,
      hasSession: !!session,
      session: session
        ? {
            user: session.user,
            sessionId: session.session?.id,
          }
        : null,
      cookies: Object.fromEntries(
        request.cookies.getAll().map((cookie) => [cookie.name, cookie.value])
      ),
    });
  } catch (error) {
    logger.error("Debug: Session check error:", error);
    return NextResponse.json(
      {
        error: "Failed to check session",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
