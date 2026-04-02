import { SignInButtons } from "@/components/sign-in-buttons";
import { auth } from "@/auth";
import Link from "next/link";

export default async function Home() {
  const session = await auth();

  return (
    <div className="page">
      <main className="shell">
        <p className="eyebrow">POC · vinext + MongoDB + Auth.js</p>
        <h1>Feedback app</h1>
        <p className="lede">
          Sign in, send product feedback, and get a structured, safety-biased analysis from an LLM—stored
          as JSON in MongoDB for agents or future GitHub automation.
        </p>
        {session?.user ? (
          <div className="stack">
            <p className="muted">
              Signed in as <strong>{session.user.email ?? session.user.name ?? session.user.id}</strong>
            </p>
            <Link className="btn primary" href="/feedback">
              Open feedback
            </Link>
          </div>
        ) : (
          <SignInButtons />
        )}
      </main>
    </div>
  );
}
