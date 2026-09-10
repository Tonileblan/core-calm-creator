// Service Worker para Blowmind (Flowmind)
// Gestiona notificaciones de alarmas en segundo plano, eventos de clic y vibración

const CACHE_NAME = 'blowmind-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.webmanifest',
  '/favicon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Instalación
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {
        // Ignorar fallos de precaching en desarrollo
      });
    })
  );
  self.skipWaiting();
});

// Activación
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Manejo de mensajes desde el hilo principal (por ejemplo, disparar alarma en segundo plano)
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SHOW_ALARM_NOTIFICATION') {
    const { title, body, tag, icon, data } = event.data;
    const options = {
      body: body || 'Es hora de tu actividad de bienestar en Blowmind',
      icon: icon || '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: tag || 'alarm-notification',
      renotify: true,
      requireInteraction: true, // Se mantiene visible hasta que el usuario interactúe
      vibrate: [500, 250, 500, 250, 1000],
      data: data || {},
      actions: [
        { action: 'open', title: 'Abrir y realizar' },
        { action: 'dismiss', title: 'Apagar' },
      ],
    };

    event.waitUntil(self.registration.showNotification(title || '⏰ ¡Alarma activa!', options));
  }
});

// Clic en la notificación
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  const targetUrl = event.notification.data?.url || '/';

  if (action === 'dismiss') {
    // Comunicar a todos los clientes abiertos que apaguen la alarma
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      clients.forEach((client) => {
        client.postMessage({ type: 'STOP_ALARM_FROM_NOTIFICATION' });
      });
    });
    return;
  }

  // Si pulsa abrir o en el cuerpo de la notificación
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Si ya hay una pestaña abierta, enfocarla
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({
            type: 'ALARM_NOTIFICATION_CLICKED',
            data: event.notification.data,
          });
          return;
        }
      }
      // Si no hay pestañas abiertas, abrir una nueva
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
