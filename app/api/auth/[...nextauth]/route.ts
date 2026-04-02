import { Auth } from "@auth/core";
import { authConfig } from "@/auth";

/**
 * Call Auth.js directly instead of through next-auth's `handlers` wrapper.
 * `handlers.GET` uses `reqWithEnvURL` which creates a `new NextRequest` —
 * vinext's NextRequest shim may alter cookie headers, causing PKCE
 * decryption to fail. Calling Auth() with the raw Request avoids this.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cfg = authConfig as any;

export async function GET(req: Request) {
  return Auth(req, cfg);
}

export async function POST(req: Request) {
  return Auth(req, cfg);
}
