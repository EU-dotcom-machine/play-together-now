type Props = {
  value: number;
  total?: number;
  size?: "sm" | "md";
  showLabel?: boolean;
};

export function StickFigure({ filled, size = 16 }: { filled: number; size?: number }) {
  // `filled` is 0..1 to allow fractional fill
  const clipId = `clip-${Math.random().toString(36).slice(2, 9)}`;
  const w = (size / 32) * 20;
  return (
    <svg
      viewBox="0 0 20 36"
      width={w}
      height={size * 1.5}
      className="text-ink/20"
      fill="currentColor"
    >
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y="0" width={20 * Math.max(0, Math.min(1, filled))} height="36" />
        </clipPath>
      </defs>
      <g>
        <circle cx="10" cy="4" r="3.5" />
        <line x1="10" y1="7.5" x2="10" y2="22" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="10" y1="12" x2="2" y2="7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="10" y1="12" x2="18" y2="7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="10" y1="22" x2="4" y2="33" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="10" y1="22" x2="16" y2="33" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </g>
      <g clipPath={`url(#${clipId})`} className="text-zap">
        <circle cx="10" cy="4" r="3.5" />
        <line x1="10" y1="7.5" x2="10" y2="22" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="10" y1="12" x2="2" y2="7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="10" y1="12" x2="18" y2="7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="10" y1="22" x2="4" y2="33" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="10" y1="22" x2="16" y2="33" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}

// Boneco comemorando (braços erguidos em V) para o overlay de confirmação.
// SVG próprio no lugar do emoji 🙋: não corta em nenhuma plataforma/fonte
// (o emoji em 120px com leading-none cortava o braço no mobile) e mantém a
// identidade visual da marca.
export function CelebrationFigure({ size = 140 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 48 54"
      width={size}
      height={size * (54 / 48)}
      className="mx-auto text-pop"
      fill="none"
      aria-hidden="true"
    >
      {/* cabeça */}
      <circle cx="24" cy="11" r="6" fill="currentColor" />
      {/* tronco */}
      <line x1="24" y1="17" x2="24" y2="35" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
      {/* braços erguidos em V */}
      <line x1="24" y1="22" x2="11" y2="9" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
      <line x1="24" y1="22" x2="37" y2="9" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
      {/* pernas */}
      <line x1="24" y1="35" x2="14" y2="49" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
      <line x1="24" y1="35" x2="34" y2="49" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
    </svg>
  );
}

export function StickFigureRating({ value, total = 0, size = "md", showLabel = true }: Props) {
  if (total <= 0) return null;
  const px = size === "sm" ? 14 : 22;
  const safe = Math.max(0, Math.min(5, Number(value) || 0));
  return (
    <div className="inline-flex items-center gap-2">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <StickFigure key={n} size={px} filled={Math.max(0, Math.min(1, safe - (n - 1)))} />
        ))}
      </div>
      {showLabel && (
        <span className="text-xs font-semibold opacity-80">
          {safe.toFixed(1)} · {total} {total === 1 ? "avaliação" : "avaliações"}
        </span>
      )}
    </div>
  );
}
