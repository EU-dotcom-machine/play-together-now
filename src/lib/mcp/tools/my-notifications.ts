import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "my_notifications",
  title: "My recent notifications",
  description:
    "List the signed-in user's most recent notifications (invites, game updates, friend requests, etc.). Optionally filter to unread only.",
  inputSchema: {
    unread_only: z
      .boolean()
      .optional()
      .describe("If true, return only unread notifications. Defaults to false."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe("Max notifications to return (1-50). Defaults to 20."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ unread_only, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const userId = ctx.getUserId();
    if (!userId) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }

    let q = sb
      .from("notifications")
      .select("id, type, title, body, data, read, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);

    if (unread_only) q = q.eq("read", false);

    const { data, error } = await q;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }

    const payload = { notifications: data ?? [], count: data?.length ?? 0 };
    return {
      content: [{ type: "text", text: JSON.stringify(payload) }],
      structuredContent: payload,
    };
  },
});
