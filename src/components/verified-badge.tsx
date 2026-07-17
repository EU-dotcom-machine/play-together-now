import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

// Selo de espaço verificado (cadastro aprovado via CNPJ).
export function VerifiedBadge({
  showLabel = false,
  className,
}: {
  showLabel?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-pop font-bold",
        showLabel ? "text-[11px] rounded-full bg-pop/15 px-2 py-0.5" : "",
        className,
      )}
      title="Espaço verificado"
    >
      <BadgeCheck className="size-3.5 shrink-0" />
      {showLabel && "Verificado"}
    </span>
  );
}
