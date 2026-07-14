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

async function saveSubscription(_userId: string, sub: PushSubscription) {
  // Guard: don't attempt to persist without a valid session — avoids 428C9/400 storms
  // when the refresh token is stale (typical on PWA reopen).
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    console.warn("[push] skip save: no valid session");
    return;
  }
  const subJson = sub.toJSON();
  const endpoint = subJson.endpoint!;
  // Use RPC to bypass any REST/PostgREST quirks with upsert on this table.
  const doCall = () =>
    supabase.rpc("save_push_subscription" as any, {
      p_subscription: subJson as any,
      p_endpoint: endpoint,
    } as any);
  let { error } = await doCall();
  if (error) {
    console.error("[push] save subscription failed, retrying once", error);
    ({ error } = await doCall());
  }
  if (error) {
    console.error("[push] save subscription failed after retry", error);
    const detail =
      (error as any)?.code ||
      (error as any)?.message ||
      JSON.stringify(error);
    throw new Error("Erro ao salvar: " + detail);
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

type PushStatus =
  | "unsupported"
  | "denied"
  | "disabled"
  | "enabled"
  | "desync"
  | "unknown";

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
    if (!sub || Notification.permission !== "granted") {
      setStatus("disabled");
      return;
    }
    // Check whether the DB has this endpoint registered.
    const { data, error } = await supabase
      .from("push_subscriptions" as any)
      .select("endpoint")
      .eq("endpoint", sub.endpoint)
      .maybeSingle();
    if (error) {
      console.error("[push] refresh: db check failed", error);
      setStatus("desync");
      return;
    }
    setStatus(data ? "enabled" : "desync");
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
      try {
        await saveSubscription(user.id, sub);
        setStatus("enabled");
      } catch (err) {
        console.error("[push] enable: could not persist subscription", err);
        setStatus("desync");
      }
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
