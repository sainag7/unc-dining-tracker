/** Shaped like the station index it replaces, so the layout doesn't jump. */
export default function Loading() {
  return (
    <main className="flex-1 px-4 py-4" aria-busy="true" aria-label="Loading menu">
      <div className="h-8 w-40 animate-pulse bg-paper-sunk" />
      <div className="mt-4 h-6 w-full animate-pulse bg-paper-sunk" />

      {[0, 1, 2, 3, 4].map((section) => (
        <div key={section} className="mt-5">
          <div className="flex items-baseline justify-between rule-top pt-1.5 pb-1">
            <div
              className="h-4 animate-pulse bg-paper-sunk"
              style={{ width: `${30 + ((section * 17) % 40)}%` }}
            />
            <div className="h-3 w-6 animate-pulse bg-paper-sunk" />
          </div>
          {section < 2 &&
            [0, 1, 2].map((row) => (
              <div
                key={row}
                className="flex items-center justify-between gap-3 border-b border-rule py-3"
              >
                <div
                  className="h-4 animate-pulse bg-paper-sunk"
                  style={{ width: `${40 + ((row * 13) % 30)}%` }}
                />
                <div className="h-9 w-9 animate-pulse rounded-full bg-paper-sunk" />
              </div>
            ))}
        </div>
      ))}
    </main>
  );
}
