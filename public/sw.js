// Service Worker for Samparka PWA, Background Sync & Ghost Push Notifications
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

// Push notification received in background
self.addEventListener("push", (event) => {
  let data = {
    title: "Samparka",
    body: "New message received",
    url: "/messages",
    type: "MESSAGE",
  };

  if (event.data) {
    try {
      data = Object.assign(data, event.data.json());
    } catch (e) {
      data.body = event.data.text();
    }
  }

  // Customize vibration pattern based on notification type
  const isCall = data.type === "CALL";
  const vibratePattern = isCall
    ? [500, 250, 500, 250, 500, 250, 500] // Persistent ring pattern for incoming calls
    : [150, 80, 150]; // Distinct two-pulse haptic for messages

  const options = {
    body: data.body,
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-192x192.png",
    vibrate: vibratePattern,
    tag: data.tag || `samparka-${data.type || "notification"}`,
    renotify: true,
    requireInteraction: isCall,
    data: {
      url: data.url || "/messages",
    },
    actions: isCall
      ? [
          { action: "answer", title: "Answer" },
          { action: "decline", title: "Dismiss" },
        ]
      : [{ action: "open", title: "Open Chat" }],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "Samparka", options)
  );
});

// Notification clicked - open app and focus chat room
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "decline") {
    return;
  }

  const urlToOpen =
    event.notification.data && event.notification.data.url
      ? event.notification.data.url
      : "/messages";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ("focus" in client) {
          if ("navigate" in client) {
            client.navigate(urlToOpen);
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
