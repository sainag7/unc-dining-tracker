import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * False during SSR and the first client render, true afterwards.
 *
 * For the handful of things that genuinely cannot be known until the browser
 * has them — the resolved colour theme, most obviously. The alternative,
 * setState in a mount effect, triggers a cascading render and React's lint
 * rules reject it.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
