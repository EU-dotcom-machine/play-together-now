import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "search_upcoming_games",
  title: "Search upcoming games",
  description:
    "Search upcoming public games on Esportes Unidos. Optionally filter by sport slug. Returns up to `limit` games ordered by start time.",
  inputSchema: {
    sport_slug: z.string().trim().min(1).optional().describe("Filter by sport slug, e.g. 'futebol'."),
    limit: z.number().int().min(1).max(50).optional().describe("Max games to return (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ sport_slug, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    let sportId: string | undefined;
    if (sport_slug) {
      const { data: sport, error: sErr } = await sb
        .from("sports")
        .select("id")
        .eq("slug", sport_slug)
        .maybeSingle();
      if (sErr) return { content: [{ type: "text", text: sErr.message }], isError: true };
      if (!sport) {
        return {
          content: [{ type: "text", text: `No sport found with slug '${sport_slug}'.` }],
          isError: true,
        };
      }
      sportId = sport.id;
    }

    const nowIso = new Date().toISOString();
    let q = sb
      .from("games")
      .select(
        "id, title, description, starts_at, ends_at, duration_min, slots_total, price_cents, latitude, longitude, urgency, sport_id, venue_id, host_id, visibility, status",
      )
      .eq("visibility", "public")
      .eq("status", "open")
      .gte("starts_at", nowIso)
      .order("starts_at", { ascending: true })
      .limit(limit ?? 20);
    if (sportId) q = q.eq("sport_id", sportId);

    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { games: data ?? [] },
    };
  },
});
