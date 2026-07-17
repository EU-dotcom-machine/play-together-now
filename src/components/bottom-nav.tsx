import { Link, useLocation } from "@tanstack/react-router";
import { CalendarDays, Compass, User, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePendingRequestCount } from "@/components/friends-section";

const items = [
  { to: "/discover", label: "Atividades", icon: Compass },
  { to: "/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/friends", label: "Amigos", icon: Users },
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
          const showBadge = to === "/friends" && pending > 0;

          return (
            <li key={to}>
              <Link
                to={to}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold uppercase tracking-wide transition-colors relative",
                  active ? "text-pop" : "text-muted-foreground",
                )}
              >
                <span className="relative">
                  <Icon className={cn("size-6", active && "stroke-[2.5]")} />
                  {showBadge && (
                    <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-pop ring-2 ring-surface" />
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
