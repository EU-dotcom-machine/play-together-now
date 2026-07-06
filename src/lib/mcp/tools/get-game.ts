import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_game",
  title: "Get game details",
  description: "Fetch full details for a single game by its UUID, including participants count.",
  inputSchema: {
    game_id: z.string().uuid().describe("Game UUID."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ game_id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const { data: game, error } = await sb
      .from("games")
      .select("*")
      .eq("id", game_id)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!game) return { content: [{ type: "text", text: "Game not found" }], isError: true };

    const { count } = await sb
      .from("game_participants")
      .select("*", { count: "exact", head: true })
      .eq("game_id", game_id)
      .eq("status", "confirmed");

    const payload = { ...game, confirmed_participants: count ?? 0 };
    return {
      content: [{ type: "text", text: JSON.stringify(payload) }],
      structuredContent: payload,
    };
  },
});
