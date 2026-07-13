// Service worker for push notifications
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: "Nova notificação", body: event.data ? event.data.text() : "" };
  }
  const title = payload.title || "Esportes Unidos";
  const options = {
    body: payload.body || "",
    icon: "/icon_192.png",
    badge: "/icon_192.png",
    data: payload.data || {},
    tag: (payload.data && payload.data.game_id) ? `game-${payload.data.game_id}` : undefined,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const gameId = event.notification.data && event.notification.data.game_id;
  const url = gameId ? `/games/${gameId}` : "/";
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of allClients) {
        try {
          const clientUrl = new URL(client.url);
          if (clientUrl.origin === self.location.origin) {
            await client.focus();
            await client.navigate(url).catch(() => {});
            return;
          }
        } catch {}
      }
      await self.clients.openWindow(url);
    })(),
  );
});
