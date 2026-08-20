import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <h1 className="signage text-2xl">Nothing here</h1>
      <p className="mt-2 max-w-sm text-sm text-ink-soft">
        That page doesn&rsquo;t exist. The menu is where everything starts.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-xl bg-navy px-5 py-2.5 text-sm font-semibold text-paper-raised"
      >
        Go to the menu
      </Link>
    </main>
  );
}
