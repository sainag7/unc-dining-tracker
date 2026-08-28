'use client';

/**
 * The only boundary that catches a throw in the root layout.
 *
 * `error.tsx` wraps pages, never the layout above them, so before this existed
 * any failure in `layout.tsx` — a rejected token, a Supabase blip — replaced
 * every route in the app with a bare 500 and no way back. The layout no longer
 * throws for that reason, but this is what stands behind it if anything else
 * ever does.
 *
 * It replaces the document, so it renders its own <html> and <body>, and it
 * can't assume globals.css or the theme provider ever loaded — hence inline
 * styles and colours that read on either default background.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          background: '#fff',
          color: '#111',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        <main style={{ maxWidth: '24rem', width: '100%' }}>
          <h1 style={{ fontSize: '1.125rem', fontWeight: 600, margin: '0 0 0.5rem' }}>
            Tray hit a problem
          </h1>
          <p style={{ margin: '0 0 1.5rem', lineHeight: 1.5, color: '#555' }}>
            Something failed while loading the page. Trying again usually clears it.
          </p>

          <button
            type="button"
            onClick={reset}
            style={{
              height: '3rem',
              width: '100%',
              borderRadius: '0.375rem',
              border: '1px solid #111',
              background: '#111',
              color: '#fff',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>

          {/*
            A plain anchor on purpose, not next/link. This boundary is what
            renders when the root layout itself failed, so the router is exactly
            the thing not to trust — a full document load is the point.
          */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            style={{
              display: 'flex',
              height: '2.75rem',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: '0.5rem',
              color: '#555',
              fontSize: '0.9375rem',
              textDecoration: 'none',
            }}
          >
            Back to the menu
          </a>

          {/* The digest is the only handle on a server-side failure in production. */}
          {error.digest && (
            <p style={{ marginTop: '1.5rem', fontSize: '0.75rem', color: '#888' }}>
              Reference: {error.digest}
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
