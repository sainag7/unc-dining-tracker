import { Skeleton } from '@/components/ui/skeleton';

/**
 * Shaped like the station index it replaces.
 *
 * The measurements track menu-row.tsx exactly — py-1.5 around a 44px button,
 * so 56px a row. The previous version used a 36px circle against a real 44px
 * one and the page shifted on hydration.
 */
export default function Loading() {
  return (
    <main
      className="mx-auto w-full max-w-[640px] flex-1 px-4 py-4"
      aria-busy="true"
      aria-label="Loading menu"
    >
      <Skeleton className="h-8 w-32" />
      <Skeleton className="mt-3 h-11 w-full" />

      {[0, 1, 2, 3, 4].map((section) => (
        <div key={section} className="mt-4">
          <div className="flex items-center justify-between border-b border-border py-2">
            <Skeleton
              className="h-3"
              style={{ width: `${30 + ((section * 17) % 40)}%` }}
            />
            <Skeleton className="h-3 w-4" />
          </div>

          {section < 2 &&
            [0, 1, 2].map((row) => (
              <div
                key={row}
                className="flex items-center gap-2 border-b border-border py-1.5"
              >
                <Skeleton
                  className="h-4 flex-none"
                  style={{ width: `${40 + ((row * 13) % 30)}%` }}
                />
                <span className="flex-1" />
                <Skeleton className="h-4 w-9" />
                <Skeleton className="h-11 w-11 rounded-full" />
              </div>
            ))}
        </div>
      ))}
    </main>
  );
}
