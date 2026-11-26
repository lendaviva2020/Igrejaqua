/** Marca IGREJAQUA: casa com cruz (desenho próprio). Herda a cor via currentColor. */
export function Logo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" role="img" aria-label="IGREJAQUA" className={className}>
      <path d="M16 2v6M13 5h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 16 16 8l12 8v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V16Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M12.5 29v-7a3.5 3.5 0 0 1 7 0v7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
