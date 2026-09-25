import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Privacy — Tray' };

/**
 * The privacy policy App Store Connect asks for, and the one the iOS app links
 * to from Settings. It has to stay in step with ios/Tray/Resources/
 * PrivacyInfo.xcprivacy and the App Store privacy labels: if what Tray stores
 * changes, change all three.
 */
export default function PrivacyPage() {
  const contact = process.env.SCRAPER_CONTACT;

  return (
    <main className="mx-auto w-full max-w-[640px] flex-1 space-y-6 px-4 py-6 pb-16 text-body">
      <div className="border-b border-border pb-2">
        <h1 className="wordmark">Privacy</h1>
        <p className="mt-1 text-meta text-text-muted">Tray, on the web and on iPhone</p>
      </div>

      <section className="space-y-2">
        <h2 className="placard text-text-muted">What Tray stores</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Your account:</strong> your email address, plus your name if you sign in with
            Google or Apple. It&apos;s used only to sign you in.
          </li>
          <li>
            <strong>Your food log:</strong> which menu items you logged, how many servings, and
            when. Also the goals and dietary and allergen preferences you set.
          </li>
        </ul>
        <p>
          Menus don&apos;t need an account. Browsing them sends nothing about you.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="placard text-text-muted">What Tray doesn&apos;t do</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>No ads, analytics, or tracking across apps or websites.</li>
          <li>Your data is never sold or shared with anyone.</li>
          <li>Tray has no connection to UNC Dining or Carolina Dining Services. Nothing you log goes to them.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="placard text-text-muted">Where it lives</h2>
        <p>
          Everything is stored in a Supabase (Postgres) database. Row-level security means only
          your signed-in account can read or change your log.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="placard text-text-muted">Deleting it</h2>
        <p>
          Settings → <strong>Delete account</strong> removes your account, your goals and your
          whole food log right away, on the web and in the app.{' '}
          <Link href="/settings" className="underline">
            Go to Settings
          </Link>
          .
        </p>
      </section>

      {contact && (
        <section className="space-y-2">
          <h2 className="placard text-text-muted">Contact</h2>
          <p>
            Questions: <a href={`mailto:${contact}`} className="underline">{contact}</a>
          </p>
        </section>
      )}
    </main>
  );
}
