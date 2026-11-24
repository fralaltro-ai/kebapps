import { NextResponse } from "next/server";

/**
 * Standardized server error response handler.
 * Sanitizes internal details to avoid leaking internal metadata or stack traces.
 */
export function serverError(scope: string, err: unknown, status: number = 500): NextResponse {
  const ref = crypto.randomUUID();
  console.error(`[${scope}] [Ref: ${ref}] Internal Error:`, err);

  return NextResponse.json(
    {
      error: "Errore interno del server.",
      ref,
    },
    { status }
  );
}
