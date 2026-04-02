import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

const googleId = process.env.AUTH_GOOGLE_ID;
const googleSecret = process.env.AUTH_GOOGLE_SECRET;
const githubId = process.env.AUTH_GITHUB_ID;
const githubSecret = process.env.AUTH_GITHUB_SECRET;

const providers = [
  Google({
    clientId: googleId ?? "unset-google-client-id",
    clientSecret: googleSecret ?? "unset-google-client-secret",
  }),
  GitHub({
    clientId: githubId ?? "unset-github-client-id",
    clientSecret: githubSecret ?? "unset-github-client-secret",
  }),
];

// Exported so /api/login/[provider] can call Auth() from @auth/core directly.
// NextAuth() mutates this object (sets secret, provider credentials, etc.).
export const authConfig = {
  trustHost: true,
  // Keep in sync with `app/api/auth/[...nextauth]/route.ts`. Prevents AUTH_URL path typos
  // (e.g. `/api`) from breaking action parsing in @auth/core.
  basePath: "/api/auth",
  providers,
  callbacks: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    session({ session, token }: { session: any; token: any }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
};

export const { handlers, signIn, signOut, auth } = NextAuth(authConfig);
