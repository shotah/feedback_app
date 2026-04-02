import { FeedbackPanel, type FeedbackItem } from "@/components/feedback-panel";
import { SignOutButton } from "@/components/sign-out-button";
import { listFeedbackForUser } from "@/lib/feedback-service";
import { auth } from "@/auth";
import Link from "next/link";

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
        <Link href="/">Home</Link>
        <SignOutButton />
      </header>
      <main className="shell wide">
        <h1>Feedback</h1>
        <FeedbackPanel initialItems={initialItems} />
      </main>
    </div>
  );
}
