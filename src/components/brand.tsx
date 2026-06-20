// Marca Indeba Express — monograma "ies" (azul + swoosh laranja) e wordmark.
// Vetorial, sem depender de asset externo (a logo oficial entra no Marco 3).
export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" role="img" aria-label="Indeba Express">
      <rect width="40" height="40" rx="11" fill="var(--primary)" />
      <path d="M4 27c8 6 24 6 32 0v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" fill="var(--accent)" opacity="0.95" />
      <text
        x="20"
        y="23"
        textAnchor="middle"
        fontFamily="var(--font-sans), system-ui"
        fontSize="15"
        fontWeight="800"
        fill="#fff"
        letterSpacing="-0.5"
      >
        ies
      </text>
    </svg>
  );
}

export function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <Logo />
      <div className="leading-tight">
        <div className="text-sm font-extrabold tracking-tight text-foreground">
          indeba<span className="text-accent"> express</span>
        </div>
        <div className="text-[11px] text-muted-foreground">Agente de Proposta</div>
      </div>
    </div>
  );
}
