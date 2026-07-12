// Edge function: notify-nearby-users
// Triggered by a database webhook on INSERT into public.games.
// Finds profiles within 20km of the new game whose sport preferences
// include the game's sport, excludes the host, and inserts a
// "game_nearby" row into public.notifications for each match.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

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

    // Find nearby users (within 20km) who prefer this sport, excluding host.
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
      return new Response(JSON.stringify({ ok: true, notified: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rows = users.map((u) => {
      const distanceKm = Math.round((u.distance_meters / 1000) * 10) / 10;
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
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ ok: true, notified: rows.length }),
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
