import { SignInButtons } from "@/components/sign-in-buttons";
import { SignOutButton } from "@/components/sign-out-button";
import { FeedbackModal } from "@/components/feedback-modal";

export default function Home() {
  return (
    <div className="page">
      <main className="shell wide">
        <p className="eyebrow">POC · vinext + MongoDB + Auth.js</p>
        <h1>Feedback app</h1>
        <p className="lede">
          Sign in, send product feedback, and get a structured, safety-biased analysis from an LLM—stored
          as JSON in MongoDB for agents or future GitHub automation.
        </p>
        <div className="stack">
          <SignInButtons />
          <FeedbackModal />
          <SignOutButton />
        </div>
      </main>
    </div>
  );
}
