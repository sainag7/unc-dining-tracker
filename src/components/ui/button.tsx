import Link from 'next/link';

/**
 * The three button shapes this app actually has.
 *
 * There was no Button component before this — the same three className
 * strings were retyped at about ten call sites, and they had already drifted
 * apart: two different heights for the same primary action, `rounded-md` in
 * some places and `rounded-full` in others, and every tertiary button carrying
 * `underline underline-offset-2`, which made it read as body copy someone had
 * linked rather than as a control.
 *
 * primary   the deep fill. One per screen — it is the thing you came to do.
 * secondary a card, same footprint. The alternative to the primary.
 * ghost     text only, no ground. Dismissals and "clear all".
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-full whitespace-nowrap transition-opacity duration-150 ease-out disabled:opacity-40';

const VARIANT: Record<ButtonVariant, string> = {
  // on-deep, not on-accent: the focus ring has to be the light foreground
  // here, since an accent-coloured ring on the deep fill is invisible.
  primary:
    'on-deep h-12 bg-deep px-6 text-input font-semibold text-deep-fg shadow-[var(--shadow-card)]',
  secondary: 'card h-12 px-6 text-body font-semibold text-text',
  ghost: 'h-11 px-4 text-body font-semibold text-accent-text',
};

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button {...props} className={`${BASE} ${VARIANT[variant]} ${className}`} />;
}

/** The same shapes, for the places the action is a navigation. */
export function ButtonLink({
  variant = 'primary',
  className = '',
  ...props
}: React.ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link {...props} className={`${BASE} ${VARIANT[variant]} ${className}`} />;
}
