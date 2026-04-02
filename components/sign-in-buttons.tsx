/**
 * Plain anchors to `/api/login/:provider`. Must be <a>, NOT <Link> —
 * Link does RSC fetch which hits CORS when the 302 crosses to GitHub/Google.
 */
export function SignInButtons() {
  return (
    <div className="stack">
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/api/login/google" className="btn primary">
        Sign in with Google
      </a>
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/api/login/github" className="btn ghost">
        Sign in with GitHub
      </a>
    </div>
  );
}
