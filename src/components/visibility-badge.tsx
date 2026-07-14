import { Globe, Users, Lock, Home } from "lucide-react";

type Visibility = "public" | "friends" | "cep" | "private" | string | null | undefined;

export function VisibilityBadge({
  visibility,
  size = "sm",
  withLabel = false,
}: {
  visibility: Visibility;
  size?: "sm" | "md";
  withLabel?: boolean;
}) {
  const v = (visibility ?? "public") as string;
  const cfg =
    v === "friends"
      ? { Icon: Users, label: "Amigos" }
      : v === "private"
      ? { Icon: Lock, label: "Privado" }
      : v === "cep"
      ? { Icon: Home, label: "Condomínio" }
      : { Icon: Globe, label: "Público" };
  const iconCls = size === "md" ? "size-4" : "size-3.5";
  if (!withLabel) {
    return (
      <cfg.Icon
        className={`${iconCls} text-white/80`}
        aria-label={cfg.label}
      />
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-black/50 text-white">
      <cfg.Icon className="size-3" />
      {cfg.label}
    </span>
  );
}
