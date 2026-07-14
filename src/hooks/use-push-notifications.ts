import { useCallback, useEffect, useState } from "react";
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

function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

async function saveSubscription(userId: string, sub: PushSubscription) {
  const subJson = sub.toJSON();
  const endpoint = subJson.endpoint!;
  // Deduplicate por endpoint: se já existe registro com este endpoint,
  // atualiza user_id/subscription; caso contrário insere um novo.
  const doUpsert = () =>
    supabase
      .from("push_subscriptions" as any)
      .upsert(
        { user_id: userId, subscription: subJson as any, endpoint } as any,
        { onConflict: "endpoint" } as any,
      );
  let { error } = await doUpsert();
  if (error) {
    console.error("[push] save subscription failed, retrying once", error);
    ({ error } = await doUpsert());
  }
  if (error) {
    console.error("[push] save subscription failed after retry", error);
    throw error;
  }
}

export function usePushNotifications() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    if (isPreviewOrDev()) return;
    if (!isPushSupported()) return;

    let cancelled = false;

    (async () => {
      try {
        const reg =
          (await navigator.serviceWorker.getRegistration("/sw.js")) ??
          (await navigator.serviceWorker.register("/sw.js"));
        await navigator.serviceWorker.ready;
        if (cancelled) return;

        // Só reativa se o usuário já concedeu permissão antes.
        if (Notification.permission !== "granted") return;

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
        await saveSubscription(user.id, sub);
      } catch (err) {
        console.warn("[push] setup failed", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);
}

type PushStatus = "unsupported" | "denied" | "disabled" | "enabled" | "unknown";

export function usePushNotificationControl() {
  const { user } = useAuth();
  const [status, setStatus] = useState<PushStatus>("unknown");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!isPushSupported() || isPreviewOrDev()) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    setStatus(sub && Notification.permission === "granted" ? "enabled" : "disabled");
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, user?.id]);

  const enable = useCallback(async () => {
    if (!user) return;
    if (!isPushSupported() || isPreviewOrDev()) return;
    setBusy(true);
    try {
      const reg =
        (await navigator.serviceWorker.getRegistration("/sw.js")) ??
        (await navigator.serviceWorker.register("/sw.js"));
      await navigator.serviceWorker.ready;
      let permission = Notification.permission;
      if (permission === "default") permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "disabled");
        return;
      }
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
      await saveSubscription(user.id, sub);
      setStatus("enabled");
    } finally {
      setBusy(false);
    }
  }, [user]);

  const disable = useCallback(async () => {
    if (!isPushSupported()) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        try {
          await sub.unsubscribe();
        } catch (err) {
          console.warn("[push] unsubscribe failed", err);
        }
        await supabase
          .from("push_subscriptions" as any)
          .delete()
          .eq("endpoint", endpoint);
      }
      setStatus("disabled");
    } finally {
      setBusy(false);
    }
  }, []);

  return { status, busy, enable, disable, refresh };
}
