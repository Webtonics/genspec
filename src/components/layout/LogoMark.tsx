/** GenSpec mark: a gate valve on a line, drawn as a P&ID symbol. */
export function LogoMark({ className = 'size-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="7" className="fill-side-accent" />
      <g className="fill-side-accent-fg stroke-side-accent-fg">
        <path d="M5 16h6M21 16h6" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M11 10.5 16 16l-5 5.5zM21 10.5 16 16l5 5.5z" stroke="none" />
      </g>
    </svg>
  );
}
