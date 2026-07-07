import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listSports from "./tools/list-sports";
import searchUpcomingGames from "./tools/search-upcoming-games";
import getGame from "./tools/get-game";
import myAgenda from "./tools/my-agenda";
import myNotifications from "./tools/my-notifications";

// Issuer must be the direct Supabase host, built from the inlined VITE project
// ref. See app-mcp-server-authoring for why the proxy URL is rejected.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "esportes-unidos-mcp",
  title: "Esportes Unidos",
  version: "0.1.0",
  instructions:
    "Tools for Esportes Unidos, a sports meetup app. Use `list_sports` to discover sports, `search_upcoming_games` to find public games (optionally filtered by sport), `get_game` for full details of one game, `my_agenda` for the signed-in user's own upcoming games, and `my_notifications` for their recent notifications.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listSports, searchUpcomingGames, getGame, myAgenda, myNotifications],
});
