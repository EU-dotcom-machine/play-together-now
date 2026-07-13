// Edge function: notify-nearby-users
// Triggered by a database webhook on INSERT into public.games.
// Finds profiles within 20km of the new game whose sport preferences
// include the game's sport, excludes the host, inserts "game_nearby"
// notifications, and sends Web Push notifications to their subscribed
// browsers via VAPID.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import webpush from "npm:web-push@3.6.7";

type GameRow = {
  id: string;
  host_id: string;
  sport_id: string;
  title: string;
  starts_at: string;
  latitude: number;
  longitude: number;
};

type WebhookPayload = {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: GameRow;
  old_record: GameRow | null;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT =
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:contato@esportesunidoseu.com.br";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  } catch (e) {
    console.warn("web-push setVapidDetails failed", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as WebhookPayload;
    if (payload.type !== "INSERT" || !payload.record) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const game = payload.record;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: matches, error: rpcError } = await admin.rpc(
      "nearby_users_for_sport",
      {
        _lat: game.latitude,
        _lng: game.longitude,
        _sport_id: game.sport_id,
        _exclude_user: game.host_id,
        _radius_meters: 20000,
      },
    );

    if (rpcError) {
      console.error("nearby_users_for_sport error", rpcError);
      return new Response(JSON.stringify({ error: rpcError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const users = (matches ?? []) as Array<{
      user_id: string;
      distance_meters: number;
    }>;

    if (users.length === 0) {
      return new Response(JSON.stringify({ ok: true, notified: 0, pushed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const distanceByUser = new Map<string, number>();
    for (const u of users) {
      distanceByUser.set(u.user_id, Math.round((u.distance_meters / 1000) * 10) / 10);
    }

    const rows = users.map((u) => {
      const distanceKm = distanceByUser.get(u.user_id)!;
      return {
        user_id: u.user_id,
        type: "game_nearby",
        title: "Nova atividade perto de você",
        body: `${game.title} • ~${distanceKm} km`,
        read: false,
        data: {
          game_id: game.id,
          sport_id: game.sport_id,
          title: game.title,
          starts_at: game.starts_at,
          distance_km: distanceKm,
        },
      };
    });

    const { error: insertError } = await admin
      .from("notifications")
      .insert(rows);

    if (insertError) {
      console.error("notifications insert error", insertError);
    }

    // Send Web Push to every subscription owned by matched users.
    let pushed = 0;
    if (VAPID_PUBLIC && VAPID_PRIVATE) {
      const userIds = users.map((u) => u.user_id);
      const { data: subs, error: subsError } = await admin
        .from("push_subscriptions")
        .select("id, user_id, subscription")
        .in("user_id", userIds);

      if (subsError) {
        console.error("push_subscriptions select error", subsError);
      } else if (subs && subs.length > 0) {
        const staleIds: string[] = [];
        await Promise.all(
          subs.map(async (row: any) => {
            const distanceKm = distanceByUser.get(row.user_id) ?? 0;
            const pushPayload = JSON.stringify({
              title: "Nova atividade perto de você!",
              body: `${game.title} • ~${distanceKm} km`,
              data: { game_id: game.id },
            });
            try {
              await webpush.sendNotification(row.subscription, pushPayload, {
                TTL: 60 * 60,
              });
              pushed++;
            } catch (err: any) {
              const status = err?.statusCode;
              if (status === 404 || status === 410) {
                staleIds.push(row.id);
              } else {
                console.warn("web-push send failed", status, err?.body ?? err?.message);
              }
            }
          }),
        );
        if (staleIds.length > 0) {
          await admin.from("push_subscriptions").delete().in("id", staleIds);
        }
      }
    } else {
      console.warn("VAPID keys not set; skipping web push");
    }

    return new Response(
      JSON.stringify({ ok: true, notified: rows.length, pushed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("notify-nearby-users fatal", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
