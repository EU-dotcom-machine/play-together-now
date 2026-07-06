import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "my_agenda",
  title: "My upcoming games",
  description:
    "List the signed-in user's upcoming games — both games they host and games they've joined as a participant.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const userId = ctx.getUserId();
    const nowIso = new Date().toISOString();

    const [hostedRes, participatingRes] = await Promise.all([
      sb
        .from("games")
        .select("id, title, starts_at, sport_id, slots_total, status")
        .eq("host_id", userId)
        .gte("starts_at", nowIso)
        .order("starts_at", { ascending: true }),
      sb
        .from("game_participants")
        .select("status, game:games(id, title, starts_at, sport_id, slots_total, status)")
        .eq("user_id", userId)
        .eq("status", "confirmed"),
    ]);

    if (hostedRes.error)
      return { content: [{ type: "text", text: hostedRes.error.message }], isError: true };
    if (participatingRes.error)
      return { content: [{ type: "text", text: participatingRes.error.message }], isError: true };

    const participating = (participatingRes.data ?? [])
      .map((row: any) => row.game)
      .filter((g: any) => g && g.starts_at >= nowIso);

    const payload = { hosted: hostedRes.data ?? [], participating };
    return {
      content: [{ type: "text", text: JSON.stringify(payload) }],
      structuredContent: payload,
    };
  },
});
