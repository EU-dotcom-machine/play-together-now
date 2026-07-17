import { cn } from "@/lib/utils";

// Logo Esportes Unidos: "EU" + boneco levantando o braço (a ação "Diga EU!").
// Por padrão o braço levanta uma vez ao montar e fica erguido (animate).
// Respeita prefers-reduced-motion (sem animação).
export function Logo({
  height = 40,
  animate = true,
  className,
  title = "Esportes Unidos",
}: {
  height?: number;
  animate?: boolean;
  className?: string;
  title?: string;
}) {
  const width = height * (150 / 64);
  return (
    <svg
      height={height}
      width={width}
      viewBox="0 0 150 64"
      className={cn("text-pop", className)}
      role="img"
      aria-label={title}
    >
      <text
        x="2"
        y="50"
        fontFamily="var(--font-display), system-ui, sans-serif"
        fontWeight="800"
        fontSize="52"
        fill="currentColor"
        letterSpacing="-1"
      >
        EU
      </text>
      <g transform="translate(112,8)" fill="currentColor" stroke="currentColor">
        <circle cx="18" cy="11" r="6" stroke="none" />
        <line x1="18" y1="17" x2="18" y2="36" strokeWidth="5" strokeLinecap="round" />
        <line x1="18" y1="23" x2="7" y2="31" strokeWidth="5" strokeLinecap="round" />
        <line
          className={animate ? "eu-logo-arm" : undefined}
          x1="18"
          y1="23"
          x2="31"
          y2="10"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <line x1="18" y1="36" x2="10" y2="52" strokeWidth="5" strokeLinecap="round" />
        <line x1="18" y1="36" x2="26" y2="52" strokeWidth="5" strokeLinecap="round" />
      </g>
    </svg>
  );
}
