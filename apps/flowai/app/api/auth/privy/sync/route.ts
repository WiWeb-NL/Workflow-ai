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

    // Create a session for the user using Better Auth
    const session = await auth.api.signInEmail({
      body: {
        email: user.email,
        password: "", // Not used for Privy users
      },
      headers: request.headers,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        walletAddress: user.walletAddress,
      },
      session,
    });
  } catch (error) {
    logger.error("Error syncing Privy user:", error);
    return NextResponse.json({ error: "Failed to sync user" }, { status: 500 });
  }
}
