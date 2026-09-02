import { ButtonLink } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <h1 className="text-input font-semibold">Nothing here</h1>
      <p className="mt-2 max-w-sm text-body text-text-muted">
        That page doesn&rsquo;t exist. The menu is where everything starts.
      </p>
      <ButtonLink href="/" className="mt-6">
        Go to the menu
      </ButtonLink>
    </main>
  );
}
