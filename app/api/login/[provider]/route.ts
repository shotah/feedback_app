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
  const signInUrl = `${origin}/api/auth/signin/${provider}`;

  console.log(`[login] provider=${provider} origin=${origin} signInUrl=${signInUrl}`);

  const signInReq = new Request(
    signInUrl,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ callbackUrl: "/" }),
    },
  );

  const secretStr = String(authConfig.secret ?? process.env.AUTH_SECRET ?? "");
  console.log(`[login] secret (first 8): "${secretStr.slice(0, 8)}…" len=${secretStr.length}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await Auth(signInReq, { ...(authConfig as any), skipCSRFCheck });

  console.log(`[login] Auth response: status=${res.status}`);
  console.log(`[login]   Location: ${res.headers.get("Location")?.slice(0, 100)}`);

  const setCookies = res.headers.getSetCookie?.() ?? [];
  console.log(`[login]   Set-Cookie count: ${setCookies.length}`);
  for (const c of setCookies) {
    const eqIdx = c.indexOf("=");
    const name = c.slice(0, eqIdx);
    const rest = c.slice(eqIdx + 1);
    const value = rest.split(";")[0];
    console.log(`[login]   SET ${name} valueLen=${value.length} first40=${value.slice(0, 40)}`);
  }

  return res;
}
