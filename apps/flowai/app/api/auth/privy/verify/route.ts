import { NextRequest, NextResponse } from "next/server";
import { jwtVerify, createRemoteJWKSet } from "jose";
import { env } from "@/lib/env";
import { createLogger } from "@/lib/logs/console-logger";

const logger = createLogger("PrivyVerify");

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    if (!env.PRIVY_APP_ID) {
      return NextResponse.json(
        { error: "Privy app ID not configured" },
        { status: 500 }
      );
    }

    // Verify the Privy JWT token
    const JWKS = createRemoteJWKSet(
      new URL(
        `https://auth.privy.io/api/v1/apps/${env.PRIVY_APP_ID}/.well-known/jwks.json`
      )
    );

    const { payload } = await jwtVerify(token, JWKS, {
      issuer: "privy.io",
      audience: env.PRIVY_APP_ID,
    });

    logger.info("Successfully verified Privy JWT token", {
      sub: payload.sub,
      aud: payload.aud,
    });

    return NextResponse.json({
      success: true,
      payload,
    });
  } catch (error) {
    logger.error("Error verifying Privy JWT token:", error);
    return NextResponse.json(
      { error: "Failed to verify token" },
      { status: 401 }
    );
  }
}
