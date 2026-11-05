export function Logo({ size = 22 }: { size?: number }) {
  // A frosted flake: a golden flake with an icy sparkle.
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M5 8.5c2-4.5 9.5-6 13-2.5 3 3 1.5 10-3.5 12.5S4.5 18 4 14c-.3-2 .2-3.8 1-5.5z" fill="var(--accent)" />
      <path d="M8 10.5c1.5-.8 3-.9 4.5-.4M9 14.5c2 .3 3.6-.2 5-1.4" stroke="var(--paper)" strokeWidth="1.3" strokeLinecap="round" fill="none" opacity=".7" />
      <path d="M19 2.5v4M17 4.5h4" stroke="var(--frost)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
