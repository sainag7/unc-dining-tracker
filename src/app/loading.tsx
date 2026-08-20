/** Skeleton shaped like the station lists it replaces, so the layout doesn't jump. */
export default function Loading() {
  return (
    <main className="flex-1 px-4 py-6" aria-busy="true" aria-label="Loading menu">
      <div className="h-9 w-full animate-pulse rounded-lg bg-paper-sunk" />

      {[0, 1, 2].map((section) => (
        <section key={section} className="mt-6">
          <div className="h-5 w-40 animate-pulse rounded bg-paper-sunk" />
          <div className="mt-2 border-b-2 border-rule-strong" />
          {[0, 1, 2, 3].map((row) => (
            <div
              key={row}
              className="flex items-center justify-between gap-3 border-b border-rule py-3"
            >
              <div
                className="h-4 animate-pulse rounded bg-paper-sunk"
                style={{ width: `${45 + ((row * 13) % 35)}%` }}
              />
              <div className="h-4 w-8 animate-pulse rounded bg-paper-sunk" />
            </div>
          ))}
        </section>
      ))}
    </main>
  );
}
