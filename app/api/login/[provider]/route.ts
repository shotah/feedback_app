import { Auth, skipCSRFCheck } from "@auth/core";
import { authConfig } from "@/auth";

/**
 * GET /api/login/:provider — kick off an OAuth sign-in server-side.
 *
 * Calls `Auth()` from `@auth/core` directly with `skipCSRFCheck`. The
 * returned Response already has `Set-Cookie` headers (pkce, state, nonce)
 * baked in by `toResponse()` — no reliance on vinext's `cookies()` API,
 * which drops pending cookies on redirect-throw (vinext bug).
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const origin = process.env.AUTH_URL ?? new URL(req.url).origin;

  const signInReq = new Request(
    `${origin}/api/auth/signin/${provider}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ callbackUrl: "/" }),
    },
  );

  // Auth() returns a 302 Response with Location + Set-Cookie headers.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return Auth(signInReq, { ...(authConfig as any), skipCSRFCheck });
}
