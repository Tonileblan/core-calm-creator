import { useEffect } from "react";

/**
 * Custom hook to lock window/body scroll when active is true.
 * Disables overscroll, touch scrolling, and scrollbars while preserving layout.
 */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;

    const originalOverflow = document.body.style.overflow;
    const originalOverscroll = document.body.style.overscrollBehavior;
    const originalTouchAction = document.body.style.touchAction;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalHtmlOverscroll = document.documentElement.style.overscrollBehavior;

    // Prevent body and html from scrolling or bouncing
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    document.body.style.touchAction = "manipulation";
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.overscrollBehavior = "none";

    const preventTouchScroll = (e: TouchEvent) => {
      // Allow touch if element explicitly has data-allow-scroll
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-allow-scroll]")) return;
      if (e.touches.length > 1) {
        // Prevent pinch to zoom
        e.preventDefault();
      }
    };

    document.addEventListener("touchmove", preventTouchScroll, { passive: false });

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.overscrollBehavior = originalOverscroll;
      document.body.style.touchAction = originalTouchAction;
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.documentElement.style.overscrollBehavior = originalHtmlOverscroll;
      document.removeEventListener("touchmove", preventTouchScroll);
    };
  }, [active]);
}
