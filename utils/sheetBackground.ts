import { NativeFloatIsland, supportsNativeFloatIsland } from './nativeFloatIsland';

let locks = 0;
let restore: (() => void) | undefined;

// Sheets live beside #root. Freeze the app's own scroll areas, not just body.
export function lockSheetBackground() {
  if (locks++ === 0) {
    const root = document.getElementById('root');
    const previousFocus = document.activeElement as HTMLElement | null;
    const wasInert = root?.inert;
    const overflow = document.body.style.overflow;
    const hadClass = document.documentElement.classList.contains('fortale-sheet-open');
    document.documentElement.classList.add('fortale-sheet-open');
    document.body.style.overflow = 'hidden';
    if (root) root.inert = true;
    if (supportsNativeFloatIsland()) void NativeFloatIsland.setPageScrollLocked({ locked: true }).catch(() => {});
    restore = () => {
      if (root) root.inert = Boolean(wasInert);
      document.body.style.overflow = overflow;
      if (!hadClass) document.documentElement.classList.remove('fortale-sheet-open');
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
      if (supportsNativeFloatIsland()) void NativeFloatIsland.setPageScrollLocked({ locked: false }).catch(() => {});
    };
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--locks === 0) { restore?.(); restore = undefined; }
  };
}
