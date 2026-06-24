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
