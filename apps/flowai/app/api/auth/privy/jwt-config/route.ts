import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createLogger } from "@/lib/logs/console-logger";

const logger = createLogger("PrivyJWTConfig");

export async function GET(request: NextRequest) {
  try {
    // Get the JWKS endpoint URL for Privy configuration
    const baseUrl = new URL(request.url).origin;
    const jwksUrl = `${baseUrl}/api/auth/jwks`;

    logger.info("Returning Privy JWT configuration", {
      jwksUrl,
      baseUrl,
    });

    return NextResponse.json({
      jwks_uri: jwksUrl,
      issuer: baseUrl,
      audience: baseUrl,
      supported_algorithms: ["EdDSA"],
      id_claim: "id", // Better Auth uses 'id' as the user identifier
    });
  } catch (error) {
    logger.error("Error generating Privy JWT configuration:", error);
    return NextResponse.json(
      { error: "Failed to generate JWT configuration" },
      { status: 500 }
    );
  }
}
