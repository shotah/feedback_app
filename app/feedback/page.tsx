import { FeedbackPanel, type FeedbackItem } from "@/components/feedback-panel";
import { SignOutButton } from "@/components/sign-out-button";
import { listFeedbackForUser } from "@/lib/feedback-service";
import { auth } from "@/auth";

export default async function FeedbackPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }
  const raw = await listFeedbackForUser(session.user.id);
  const initialItems = JSON.parse(JSON.stringify(raw)) as FeedbackItem[];

  return (
    <div className="page">
      <header className="topbar">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/">Home</a>
        <SignOutButton />
      </header>
      <main className="shell wide">
        <h1>Feedback</h1>
        <FeedbackPanel initialItems={initialItems} />
      </main>
    </div>
  );
}
