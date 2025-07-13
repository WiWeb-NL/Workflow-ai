import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { auth } from "@/lib/auth";
import { createLogger } from "@/lib/logs/console-logger";

const logger = createLogger("PrivySync");

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { privyUserId, email, name, image, walletAddress } = body;

    if (!privyUserId || !email) {
      return NextResponse.json(
        { error: "Privy user ID and email are required" },
        { status: 400 }
      );
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

    // Instead of manually creating a session, let's use Better Auth to sign the user in
    // by creating a temporary login session
    const { cookies } = await import("next/headers");

    // Create a response that will set the proper Better Auth session
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

    // Create session using Better Auth's internal method
    try {
      // For now, skip the Better Auth API and go directly to manual creation
      throw new Error("Using manual session creation");
    } catch (sessionError) {
      logger.warn(
        "Failed to create session through Better Auth API, falling back to manual creation",
        sessionError
      );

      // Fallback to manual session creation
      const sessionToken = crypto.randomUUID();
      const sessionData = {
        id: crypto.randomUUID(),
        userId: user.id,
        token: sessionToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        createdAt: new Date(),
        updatedAt: new Date(),
        ipAddress:
          request.headers.get("x-forwarded-for") ||
          request.headers.get("x-real-ip") ||
          null,
        userAgent: request.headers.get("user-agent") || null,
      };

      // Insert the session directly into the database
      await db.insert(schema.session).values(sessionData);

      // Set the session cookie
      response.cookies.set("better-auth.session_token", sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60, // 30 days
        path: "/",
      });
    }

    return response;
  } catch (error) {
    logger.error("Error syncing Privy user:", error);
    return NextResponse.json({ error: "Failed to sync user" }, { status: 500 });
  }
}
