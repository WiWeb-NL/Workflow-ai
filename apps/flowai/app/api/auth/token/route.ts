import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { createLogger } from "@/lib/logs/console-logger";

const logger = createLogger("JWTToken");

export async function GET(request: NextRequest) {
  try {
    // Get JWT token from Better Auth
    const response = await auth.api.getToken({
      headers: await headers(),
    });

    if (!response || !response.token) {
      logger.warn("No JWT token available - user not authenticated");
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const token = response.token;
    logger.info("Successfully generated JWT token", {
      tokenPreview: token ? `${token.substring(0, 10)}...` : null,
    });

    return NextResponse.json(
      { token },
      {
        headers: {
          "set-auth-jwt": token, // Also set in header as mentioned in Better Auth docs
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      }
    );
  } catch (error) {
    logger.error("Error generating JWT token:", error);
    return NextResponse.json(
      { error: "Failed to generate token" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Same as GET for flexibility
  return GET(request);
}
