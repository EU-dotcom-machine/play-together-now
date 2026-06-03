import { Link, useLocation } from "@tanstack/react-router";
import { Compass, PlusCircle, User, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/discover", label: "Jogos", icon: Compass },
  { to: "/sports", label: "Esportes", icon: MapPin },
  { to: "/new", label: "Criar", icon: PlusCircle },
  { to: "/profile", label: "Perfil", icon: User },
] as const;

export function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t-2 border-ink bg-paper">
      <ul className="grid grid-cols-4 max-w-md mx-auto">
        {items.map(({ to, label, icon: Icon }) => {
          const active = pathname.startsWith(to);
          return (
            <li key={to}>
              <Link
                to={to}
                className={cn(
                  "flex flex-col items-center gap-1 py-2 text-[11px] font-semibold uppercase tracking-wide",
                  active ? "text-pop" : "text-ink/70",
                )}
              >
                <Icon className={cn("size-6", active && "stroke-[2.5]")} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
