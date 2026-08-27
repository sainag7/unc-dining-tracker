/**
 * Loading placeholder.
 *
 * Sized by the caller to match the real thing it stands in for — the previous
 * skeleton used a 36px row against a 44px one, so the page jumped on
 * hydration despite the file claiming it wouldn't.
 */
export function Skeleton({
  className = '',
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div style={style} className={`rounded-sm bg-border motion-safe:animate-pulse ${className}`} />
  );
}
