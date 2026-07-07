import { createServerFn } from "@tanstack/react-start";

export const getGooglePlacesKey = createServerFn({ method: "GET" }).handler(async () => {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) throw new Error("GOOGLE_API_KEY not configured");
  return { key };
});
