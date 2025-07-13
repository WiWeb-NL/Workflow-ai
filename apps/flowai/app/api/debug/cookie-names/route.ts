import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { createLogger } from "@/lib/logs/console-logger";

const logger = createLogger("CookieNameTest");

export async function GET(request: NextRequest) {
  try {
    // Check what Better Auth looks for in cookies
    const allCookies: Record<string, string> = {};
    request.cookies.getAll().forEach((cookie) => {
      allCookies[cookie.name] = cookie.value;
    });

    // Get session to see what Better Auth actually reads
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    // Check Better Auth's expected cookie name by examining the source
    const cookieHeader = request.headers.get("cookie");

    logger.info("Cookie analysis", {
      allCookies: Object.keys(allCookies),
      cookieHeader,
      hasSession: !!session,
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json({
      cookieNames: Object.keys(allCookies),
      cookieValues: allCookies,
      hasSession: !!session,
      sessionUserId: session?.user?.id,
      cookieHeader,
    });
  } catch (error) {
    logger.error("Cookie name test error:", error);
    return NextResponse.json(
      { error: "Failed to test cookies" },
      { status: 500 }
    );
  }
}
