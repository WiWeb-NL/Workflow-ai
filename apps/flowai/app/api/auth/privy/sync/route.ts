import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { auth } from "@/lib/auth";
import { createLogger } from "@/lib/logs/console-logger";

const logger = createLogger("PrivySync");

// In-memory cache to prevent duplicate sync calls
const recentSyncs = new Map<string, number>();
const SYNC_COOLDOWN_MS = 5000; // 5 seconds

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { privyUserId, email, name, image, walletAddress } = body;

    // Log the received data for debugging
    logger.info("Received sync request", {
      body,
      privyUserId,
      email,
      name,
      image,
      walletAddress,
    });

    if (!privyUserId || !email) {
      logger.error("Missing required fields", {
        privyUserId: !!privyUserId,
        email: !!email,
        receivedBody: body,
      });
      return NextResponse.json(
        {
          error: "Privy user ID and email are required",
          received: {
            privyUserId: !!privyUserId,
            email: !!email,
          },
        },
        { status: 400 }
      );
    }

    // Check for recent sync to prevent duplicates
    const syncKey = `${privyUserId}-${email}`;
    const lastSync = recentSyncs.get(syncKey);
    const now = Date.now();

    if (lastSync && now - lastSync < SYNC_COOLDOWN_MS) {
      logger.info("Skipping duplicate sync call", {
        privyUserId,
        email,
        timeSinceLastSync: now - lastSync,
      });

      return NextResponse.json({
        success: true,
        message: "Sync already in progress or recently completed",
      });
    }

    // Mark this sync as in progress
    recentSyncs.set(syncKey, now);

    // Clean up old entries (older than 1 minute)
    for (const [key, timestamp] of recentSyncs.entries()) {
      if (now - timestamp > 60000) {
        recentSyncs.delete(key);
      }
    }

    logger.info("Syncing Privy user with Better Auth", {
      privyUserId,
      email,
      name,
    });

    // Check if user already exists in Better Auth by email
    const existingUser = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, email))
      .limit(1);

    let user;
    if (existingUser.length > 0) {
      // Update existing user with wallet address if provided
      user = existingUser[0];

      if (walletAddress && user.walletAddress !== walletAddress) {
        await db
          .update(schema.user)
          .set({
            walletAddress,
            updatedAt: new Date(),
          })
          .where(eq(schema.user.id, user.id));

        logger.info("Updated user wallet address", {
          userId: user.id,
          walletAddress,
        });
      }
    } else {
      // Create new user
      const userData = {
        id: crypto.randomUUID(),
        name: name || "User",
        email,
        emailVerified: true, // Since Privy handles verification
        image: image || null,
        walletAddress: walletAddress || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const [newUser] = await db
        .insert(schema.user)
        .values(userData)
        .returning();

      user = newUser;

      logger.info("Created new user from Privy sync", {
        userId: user.id,
        email: user.email,
      });
    }

    // Create session using manual database insertion
    logger.info("Creating Better Auth session for Privy user");

    try {
      // Create session token and ID
      const sessionToken = crypto.randomUUID();
      const sessionId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      const sessionData = {
        id: sessionId,
        userId: user.id,
        token: sessionToken,
        expiresAt,
        createdAt: new Date(),
        updatedAt: new Date(),
        ipAddress:
          request.headers.get("x-forwarded-for") ||
          request.headers.get("x-real-ip") ||
          "unknown",
        userAgent: request.headers.get("user-agent") || "Unknown",
        activeOrganizationId: null,
      };

      await db.insert(schema.session).values(sessionData);

      // Check for organization membership and update session
      try {
        const members = await db
          .select()
          .from(schema.member)
          .where(eq(schema.member.userId, user.id))
          .limit(1);

        if (members.length > 0) {
          await db
            .update(schema.session)
            .set({
              activeOrganizationId: members[0].organizationId,
              updatedAt: new Date(),
            })
            .where(eq(schema.session.id, sessionId));

          logger.info("Updated session with active organization", {
            sessionId,
            userId: user.id,
            organizationId: members[0].organizationId,
          });
        }
      } catch (hookError) {
        logger.warn("Failed to apply organization hook logic", hookError);
      }

      const response = NextResponse.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          walletAddress: user.walletAddress,
        },
      });

      // Set the session cookie with the exact name Better Auth expects
      response.cookies.set("better-auth.session_token", sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60, // 30 days
        path: "/",
        // Add domain for cross-subdomain support if needed
        domain: process.env.NODE_ENV === "production" ? undefined : "localhost",
      });

      logger.info("Session created successfully", {
        userId: user.id,
        sessionId,
        sessionToken: sessionToken.substring(0, 10) + "...",
        cookieName: "better-auth.session_token",
      });

      return response;
    } catch (sessionError) {
      logger.error("Failed to create session for Privy user:", sessionError);

      return NextResponse.json(
        {
          error: "Failed to create session",
          details:
            sessionError instanceof Error
              ? sessionError.message
              : "Unknown error",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error("Error syncing Privy user:", error);
    return NextResponse.json({ error: "Failed to sync user" }, { status: 500 });
  }
}
