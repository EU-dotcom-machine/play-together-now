import { Link, useLocation } from "@tanstack/react-router";
import { Compass, PlusCircle, User, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePendingRequestCount } from "@/components/friends-section";

const items = [
  { to: "/discover", label: "Jogos", icon: Compass },
  { to: "/sports", label: "Esportes", icon: MapPin },
  { to: "/new", label: "Criar", icon: PlusCircle },
  { to: "/profile", label: "Perfil", icon: User },
] as const;

export function BottomNav() {
  const { pathname } = useLocation();
  const { data: pending = 0 } = usePendingRequestCount();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-surface">
      <ul className="grid grid-cols-4 max-w-md mx-auto">
        {items.map(({ to, label, icon: Icon }) => {
          const active = pathname.startsWith(to);
          const showBadge = to === "/profile" && pending > 0;
          return (
            <li key={to}>
              <Link
                to={to}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold uppercase tracking-wide transition-colors relative",
                  active ? "text-pop" : "text-[#888888]",
                )}
              >
                <span className="relative">
                  <Icon className={cn("size-6", active && "stroke-[2.5]")} />
                  {showBadge && (
                    <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-pop text-[#111] text-[10px] font-extrabold flex items-center justify-center">
                      {pending > 9 ? "9+" : pending}
                    </span>
                  )}
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
