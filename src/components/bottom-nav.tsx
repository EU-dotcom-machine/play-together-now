import { Link, useLocation } from "@tanstack/react-router";
import { CalendarDays, Compass, User, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { usePendingRequestCount } from "@/components/friends-section";

const items = [
  { to: "/discover", key: "nav.activities", icon: Compass },
  { to: "/agenda", key: "nav.agenda", icon: CalendarDays },
  { to: "/friends", key: "nav.friends", icon: Users },
  { to: "/profile", key: "nav.profile", icon: User },
] as const;

export function BottomNav() {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const { data: pending = 0 } = usePendingRequestCount();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-surface">
      <ul className="grid grid-cols-4 max-w-md mx-auto">
        {items.map(({ to, key, icon: Icon }) => {
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
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
