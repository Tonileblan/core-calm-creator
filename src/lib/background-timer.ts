/**
 * Background Timer basado en Web Worker
 *
 * Los navegadores móviles (iOS Safari, Android Chrome) congelan o reducen
 * la frecuencia de `setInterval` en el hilo principal cuando la pestaña
 * pasa a segundo plano o se bloquea la pantalla.
 *
 * Al ejecutar el temporizador en un Web Worker dedicado, el temporizador continúa
 * ejecutándose de manera constante y fiable.
 */

type TimerCallback = () => void;

class BackgroundTimerManager {
  private worker: Worker | null = null;
  private callbacks = new Map<string, TimerCallback>();
  private fallbackIntervals = new Map<string, number>();

  constructor() {
    this.initWorker();
  }

  private initWorker() {
    if (typeof window === "undefined") return;

    try {
      // Código del Web Worker inlined como Blob para compatibilidad universal
      const workerCode = `
        const timers = new Map();

        self.onmessage = function(e) {
          const { action, id, interval } = e.data;

          if (action === 'start') {
            if (timers.has(id)) {
              clearInterval(timers.get(id));
            }
            const timerId = setInterval(() => {
              self.postMessage({ id, tick: Date.now() });
            }, interval || 1000);
            timers.set(id, timerId);
          } else if (action === 'stop') {
            if (timers.has(id)) {
              clearInterval(timers.get(id));
              timers.delete(id);
            }
          } else if (action === 'clearAll') {
            timers.forEach((t) => clearInterval(t));
            timers.clear();
          }
        };
      `;

      const blob = new Blob([workerCode], { type: "application/javascript" });
      const workerUrl = URL.createObjectURL(blob);
      this.worker = new Worker(workerUrl);

      this.worker.onmessage = (e) => {
        const { id } = e.data;
        const cb = this.callbacks.get(id);
        if (cb) {
          try {
            cb();
          } catch (err) {
            console.error("Error en callback de background timer:", err);
          }
        }
      };
    } catch (e) {
      console.warn("Web Worker no disponible, usando temporizador estándar:", e);
      this.worker = null;
    }
  }

  /**
   * Inicia un intervalo en segundo plano
   */
  setInterval(id: string, callback: TimerCallback, intervalMs = 1000) {
    this.callbacks.set(id, callback);

    if (this.worker) {
      this.worker.postMessage({ action: "start", id, interval: intervalMs });
    } else {
      if (this.fallbackIntervals.has(id)) {
        window.clearInterval(this.fallbackIntervals.get(id));
      }
      const t = window.setInterval(callback, intervalMs);
      this.fallbackIntervals.set(id, t);
    }
  }

  /**
   * Detiene un intervalo
   */
  clearInterval(id: string) {
    this.callbacks.delete(id);
    if (this.worker) {
      this.worker.postMessage({ action: "stop", id });
    }
    if (this.fallbackIntervals.has(id)) {
      window.clearInterval(this.fallbackIntervals.get(id));
      this.fallbackIntervals.delete(id);
    }
  }

  /**
   * Detiene todos los intervalos
   */
  clearAll() {
    this.callbacks.clear();
    if (this.worker) {
      this.worker.postMessage({ action: "clearAll" });
    }
    this.fallbackIntervals.forEach((t) => window.clearInterval(t));
    this.fallbackIntervals.clear();
  }
}

let backgroundTimer: BackgroundTimerManager | null = null;

export function getBackgroundTimer(): BackgroundTimerManager {
  if (!backgroundTimer) {
    backgroundTimer = new BackgroundTimerManager();
  }
  return backgroundTimer;
}
