import * as React from 'react';

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;

function subscribe(query: string, onStoreChange: () => void) {
  const mql = window.matchMedia(query);
  mql.addEventListener('change', onStoreChange);
  return () => mql.removeEventListener('change', onStoreChange);
}

function getSnapshot(query: string) {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(query).matches;
}

export function useMediaQuery(query: string) {
  return React.useSyncExternalStore(
    (onStoreChange) => subscribe(query, onStoreChange),
    () => getSnapshot(query),
  );
}

/** < 768px */
export function useIsMobile() {
  return useMediaQuery(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
}

/** 768px ~ 1023px */
export function useIsTablet() {
  return useMediaQuery(
    `(min-width: ${MOBILE_BREAKPOINT}px) and (max-width: ${TABLET_BREAKPOINT - 1}px)`,
  );
}

/** < 1024px（mobile + tablet） */
export function useIsBelowDesktop() {
  return useMediaQuery(`(max-width: ${TABLET_BREAKPOINT - 1}px)`);
}

/** 主输入支持 hover（鼠标等）；移动端触摸设备为 false */
export function useCanHover() {
  return useMediaQuery('(hover: hover)');
}
