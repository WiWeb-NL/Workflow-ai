import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createLogger } from "@/lib/logs/console-logger";

const logger = createLogger("JWKS");

export async function GET(request: NextRequest) {
  try {
    // Get JWKS from Better Auth JWT plugin
    const jwks = await auth.api.getJwks({
      headers: request.headers,
    });

    if (!jwks) {
      logger.error("Failed to retrieve JWKS from Better Auth");
      return NextResponse.json(
        { error: "JWKS not available" },
        { status: 500 }
      );
    }

    logger.info("Successfully returned JWKS");

    // Return JWKS with proper CORS headers for Privy access
    return NextResponse.json(jwks, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type",
        "Cache-Control": "public, max-age=86400", // Cache for 24 hours
      },
    });
  } catch (error) {
    logger.error("Error retrieving JWKS:", error);
    return NextResponse.json(
      { error: "Failed to retrieve JWKS" },
      { status: 500 }
    );
  }
}

// Handle CORS preflight requests
export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    }
  );
}
