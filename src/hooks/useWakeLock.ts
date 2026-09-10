import { useEffect, useRef, useCallback } from "react";

/**
 * Hook para mantener la pantalla del móvil encendida (Screen Wake Lock API).
 * Muy útil para sesiones de respiración guiada, foco y cuando suena una alarma.
 */
export function useWakeLock(enabled = true) {
  const wakeLockRef = useRef<any>(null);

  const requestWakeLock = useCallback(async () => {
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    try {
      if (!wakeLockRef.current) {
        wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
        wakeLockRef.current.addEventListener("release", () => {
          wakeLockRef.current = null;
        });
      }
    } catch (err) {
      // Puede fallar si la batería es muy baja o la pestaña no está visible
      console.warn("No se pudo obtener Wake Lock de pantalla:", err);
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch {
        // ignore
      }
      wakeLockRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      void requestWakeLock();

      const handleVisibilityChange = () => {
        if (document.visibilityState === "visible" && enabled) {
          void requestWakeLock();
        }
      };

      document.addEventListener("visibilitychange", handleVisibilityChange);
      return () => {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        void releaseWakeLock();
      };
    }
    void releaseWakeLock();
    return undefined;
  }, [enabled, requestWakeLock, releaseWakeLock]);

  return { requestWakeLock, releaseWakeLock };
}
