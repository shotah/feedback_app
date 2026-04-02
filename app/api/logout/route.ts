import { Auth, skipCSRFCheck } from "@auth/core";
import { authConfig } from "@/auth";

/**
 * GET /api/logout — server-side sign-out.
 * Same pattern as /api/login/[provider]: call Auth() directly so the
 * Set-Cookie headers (clearing the session) are in the Response itself.
 */
export async function GET(req: Request) {
  const origin = process.env.AUTH_URL ?? new URL(req.url).origin;

  const signOutReq = new Request(`${origin}/api/auth/signout`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ callbackUrl: "/" }),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return Auth(signOutReq, { ...(authConfig as any), skipCSRFCheck });
}
