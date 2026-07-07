import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { distanceKm, formatDistance } from "@/lib/geo";
import { nearbyAlertsStore } from "@/lib/nearby-alerts-store";

const RADIUS_KM = 12;
const LOC_KEY = "nearby-alerts:loc";

type Coords = { lat: number; lon: number };

function readCachedLocation(): Coords | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LOC_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (typeof p?.lat === "number" && typeof p?.lon === "number") return p;
  } catch {
    /* noop */
  }
  return null;
}

function requestLocation(): Promise<Coords | null> {
  if (typeof window === "undefined" || !("geolocation" in navigator)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c: Coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        try {
          window.localStorage.setItem(LOC_KEY, JSON.stringify(c));
        } catch {
          /* noop */
        }
        resolve(c);
      },
      () => resolve(readCachedLocation()),
      { enableHighAccuracy: false, maximumAge: 5 * 60 * 1000, timeout: 8000 },
    );
  });
}

/**
 * Subscribes to newly-created public games and toasts + bumps the bell badge
 * when one lands within RADIUS_KM of the signed-in user.
 */
export function useNearbyGameAlerts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const coordsRef = useRef<Coords | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    coordsRef.current = readCachedLocation();
    void requestLocation().then((c) => {
      if (!cancelled && c) coordsRef.current = c;
    });

    const channel = supabase
      .channel(`nearby-games:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "games" },
        (payload) => {
          const g = payload.new as {
            id: string;
            title: string | null;
            host_id: string;
            visibility: string;
            status: string;
            starts_at: string;
            latitude: number | null;
            longitude: number | null;
          };

          if (!g || g.host_id === user.id) return;
          if (g.visibility !== "public" || g.status !== "open") return;
          if (new Date(g.starts_at).getTime() <= Date.now()) return;

          const me = coordsRef.current;
          if (!me || g.latitude == null || g.longitude == null) return;
          const km = distanceKm(me.lat, me.lon, g.latitude, g.longitude);
          if (km > RADIUS_KM) return;

          nearbyAlertsStore.increment();
          toast(g.title ?? "Novo jogo perto de você", {
            description: `A ${formatDistance(km)} de você — toque para ver`,
            action: {
              label: "Ver",
              onClick: () => navigate({ to: "/games/$id", params: { id: g.id } }),
            },
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user, navigate]);
}
