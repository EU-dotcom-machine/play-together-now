import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

const VAPID_PUBLIC_KEY =
  "BMziJZPy3CU1N0NnWcy9c_ZIaLNlUpcB__F5ybt6bwpJ6M74KVV73B-tmsPtT-p1e-0e3Pdky4hYrSudsQYoQok";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function isPreviewOrDev(): boolean {
  if (typeof window === "undefined") return true;
  const h = window.location.hostname;
  return (
    h === "localhost" ||
    h.startsWith("id-preview--") ||
    h.startsWith("preview--") ||
    h.endsWith(".lovableproject.com") ||
    h.endsWith(".lovableproject-dev.com") ||
    h.endsWith(".beta.lovable.dev")
  );
}

export function usePushNotifications() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined") return;
    if (isPreviewOrDev()) return;
    if (!("serviceWorker" in navigator)) return;
    if (!("PushManager" in window)) return;
    if (!("Notification" in window)) return;

    let cancelled = false;

    (async () => {
      try {
        const reg =
          (await navigator.serviceWorker.getRegistration("/sw.js")) ??
          (await navigator.serviceWorker.register("/sw.js"));
        await navigator.serviceWorker.ready;
        if (cancelled) return;

        let permission = Notification.permission;
        if (permission === "default") {
          permission = await Notification.requestPermission();
        }
        if (permission !== "granted") return;

        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          const key = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: key.buffer.slice(
              key.byteOffset,
              key.byteOffset + key.byteLength,
            ) as ArrayBuffer,
          });
        }

        const subJson = sub.toJSON();
        // Upsert by endpoint (unique). Ignore duplicate-key errors.
        const { error } = await supabase
          .from("push_subscriptions" as any)
          .insert({ user_id: user.id, subscription: subJson as any });
        if (error && !/duplicate|unique/i.test(error.message)) {
          console.warn("[push] save subscription failed", error.message);
        }
      } catch (err) {
        console.warn("[push] setup failed", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);
}
