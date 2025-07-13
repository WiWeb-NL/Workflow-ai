import { NextRequest, NextResponse } from "next/server";

// Simple logger to avoid import errors
const logger = {
  info: (message: string, data?: any) =>
    console.info(`[JWKS-WellKnown] ${message}`, data),
  error: (message: string, data?: any) =>
    console.error(`[JWKS-WellKnown] ${message}`, data),
};

export async function GET(request: NextRequest) {
  try {
    // Proxy the request to our existing JWKS endpoint
    const response = await fetch(
      `${new URL(request.url).origin}/api/auth/jwks`,
      {
        method: "GET",
        headers: request.headers,
      }
    );

    if (!response.ok) {
      logger.error("Failed to retrieve JWKS from Better Auth API", {
        status: response.status,
        statusText: response.statusText,
      });
      return NextResponse.json(
        { error: "JWKS not available" },
        { status: 500 }
      );
    }

    const jwks = await response.json();
    logger.info("Successfully returned JWKS from .well-known endpoint");

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
    logger.error("Error retrieving JWKS from .well-known endpoint:", error);
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
