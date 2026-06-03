// Brand → background gradient. Picks a vibe per sponsor.
export const SPONSOR_BRANDS = [
  { name: "Nike", gradient: "linear-gradient(135deg, #111 0%, #ff5722 100%)" },
  { name: "Adidas", gradient: "linear-gradient(135deg, #000 0%, #ffffff 100%)" },
  { name: "Puma", gradient: "linear-gradient(135deg, #1a1a1a 0%, #ffeb3b 100%)" },
  { name: "Under Armour", gradient: "linear-gradient(135deg, #0a0a0a 0%, #c8102e 100%)" },
  { name: "New Balance", gradient: "linear-gradient(135deg, #d50032 0%, #1a1a1a 100%)" },
  { name: "Asics", gradient: "linear-gradient(135deg, #003366 0%, #0099ff 100%)" },
  { name: "Olympikus", gradient: "linear-gradient(135deg, #ff5722 0%, #ffeb3b 100%)" },
  { name: "Mizuno", gradient: "linear-gradient(135deg, #002868 0%, #ffffff 100%)" },
  { name: "Penalty", gradient: "linear-gradient(135deg, #00b140 0%, #ffeb3b 100%)" },
  { name: "Topper", gradient: "linear-gradient(135deg, #e4002b 0%, #1a1a1a 100%)" },
] as const;

export function brandGradient(name?: string | null): string {
  if (!name) return "linear-gradient(135deg, #ff5722 0%, #ffeb3b 100%)";
  const found = SPONSOR_BRANDS.find((b) => b.name.toLowerCase() === name.toLowerCase());
  return found?.gradient ?? "linear-gradient(135deg, #ff5722 0%, #ffeb3b 100%)";
}
