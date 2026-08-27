import { useEffect } from "react";

/**
 * Strict hook to lock window/body scroll and touch dragging when active is true.
 * Disables overscroll bounce, single-finger drag scrolling, and pinch zooming.
 */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;

    const originalBodyOverflow = document.body.style.overflow;
    const originalBodyPosition = document.body.style.position;
    const originalBodyWidth = document.body.style.width;
    const originalBodyHeight = document.body.style.height;
    const originalBodyOverscroll = document.body.style.overscrollBehavior;
    const originalBodyTouchAction = document.body.style.touchAction;

    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalHtmlHeight = document.documentElement.style.height;
    const originalHtmlOverscroll = document.documentElement.style.overscrollBehavior;

    // Hard lock on body and html
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.width = "100%";
    document.body.style.height = "100%";
    document.body.style.overscrollBehavior = "none";
    document.body.style.touchAction = "none";

    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.height = "100%";
    document.documentElement.style.overscrollBehavior = "none";

    const preventTouchScroll = (e: TouchEvent) => {
      // Allow scroll only if explicitly permitted on this subtree
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-allow-scroll]")) return;
      if (e.cancelable) {
        e.preventDefault();
      }
    };

    // Passive false is critical to allow preventDefault() on touchmove
    document.addEventListener("touchmove", preventTouchScroll, { passive: false });
    window.addEventListener("scroll", (e) => window.scrollTo(0, 0));

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.body.style.position = originalBodyPosition;
      document.body.style.width = originalBodyWidth;
      document.body.style.height = originalBodyHeight;
      document.body.style.overscrollBehavior = originalBodyOverscroll;
      document.body.style.touchAction = originalBodyTouchAction;

      document.documentElement.style.overflow = originalHtmlOverflow;
      document.documentElement.style.height = originalHtmlHeight;
      document.documentElement.style.overscrollBehavior = originalHtmlOverscroll;

      document.removeEventListener("touchmove", preventTouchScroll);
    };
  }, [active]);
}
