import { SignInButtons } from "@/components/sign-in-buttons";
import { SignOutButton } from "@/components/sign-out-button";
import { FeedbackModal } from "@/components/feedback-modal";
import { SettingsModal } from "@/components/settings-modal";
import { auth } from "@/auth";

export default async function Home() {
  const session = await auth();

  return (
    <div className="page">
      <main className="shell wide">
        <div className="home-hero">
          <div className="home-hero-titles">
            <p className="eyebrow">vinext + MongoDB + Auth.js</p>
            <h1>CYOA</h1>
          </div>
          <div className="row topbar-actions">
            <SettingsModal />
            <SignOutButton />
            <FeedbackModal />
          </div>
        </div>
        <p className="lede">
          What if the thing you’re building could assemble itself from the stray thoughts you have
          while using it—a snag here, a sparkle of an idea there—instead of waiting for a perfect spec?
          CYOA turns that chatter into structured, safety-minded plans and, step by step, into changes that
          land in the codebase you already have. Speak plainly; we keep the receipts in MongoDB so teammates,
          agents, or GitHub can run with what you meant.
        </p>
        <div className="stack">
          {session?.user ? null : <SignInButtons />}
        </div>
      </main>
    </div>
  );
}
