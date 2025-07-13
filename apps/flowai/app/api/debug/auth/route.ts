import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { createLogger } from "@/lib/logs/console-logger";
import { db } from "@/db";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";

const logger = createLogger("AuthDebug");

export async function GET(request: NextRequest) {
  try {
    // Get all cookies
    const allCookies: Record<string, string> = {};
    request.cookies.getAll().forEach((cookie) => {
      allCookies[cookie.name] = cookie.value;
    });

    // Try to get session using Better Auth
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    // Get session directly from database if we have a token
    let dbSession = null;
    const sessionToken =
      allCookies["better-auth.session_token"] || allCookies["session"];

    if (sessionToken) {
      const dbSessions = await db
        .select()
        .from(schema.session)
        .where(eq(schema.session.token, sessionToken))
        .limit(1);

      if (dbSessions.length > 0) {
        dbSession = dbSessions[0];
      }
    }

    logger.info("Auth debug results", {
      hasBetterAuthSession: !!session,
      cookieNames: Object.keys(allCookies),
      sessionToken: sessionToken ? sessionToken.substring(0, 8) + "..." : null,
      hasDbSession: !!dbSession,
      dbSessionUserId: dbSession?.userId,
      betterAuthUserId: session?.user?.id,
    });

    return NextResponse.json({
      success: true,
      betterAuth: {
        hasSession: !!session,
        userId: session?.user?.id,
        email: session?.user?.email,
      },
      database: {
        hasSession: !!dbSession,
        userId: dbSession?.userId,
        sessionId: dbSession?.id,
        expiresAt: dbSession?.expiresAt,
      },
      cookies: {
        count: Object.keys(allCookies).length,
        names: Object.keys(allCookies),
        hasSessionToken: !!sessionToken,
      },
    });
  } catch (error) {
    logger.error("Auth debug error:", error);
    return NextResponse.json({ error: "Auth debug failed" }, { status: 500 });
  }
}
