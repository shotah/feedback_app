/**
 * Plain anchor to /api/logout — must be <a>, not <Link> (same CORS
 * reason as sign-in: the 302 crosses origins in the fetch path).
 */
export function SignOutButton() {
  return (
    <a href="/api/logout" className="btn ghost">
      Sign out
    </a>
  );
}
