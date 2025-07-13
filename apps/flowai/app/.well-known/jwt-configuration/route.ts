import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const baseUrl = new URL(request.url).origin;

    // Return the JWT configuration
    return NextResponse.json(
      {
        jwks_uri: `${baseUrl}/.well-known/jwks.json`,
        issuer: baseUrl,
        audience: baseUrl,
        supported_algorithms: ["EdDSA"],
        id_claim: "id",
      },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET",
          "Access-Control-Allow-Headers": "Content-Type",
          "Cache-Control": "public, max-age=86400", // Cache for 24 hours
        },
      }
    );
  } catch (error) {
    console.error("Error generating JWT configuration:", error);
    return NextResponse.json(
      { error: "Failed to generate JWT configuration" },
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
