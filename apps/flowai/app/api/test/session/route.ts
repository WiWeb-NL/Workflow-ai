import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { auth } from "@/lib/auth";
import { createLogger } from "@/lib/logs/console-logger";

const logger = createLogger("SessionTest");

export async function GET(request: NextRequest) {
  try {
    // Get all sessions from database
    const allSessions = await db
      .select()
      .from(schema.session)
      .orderBy(desc(schema.session.createdAt))
      .limit(10);

    // Try to get session using Better Auth
    const betterAuthSession = await auth.api.getSession({
      headers: await headers(),
    });

    // Get cookies from request
    const cookies = Object.fromEntries(
      request.cookies.getAll().map((cookie) => [cookie.name, cookie.value])
    );

    logger.info("Session test results", {
      totalSessionsInDb: allSessions.length,
      betterAuthSessionExists: !!betterAuthSession,
      cookiesReceived: Object.keys(cookies),
      sessionTokenCookie:
        cookies["better-auth.session_token"]?.substring(0, 8) + "...",
    });

    return NextResponse.json({
      success: true,
      databaseSessions: allSessions.map((session) => ({
        id: session.id,
        userId: session.userId,
        token: session.token.substring(0, 8) + "...",
        expiresAt: session.expiresAt,
        createdAt: session.createdAt,
        activeOrganizationId: session.activeOrganizationId,
      })),
      betterAuthSession: betterAuthSession
        ? {
            user: betterAuthSession.user
              ? {
                  id: betterAuthSession.user.id,
                  email: betterAuthSession.user.email,
                  name: betterAuthSession.user.name,
                }
              : null,
            sessionId: betterAuthSession.session?.id,
          }
        : null,
      cookies,
      sessionCookieMatches: allSessions.some(
        (session) => session.token === cookies["better-auth.session_token"]
      ),
    });
  } catch (error) {
    logger.error("Session test error:", error);
    return NextResponse.json(
      {
        error: "Failed to test session",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
