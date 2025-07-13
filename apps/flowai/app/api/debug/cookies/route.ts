import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { createLogger } from "@/lib/logs/console-logger";

const logger = createLogger("CookieTest");

export async function GET(request: NextRequest) {
  try {
    // Test what cookie name Better Auth expects
    const sessionCookie = getSessionCookie(request);

    // Log all cookies to see what's available
    const allCookies: Record<string, string> = {};
    request.cookies.getAll().forEach((cookie) => {
      allCookies[cookie.name] = cookie.value;
    });

    logger.info("Cookie test results", {
      sessionCookie,
      allCookies,
      cookieNames: Object.keys(allCookies),
    });

    return NextResponse.json({
      sessionCookie,
      allCookies: Object.keys(allCookies),
      hasSessionCookie: !!sessionCookie,
    });
  } catch (error) {
    logger.error("Cookie test error:", error);
    return NextResponse.json({ error: "Cookie test failed" }, { status: 500 });
  }
}
